import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Player profile extras: media (avatar/header/video), commitment status,
 * and announcement feed. All fields land on the public /p/[handle]
 * profile and on the coach-facing roster.
 *
 * Types live in `./player-profile-types` (framework-free) so client
 * components can import them without dragging `next/headers` along.
 */

// Re-export the public types so existing callers keep working without
// having to update import paths.
export type {
  PlayerProfileMedia,
  PlayerAcademics,
  PlayerHighlight,
  PlayerAnnouncement,
  PlayerPrivacy,
  PlayerPriorStat,
  IntendedLevel,
  VideoEmbed,
} from "./player-profile-types";
export { resolveVideoEmbed } from "./player-profile-types";

import type {
  PlayerAcademics,
  PlayerHighlight,
  PlayerProfileMedia,
  IntendedLevel,
  PlayerAnnouncement,
  PlayerPrivacy,
  PlayerPriorStat,
} from "./player-profile-types";

/**
 * Reads the academic / recruiting block. Used by both the player's
 * own /me/profile editor and the public /p/[handle] page (which
 * application-layer-gates contact-info visibility on `show_contact_info`).
 */
export async function fetchPlayerAcademics(
  playerId: string,
): Promise<PlayerAcademics | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select(
      "gpa, sat_score, act_score, class_rank_numerator, class_rank_denominator, intended_level, school_logo_url, bio",
    )
    .eq("id", playerId)
    .maybeSingle();
  if (error || !data) {
    // Migration-resilience: if any new column doesn't exist (e.g. the
    // /demo path or a stale env), fall back to nulls instead of erroring.
    if (error && /column .* does not exist/i.test(error.message)) {
      return {
        gpa: null,
        satScore: null,
        actScore: null,
        classRankNumerator: null,
        classRankDenominator: null,
        intendedLevel: null,
        schoolLogoUrl: null,
        bio: null,
      };
    }
    return null;
  }
  return {
    gpa: data.gpa ?? null,
    satScore: data.sat_score ?? null,
    actScore: data.act_score ?? null,
    classRankNumerator: data.class_rank_numerator ?? null,
    classRankDenominator: data.class_rank_denominator ?? null,
    intendedLevel: (data.intended_level ?? null) as IntendedLevel | null,
    schoolLogoUrl: data.school_logo_url ?? null,
    bio: data.bio ?? null,
  };
}

/**
 * Reads all highlight rows for a player, ordered by sort_order asc.
 * Empty array on error — callers handle the empty-state UI.
 */
export async function fetchPlayerHighlights(
  playerId: string,
): Promise<PlayerHighlight[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("player_highlights")
    .select("id, player_id, url, caption, thumbnail_url, sort_order, created_at")
    .eq("player_id", playerId)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    url: r.url,
    caption: r.caption,
    thumbnailUrl: r.thumbnail_url,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }));
}

export async function fetchPlayerProfileMedia(
  playerId: string,
): Promise<PlayerProfileMedia | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select(
      "avatar_url, header_url, highlight_video_url, commitment_status, commitment_school, commitment_year, commitment_note",
    )
    .eq("id", playerId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    avatarUrl: data.avatar_url ?? null,
    headerUrl: data.header_url ?? null,
    highlightVideoUrl: data.highlight_video_url ?? null,
    commitmentStatus: (data.commitment_status ?? null) as
      | PlayerProfileMedia["commitmentStatus"],
    commitmentSchool: data.commitment_school ?? null,
    commitmentYear: data.commitment_year ?? null,
    commitmentNote: data.commitment_note ?? null,
  };
}

export async function fetchPlayerAnnouncements(
  playerId: string,
  limit = 20,
): Promise<PlayerAnnouncement[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("player_announcements")
    .select(
      "id, player_id, posted_by, kind, title, body, image_url, link_url, pinned, created_at",
    )
    .eq("player_id", playerId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    postedBy: r.posted_by,
    kind: r.kind as PlayerAnnouncement["kind"],
    title: r.title,
    body: r.body,
    imageUrl: r.image_url,
    linkUrl: r.link_url,
    pinned: r.pinned,
    createdAt: r.created_at,
  }));
}

/**
 * Privacy switches (migration 34). Always returns sensible defaults
 * (everything OFF) on missing-row / column-not-found so the public
 * profile defaults to the most private state when data is missing.
 */
export async function fetchPlayerPrivacy(
  playerId: string,
): Promise<PlayerPrivacy> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("profile_public, show_academics, show_contact_info")
    .eq("id", playerId)
    .maybeSingle();
  if (error || !data) {
    // Migration-resilient: missing column → default everything off.
    return { profilePublic: false, showAcademics: false, showContactInfo: false };
  }
  return {
    profilePublic: Boolean(data.profile_public),
    showAcademics: Boolean(data.show_academics),
    showContactInfo: Boolean(data.show_contact_info),
  };
}

/**
 * Player-reported prior season stats (migration 34, JSONB array).
 * Always returns an array so the caller can map without null-check.
 */
export async function fetchPlayerPriorStats(
  playerId: string,
): Promise<PlayerPriorStat[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("prior_stats")
    .eq("id", playerId)
    .maybeSingle();
  if (error || !data) return [];
  const raw = data.prior_stats;
  if (!Array.isArray(raw)) return [];
  // Normalize each row — defensive against historic shapes / typos.
  return raw.map((r): PlayerPriorStat => {
    const o = (r ?? {}) as Record<string, unknown>;
    const s = (k: string): string | null => {
      const v = o[k];
      if (v == null) return null;
      const t = String(v).trim();
      return t === "" ? null : t;
    };
    return {
      season: s("season") ?? "",
      level: s("level"),
      ba: s("ba"),
      ops: s("ops"),
      hr: s("hr"),
      rbi: s("rbi"),
      pitching: s("pitching"),
      context: s("context"),
    };
  });
}

// resolveVideoEmbed and VideoEmbed are now sourced from
// ./player-profile-types so client components can use them too.
