import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Messaging service — reads from the native in-app messaging schema
 * introduced in migration 000013 (`message_threads`, `thread_participants`,
 * `chat_messages`, `recruiter_message_quotas`).
 *
 * Three flavors of thread:
 *   - dm                  (coach ↔ player within a program)
 *   - announcement        (coach broadcasts to a team level)
 *   - recruiter_outreach  (recruiter → player, gated by plan + accept/decline)
 *
 * Writes are done via SECURITY DEFINER RPCs defined in the same migration
 * so the vocabulary / quota checks stay in one place.
 */

export type ThreadKind = "dm" | "announcement" | "recruiter_outreach";
export type OutreachStatus = "pending" | "accepted" | "declined";
export type ThreadParticipantRole = "coach" | "player" | "recruiter";

export interface InboxThread {
  threadId: string;
  viewerRole: ThreadParticipantRole;
  kind: ThreadKind;
  subject: string | null;
  programId: string | null;
  recruiterId: string | null;
  targetPlayerId: string | null;
  outreachStatus: OutreachStatus | null;
  lastMessageAt: string;
  unreadCount: number;
  muted: boolean;
  preview: string | null;
  lastSenderUserId: string | null;
  /** Populated post-hoc by the page based on role. */
  counterparty?: {
    userId: string | null;
    displayName: string;
    subLabel: string | null;
    avatarColor: string;
  };
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderUserId: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

export interface ThreadParticipant {
  userId: string;
  role: ThreadParticipantRole;
  lastReadAt: string | null;
  muted: boolean;
  displayName: string;
  subLabel: string | null;
}

/**
 * Fetch the current user's inbox — a chronological list of threads
 * with unread counts + message preview. Populates counterparty info
 * (who's the other person) for list rendering.
 */
export async function fetchInbox(): Promise<InboxThread[]> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows, error } = await supabase
    .from("inbox_threads")
    .select(
      "thread_id, viewer_role, kind, subject, program_id, recruiter_id, target_player_id, outreach_status, last_message_at, unread_count, muted, preview, last_sender_user_id",
    )
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false });
  if (error || !rows) return [];

  // For each thread we need to know the "counterparty" — the person
  // the signed-in user is effectively talking to. Fetching all
  // participants + resolving names in bulk keeps this O(1) in round-
  // trips even for large inboxes.
  const threadIds = rows.map((r) => r.thread_id);
  if (threadIds.length === 0) return [];

  const { data: participants } = await supabase
    .from("thread_participants")
    .select("thread_id, user_id, role")
    .in("thread_id", threadIds);

  // Resolve display names via coaches / recruiters / players (claimed)
  const otherUserIds = Array.from(
    new Set(
      (participants ?? [])
        .filter((p) => p.user_id !== user.id)
        .map((p) => p.user_id),
    ),
  );

  const [coaches, recruiters, players] = await Promise.all([
    otherUserIds.length > 0
      ? supabase
          .from("coaches")
          .select("user_id, full_name, role, programs(name)")
          .in("user_id", otherUserIds)
      : Promise.resolve({ data: [] as unknown[] }),
    otherUserIds.length > 0
      ? supabase
          .from("recruiters")
          .select("user_id, full_name, organization_name, organization_division")
          .in("user_id", otherUserIds)
      : Promise.resolve({ data: [] as unknown[] }),
    otherUserIds.length > 0
      ? supabase
          .from("players")
          .select(
            "claimed_by_user_id, first_name, last_name, player_number, profile_slug",
          )
          .in("claimed_by_user_id", otherUserIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const profileByUser = new Map<
    string,
    { displayName: string; subLabel: string | null; avatarColor: string }
  >();
  for (const c of (coaches.data ?? []) as Array<{
    user_id: string;
    full_name: string;
    role: string;
    programs?: { name: string } | { name: string }[];
  }>) {
    const program = Array.isArray(c.programs) ? c.programs[0] : c.programs;
    profileByUser.set(c.user_id, {
      displayName: c.full_name,
      subLabel: `${c.role === "head_coach" ? "Head Coach" : "Assistant"} · ${program?.name ?? ""}`,
      avatarColor: "dirt",
    });
  }
  for (const r of (recruiters.data ?? []) as Array<{
    user_id: string;
    full_name: string;
    organization_name: string;
    organization_division: string;
  }>) {
    profileByUser.set(r.user_id, {
      displayName: r.full_name,
      subLabel: `${r.organization_name} · ${(r.organization_division ?? "").toUpperCase()}`,
      avatarColor: "sky",
    });
  }
  for (const p of (players.data ?? []) as Array<{
    claimed_by_user_id: string;
    first_name: string;
    last_name: string;
    player_number: number | null;
    profile_slug: string;
  }>) {
    profileByUser.set(p.claimed_by_user_id, {
      displayName: `${p.first_name} ${p.last_name}`,
      subLabel: p.player_number ? `#${p.player_number}` : null,
      avatarColor: "grass",
    });
  }

  const partsByThread = new Map<string, Array<{ user_id: string; role: string }>>();
  for (const p of participants ?? []) {
    const arr = partsByThread.get(p.thread_id) ?? [];
    arr.push({ user_id: p.user_id, role: p.role });
    partsByThread.set(p.thread_id, arr);
  }

  return rows.map((r) => {
    const parts = partsByThread.get(r.thread_id) ?? [];
    // For DMs / outreach, counterparty = the non-self participant.
    // For announcements, the counterparty is "the coach who sent it"
    // if you're a player, or "To: <team level>" if you're a coach.
    let counterparty: InboxThread["counterparty"];

    if (r.kind === "announcement") {
      if (r.viewer_role === "coach") {
        counterparty = {
          userId: null,
          displayName: r.subject ?? "Team announcement",
          subLabel: `Sent to ${parts.length - 1} ${parts.length - 1 === 1 ? "player" : "players"}`,
          avatarColor: "red",
        };
      } else {
        const sender = parts.find((p) => p.role === "coach");
        const profile = sender ? profileByUser.get(sender.user_id) : null;
        counterparty = {
          userId: sender?.user_id ?? null,
          displayName: profile?.displayName ?? "Coach",
          subLabel: r.subject ?? "Announcement",
          avatarColor: profile?.avatarColor ?? "red",
        };
      }
    } else {
      const other = parts.find((p) => p.user_id !== user.id);
      const profile = other ? profileByUser.get(other.user_id) : null;
      counterparty = {
        userId: other?.user_id ?? null,
        displayName: profile?.displayName ?? "Unknown",
        subLabel: profile?.subLabel ?? null,
        avatarColor: profile?.avatarColor ?? "ink",
      };
    }

    return {
      threadId: r.thread_id,
      viewerRole: r.viewer_role as ThreadParticipantRole,
      kind: r.kind as ThreadKind,
      subject: r.subject,
      programId: r.program_id,
      recruiterId: r.recruiter_id,
      targetPlayerId: r.target_player_id,
      outreachStatus: r.outreach_status as OutreachStatus | null,
      lastMessageAt: r.last_message_at,
      unreadCount: r.unread_count,
      muted: r.muted,
      preview: r.preview,
      lastSenderUserId: r.last_sender_user_id,
      counterparty,
    };
  });
}

/**
 * Fetch a single thread's metadata + messages + participant list.
 * Caller should already be a participant (RLS enforces).
 */
export interface ThreadDetail {
  thread: InboxThread;
  messages: ChatMessage[];
  participants: ThreadParticipant[];
}

export async function fetchThreadDetail(
  threadId: string,
): Promise<ThreadDetail | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: summaryRow } = await supabase
    .from("inbox_threads")
    .select(
      "thread_id, viewer_role, kind, subject, program_id, recruiter_id, target_player_id, outreach_status, last_message_at, unread_count, muted, preview, last_sender_user_id",
    )
    .eq("user_id", user.id)
    .eq("thread_id", threadId)
    .maybeSingle();
  if (!summaryRow) return null;

  const { data: msgRows } = await supabase
    .from("chat_messages")
    .select("id, thread_id, sender_user_id, body, created_at, edited_at")
    .eq("thread_id", threadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const { data: parts } = await supabase
    .from("thread_participants")
    .select("user_id, role, last_read_at, muted")
    .eq("thread_id", threadId);

  // Resolve participant display names
  const otherUserIds = (parts ?? []).map((p) => p.user_id);
  const profileByUser = await resolveDisplayNames(otherUserIds);

  const thread: InboxThread = {
    threadId: summaryRow.thread_id,
    viewerRole: summaryRow.viewer_role as ThreadParticipantRole,
    kind: summaryRow.kind as ThreadKind,
    subject: summaryRow.subject,
    programId: summaryRow.program_id,
    recruiterId: summaryRow.recruiter_id,
    targetPlayerId: summaryRow.target_player_id,
    outreachStatus: summaryRow.outreach_status as OutreachStatus | null,
    lastMessageAt: summaryRow.last_message_at,
    unreadCount: summaryRow.unread_count,
    muted: summaryRow.muted,
    preview: summaryRow.preview,
    lastSenderUserId: summaryRow.last_sender_user_id,
  };

  return {
    thread,
    messages: (msgRows ?? []).map((m) => ({
      id: m.id,
      threadId: m.thread_id,
      senderUserId: m.sender_user_id,
      body: m.body,
      createdAt: m.created_at,
      editedAt: m.edited_at,
    })),
    participants: (parts ?? []).map((p) => {
      const profile = profileByUser.get(p.user_id);
      return {
        userId: p.user_id,
        role: p.role as ThreadParticipantRole,
        lastReadAt: p.last_read_at,
        muted: p.muted,
        displayName: profile?.displayName ?? "Unknown",
        subLabel: profile?.subLabel ?? null,
      };
    }),
  };
}

async function resolveDisplayNames(
  userIds: string[],
): Promise<Map<string, { displayName: string; subLabel: string | null }>> {
  const map = new Map<string, { displayName: string; subLabel: string | null }>();
  if (userIds.length === 0) return map;
  const supabase = createSupabaseServerClient();
  const [coaches, recruiters, players] = await Promise.all([
    supabase.from("coaches").select("user_id, full_name, role").in("user_id", userIds),
    supabase
      .from("recruiters")
      .select("user_id, full_name, organization_name, organization_division")
      .in("user_id", userIds),
    supabase
      .from("players")
      .select("claimed_by_user_id, first_name, last_name, player_number")
      .in("claimed_by_user_id", userIds),
  ]);
  for (const c of coaches.data ?? []) {
    map.set(c.user_id, {
      displayName: c.full_name,
      subLabel: c.role === "head_coach" ? "Head Coach" : "Assistant",
    });
  }
  for (const r of recruiters.data ?? []) {
    map.set(r.user_id, {
      displayName: r.full_name,
      subLabel: `${r.organization_name} · ${(r.organization_division ?? "").toUpperCase()}`,
    });
  }
  for (const p of players.data ?? []) {
    map.set(p.claimed_by_user_id, {
      displayName: `${p.first_name} ${p.last_name}`,
      subLabel: p.player_number ? `#${p.player_number}` : null,
    });
  }
  return map;
}

/**
 * Global unread count across every thread the user participates in.
 * Used for nav badges.
 */
export async function fetchUnreadCount(): Promise<number> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_unread_count");
  if (error || data == null) return 0;
  return Number(data) || 0;
}

