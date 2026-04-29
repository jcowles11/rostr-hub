"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";
import { getCurrentRecruiter } from "@/lib/services/recruiter";

/**
 * Messaging server actions.
 * Writes always go through the SECURITY DEFINER RPCs defined in
 * migration 000013, so vocabulary + quota checks live in one place.
 */

// ── Coach ↔ Player DM ──────────────────────────────────────────

export async function createCoachPlayerDmAction(input: {
  playerId: string;
  body: string;
}): Promise<{ error: string | null; threadId?: string }> {
  if (!input.body.trim()) return { error: "Message can't be empty." };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "Not a coach." };
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("create_coach_player_dm", {
    _program_id: coach.program_id,
    _player_id: input.playerId,
    _body: input.body,
  });
  if (error) {
    const m = error.message ?? "";
    if (/player_not_claimed/.test(m))
      return { error: "Player hasn't claimed their profile yet." };
    if (/not_a_coach_on_program/.test(m))
      return { error: "You aren't a coach on this program." };
    return { error: m || "Couldn't send message." };
  }

  revalidatePath("/app/messages");
  revalidatePath("/app");
  return { error: null, threadId: data as string };
}

// ── Team announcement ──────────────────────────────────────────

export async function sendTeamAnnouncementAction(input: {
  teamLevel: string | null;
  subject: string;
  body: string;
}): Promise<{ error: string | null; threadId?: string }> {
  if (!input.subject.trim()) return { error: "Subject required." };
  if (!input.body.trim()) return { error: "Message can't be empty." };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "Not a coach." };
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("send_team_announcement", {
    _program_id: coach.program_id,
    _team_level: input.teamLevel ? input.teamLevel.toLowerCase() : null,
    _subject: input.subject,
    _body: input.body,
  });
  if (error) return { error: error.message };

  revalidatePath("/app/messages");
  revalidatePath("/app");
  return { error: null, threadId: data as string };
}

// ── Send a message to an existing thread ────────────────────────

export async function sendMessageAction(
  threadId: string,
  body: string,
): Promise<{ error: string | null }> {
  if (!body.trim()) return { error: "Message can't be empty." };
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("chat_messages").insert({
    thread_id: threadId,
    sender_user_id: user.id,
    body: body.trim(),
  });
  if (error) {
    if (/row-level security/i.test(error.message)) {
      return { error: "You can't post to this thread." };
    }
    return { error: error.message };
  }

  revalidatePath(`/app/messages/${threadId}`);
  revalidatePath(`/me/messages/${threadId}`);
  revalidatePath("/app/messages");
  revalidatePath("/me/messages");
  return { error: null };
}

// ── Mark a thread read ──────────────────────────────────────────

export async function markThreadReadAction(
  threadId: string,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: null };

  const { error } = await supabase
    .from("thread_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/app/messages");
  revalidatePath("/me/messages");
  revalidatePath("/app");
  revalidatePath("/me");
  return { error: null };
}

// ── Recruiter outreach ──────────────────────────────────────────

export async function sendRecruiterOutreachAction(input: {
  playerId: string;
  subject: string;
  body: string;
}): Promise<{
  error: string | null;
  threadId?: string;
  reason?: "quota_exceeded" | "duplicate_outreach" | "player_not_claimed";
}> {
  if (!input.body.trim()) return { error: "Message can't be empty." };
  const rec = await getCurrentRecruiter();
  if (!rec) return { error: "Not a recruiter." };
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("send_recruiter_outreach", {
    _player_id: input.playerId,
    _subject: input.subject.trim() || "Recruiter interest",
    _body: input.body.trim(),
  });
  if (error) {
    const m = error.message ?? "";
    if (/quota_exceeded/.test(m))
      return {
        error:
          "You've used all your outreach messages for this month. Upgrade your plan to send more.",
        reason: "quota_exceeded",
      };
    if (/duplicate_outreach/.test(m))
      return {
        error: "You've already reached out to this player.",
        reason: "duplicate_outreach",
      };
    if (/player_not_claimed/.test(m))
      return {
        error:
          "This player hasn't claimed their Rostr profile yet. They'll be reachable once they do.",
        reason: "player_not_claimed",
      };
    return { error: m || "Couldn't send outreach." };
  }

  revalidatePath("/scout/outreach");
  return { error: null, threadId: data as string };
}

// ── Respond to outreach ────────────────────────────────────────

export async function respondToOutreachAction(
  threadId: string,
  decision: "accepted" | "declined",
): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("respond_to_outreach", {
    _thread_id: threadId,
    _decision: decision,
  });
  if (error) return { error: error.message };

  revalidatePath("/me/messages");
  revalidatePath(`/me/messages/${threadId}`);
  return { error: null };
}