// ── Recruiter quota ──────────────────────────────────────────────

export interface RecruiterQuota {
  plan: "free" | "starter" | "pro" | "enterprise";
  monthlyLimit: number;
  currentMonthSent: number;
  monthResetAt: string;
  remaining: number;
}

export async function fetchRecruiterQuota(
  recruiterId: string,
): Promise<RecruiterQuota> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("recruiter_message_quotas")
    .select("plan, monthly_limit, current_month_sent, month_reset_at")
    .eq("recruiter_id", recruiterId)
    .maybeSingle();
  if (error || !data) {
    // No row yet — treat as free tier with 3-message default
    return {
      plan: "free",
      monthlyLimit: 3,
      currentMonthSent: 0,
      monthResetAt: new Date().toISOString(),
      remaining: 3,
    };
  }
  return {
    plan: data.plan as RecruiterQuota["plan"],
    monthlyLimit: data.monthly_limit,
    currentMonthSent: data.current_month_sent,
    monthResetAt: data.month_reset_at,
    remaining: Math.max(0, data.monthly_limit - data.current_month_sent),
  };
}

/**
 * fetchOutreachHistory — recruiter's sent outreach threads with
 * current status. Shows pending / accepted / declined.
 */
export interface OutreachRecord {
  threadId: string;
  subject: string | null;
  status: OutreachStatus;
  createdAt: string;
  lastMessageAt: string;
  targetPlayer: {
    id: string;
    firstName: string;
    lastName: string;
    profileSlug: string;
  };
}

export async function fetchOutreachHistory(
  recruiterId: string,
): Promise<OutreachRecord[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("message_threads")
    .select(
      "id, subject, outreach_status, created_at, last_message_at, target_player_id, players:target_player_id(id, first_name, last_name, profile_slug)",
    )
    .eq("kind", "recruiter_outreach")
    .eq("recruiter_id", recruiterId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data
    .map((r) => {
      const p = Array.isArray(r.players) ? r.players[0] : r.players;
      if (!p) return null;
      return {
        threadId: r.id,
        subject: r.subject,
        status: r.outreach_status as OutreachStatus,
        createdAt: r.created_at,
        lastMessageAt: r.last_message_at,
        targetPlayer: {
          id: (p as { id: string }).id,
          firstName: (p as { first_name: string }).first_name,
          lastName: (p as { last_name: string }).last_name,
          profileSlug: (p as { profile_slug: string }).profile_slug,
        },
      };
    })
    .filter((x): x is OutreachRecord => x !== null);
}
