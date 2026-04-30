"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoRequest, DEMO_GUARD_MESSAGE } from "@/lib/demo-guard";
import { isFeatureEnabled, featureDisabledMessage } from "@/lib/feature-flags";

/**
 * Server actions for the player-facing profile editor at /me/profile.
 *
 * Authorization model: each action verifies the auth.uid() matches the
 * player row's `claimed_by_user_id` BEFORE writing. RLS provides a
 * defence-in-depth gate (migration 30 policy `players_manage_own_highlights`
 * and the existing player self-update policy) but the explicit check
 * gives friendlier error messages than RLS row-counts of zero.
 *
 * Demo guard: the demo /me flow is read-only for prospects today, so
 * mutations short-circuit with the standard "this is a demo" toast.
 */

const academicsSchema = z.object({
  gpa: z
    .string()
    .trim()
    .max(8, "GPA must be 8 characters or fewer")
    .optional()
    .nullable(),
  satScore: z
    .number()
    .int()
    .min(400, "SAT score must be 400+")
    .max(1600, "SAT score max is 1600")
    .optional()
    .nullable(),
  actScore: z
    .number()
    .int()
    .min(1, "ACT score must be 1+")
    .max(36, "ACT score max is 36")
    .optional()
    .nullable(),
  classRankNumerator: z
    .number()
    .int()
    .positive("Class rank must be > 0")
    .max(100000)
    .optional()
    .nullable(),
  classRankDenominator: z
    .number()
    .int()
    .positive("Class size must be > 0")
    .max(100000)
    .optional()
    .nullable(),
  intendedLevel: z
    .enum(["D1", "D2", "D3", "NAIA", "Juco", "Open", "Other"])
    .optional()
    .nullable(),
  bio: z
    .string()
    .trim()
    .max(500, "Bio max is 500 characters")
    .optional()
    .nullable(),
});

export interface UpdateAcademicsInput {
  gpa?: string | null;
  satScore?: number | null;
  actScore?: number | null;
  classRankNumerator?: number | null;
  classRankDenominator?: number | null;
  intendedLevel?: "D1" | "D2" | "D3" | "NAIA" | "Juco" | "Open" | "Other" | null;
  bio?: string | null;
}

export async function updateAcademicsAction(
  input: UpdateAcademicsInput,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };

  const parsed = academicsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Cross-field check: rank numerator <= denominator (also enforced by
  // the DB CHECK constraint, but better message here).
  if (
    parsed.data.classRankNumerator != null &&
    parsed.data.classRankDenominator != null &&
    parsed.data.classRankNumerator > parsed.data.classRankDenominator
  ) {
    return { error: "Class rank can't exceed class size." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Find this user's player row.
  const { data: player, error: playerErr } = await supabase
    .from("players")
    .select("id")
    .eq("claimed_by_user_id", user.id)
    .maybeSingle();
  if (playerErr || !player) {
    return { error: "No claimed player profile found." };
  }

  const { error: updErr } = await supabase
    .from("players")
    .update({
      gpa: parsed.data.gpa ?? null,
      sat_score: parsed.data.satScore ?? null,
      act_score: parsed.data.actScore ?? null,
      class_rank_numerator: parsed.data.classRankNumerator ?? null,
      class_rank_denominator: parsed.data.classRankDenominator ?? null,
      intended_level: parsed.data.intendedLevel ?? null,
      bio: parsed.data.bio ?? null,
    })
    .eq("id", player.id);

  if (updErr) return { error: updErr.message };

  revalidatePath("/me");
  revalidatePath("/me/profile");
  // Public profile cache also needs a kick if the player has a slug.
  return { error: null };
}

const mediaSchema = z.object({
  avatarUrl: z.string().url().or(z.literal("")).optional().nullable(),
  headerUrl: z.string().url().or(z.literal("")).optional().nullable(),
  schoolLogoUrl: z.string().url().or(z.literal("")).optional().nullable(),
});

export interface UpdateMediaInput {
  avatarUrl?: string | null;
  headerUrl?: string | null;
  schoolLogoUrl?: string | null;
}

/**
 * Updates the player's avatar / header / school-logo URLs.
 *
 * Why URL-not-upload (for now): the v1 player editor accepts plain
 * URLs (Imgur, Cloudinary, public Supabase-storage links). Coach
 * uploads a real image-picker later — for now, a paste-a-URL field
 * is dramatically simpler and sidesteps blob-storage RLS work.
 */
export async function updateMediaAction(
  input: UpdateMediaInput,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };

  const parsed = mediaSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid URL." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id")
    .eq("claimed_by_user_id", user.id)
    .maybeSingle();
  if (pErr || !player) return { error: "No claimed player profile found." };

  // Empty string → null. Real null skips the column.
  const blanks = (v?: string | null) => (v == null || v === "" ? null : v);
  const { error: updErr } = await supabase
    .from("players")
    .update({
      avatar_url: blanks(parsed.data.avatarUrl),
      header_url: blanks(parsed.data.headerUrl),
      school_logo_url: blanks(parsed.data.schoolLogoUrl),
    })
    .eq("id", player.id);

  if (updErr) return { error: updErr.message };

  revalidatePath("/me");
  revalidatePath("/me/profile");
  return { error: null };
}

const highlightSchema = z.object({
  url: z.string().trim().url("Highlight URL must be a valid URL."),
  caption: z.string().trim().max(120, "Caption max is 120 chars").optional().nullable(),
});

export interface AddHighlightInput {
  url: string;
  caption?: string | null;
}

export async function addHighlightAction(
  input: AddHighlightInput,
): Promise<{ error: string | null; id?: string }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };

  const parsed = highlightSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id")
    .eq("claimed_by_user_id", user.id)
    .maybeSingle();
  if (pErr || !player) return { error: "No claimed player profile found." };

  // Find the current max sort_order so the new clip goes to the bottom.
  const { data: existing } = await supabase
    .from("player_highlights")
    .select("sort_order")
    .eq("player_id", player.id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error: insErr } = await supabase
    .from("player_highlights")
    .insert({
      player_id: player.id,
      url: parsed.data.url,
      caption: parsed.data.caption ?? null,
      sort_order: nextOrder,
    })
    .select("id")
    .single();

  if (insErr) return { error: insErr.message };

  revalidatePath("/me/profile");
  return { error: null, id: data?.id };
}

export async function removeHighlightAction(
  highlightId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  if (!highlightId) return { error: "Missing highlight id." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Get the highlight's player and verify ownership.
  const { data: row, error: rErr } = await supabase
    .from("player_highlights")
    .select("id, player_id, players!inner(claimed_by_user_id)")
    .eq("id", highlightId)
    .maybeSingle();
  if (rErr || !row) return { error: "Highlight not found." };

  // The join shape uses the related-row name as the property — Supabase
  // returns players as either a single object or an array depending on
  // FK direction + cardinality. Defensively normalize via `unknown`
  // cast then narrow.
  const playersField = (row as unknown as { players?: unknown }).players;
  const owner = Array.isArray(playersField)
    ? ((playersField[0] as { claimed_by_user_id?: string | null } | undefined)?.claimed_by_user_id ?? null)
    : ((playersField as { claimed_by_user_id?: string | null } | undefined)?.claimed_by_user_id ?? null);
  if (owner !== user.id) return { error: "Not allowed." };

  const { error: delErr } = await supabase
    .from("player_highlights")
    .delete()
    .eq("id", highlightId);
  if (delErr) return { error: delErr.message };

  revalidatePath("/me/profile");
  return { error: null };
}

/**
 * Reorder a player's highlights by passing the full ordered list of
 * IDs. Each row's sort_order is set to its index in the array.
 *
 * Trade-off: simple to call from the client (drag-end → submit array),
 * but issues N updates. For the typical 2–6 clips, that's fine. If
 * we ever ship hundreds, switch to a single batched UPDATE FROM (VALUES).
 */
export async function reorderHighlightsAction(
  orderedIds: string[],
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { error: "No highlights to reorder." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Verify all highlights belong to this user's player.
  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id")
    .eq("claimed_by_user_id", user.id)
    .maybeSingle();
  if (pErr || !player) return { error: "No claimed player profile found." };

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    if (!id) continue;
    await supabase
      .from("player_highlights")
      .update({ sort_order: i })
      .eq("id", id)
      .eq("player_id", player.id);
  }

  revalidatePath("/me/profile");
  return { error: null };
}

// ── Contact info (migration 35) ─────────────────────────────────

/**
 * Lenient validators. We keep them soft because:
 *   - email: kids use weird "main" addresses; trim + length cap only.
 *   - phone: free-form, length cap.
 *   - social handles: accept "@handle", "handle", or full URL — render
 *     layer normalizes to a clickable link.
 *
 * Defense-in-depth: input shape is fixed (8 known fields) so no
 * arbitrary keys land in the JSONB column. RLS limits writes to the
 * player's own row.
 */
const contactInfoSchema = z.object({
  email: z.string().trim().max(120).nullable(),
  phone: z.string().trim().max(40).nullable(),
  twitter: z.string().trim().max(60).nullable(),
  instagram: z.string().trim().max(60).nullable(),
  tiktok: z.string().trim().max(60).nullable(),
  youtube: z.string().trim().max(200).nullable(),
  x: z.string().trim().max(60).nullable(),
  website: z.string().trim().max(200).nullable(),
});

export interface UpdateContactInfoInput {
  email: string | null;
  phone: string | null;
  twitter: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  x: string | null;
  website: string | null;
}

/**
 * updateContactInfoAction — update the player's public contact + social
 * handles.
 *
 * Flag-gated: requires NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES.
 * Visibility of saved data is ALSO gated by show_contact_info on the
 * public profile (migration 30) — so saving here doesn't expose anything
 * by itself. Two switches must align.
 */
export async function updateContactInfoAction(
  input: UpdateContactInfoInput,
): Promise<{ error: string | null }> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES")) {
    return {
      error: featureDisabledMessage(
        "NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES",
      ),
    };
  }
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };

  const parsed = contactInfoSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Empty string → null for clean JSONB storage.
  const blanks = (v: string | null) =>
    v == null || v.trim() === "" ? null : v.trim();
  const cleaned: Record<string, string | null> = {
    email: blanks(parsed.data.email),
    phone: blanks(parsed.data.phone),
    twitter: blanks(parsed.data.twitter),
    instagram: blanks(parsed.data.instagram),
    tiktok: blanks(parsed.data.tiktok),
    youtube: blanks(parsed.data.youtube),
    x: blanks(parsed.data.x),
    website: blanks(parsed.data.website),
  };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id")
    .eq("claimed_by_user_id", user.id)
    .maybeSingle();
  if (pErr || !player) return { error: "No claimed player profile found." };

  const { error: updErr } = await supabase
    .from("players")
    .update({ contact_info: cleaned })
    .eq("id", player.id);

  if (updErr) return { error: updErr.message };

  revalidatePath("/me");
  revalidatePath("/me/profile");
  return { error: null };
}

// ── Privacy switches (migration 34) ─────────────────────────────

const privacySchema = z.object({
  profilePublic: z.boolean(),
  showAcademics: z.boolean(),
  showContactInfo: z.boolean(),
});

export interface UpdatePrivacyInput {
  profilePublic: boolean;
  showAcademics: boolean;
  showContactInfo: boolean;
}

/**
 * updatePrivacyAction — flip the three per-profile visibility switches.
 *
 * profilePublic:    required for /p/<handle> to render at all
 * showAcademics:    required for the academics card to render publicly
 * showContactInfo:  required for phone / email / socials to render
 *
 * All default false. The /p/<handle> page reads them server-side and
 * conditionally renders. Migration 33 also enforces profile_public at
 * the player_search view level for defense-in-depth.
 */
export async function updatePrivacyAction(
  input: UpdatePrivacyInput,
): Promise<{ error: string | null }> {
  // Flag gate — the per-field privacy switches UI is part of the
  // advanced player profiles module. Defense-in-depth in case a
  // UI bug exposes this action callsite while the flag is off.
  if (!isFeatureEnabled("NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES")) {
    return { error: featureDisabledMessage("NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES") };
  }
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const parsed = privacySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id")
    .eq("claimed_by_user_id", user.id)
    .maybeSingle();
  if (pErr || !player) return { error: "No claimed player profile found." };

  const { error: updErr } = await supabase
    .from("players")
    .update({
      profile_public: parsed.data.profilePublic,
      show_academics: parsed.data.showAcademics,
      show_contact_info: parsed.data.showContactInfo,
    })
    .eq("id", player.id);

  if (updErr) return { error: updErr.message };

  revalidatePath("/me");
  revalidatePath("/me/profile");
  return { error: null };
}

// ── Prior stats (migration 34) ──────────────────────────────────

const priorStatSchema = z.object({
  season: z.string().trim().min(1, "Season is required").max(40),
  level: z.string().trim().max(40).nullable(),
  ba: z.string().trim().max(20).nullable(),
  ops: z.string().trim().max(20).nullable(),
  hr: z.string().trim().max(20).nullable(),
  rbi: z.string().trim().max(20).nullable(),
  pitching: z.string().trim().max(120).nullable(),
  context: z.string().trim().max(200).nullable(),
});

const priorStatsArraySchema = z
  .array(priorStatSchema)
  .max(10, "Up to 10 prior seasons");

export interface PriorStatInput {
  season: string;
  level: string | null;
  ba: string | null;
  ops: string | null;
  hr: string | null;
  rbi: string | null;
  pitching: string | null;
  context: string | null;
}

/**
 * updatePriorStatsAction — replace the entire prior-stats array.
 *
 * Player-reported career stats. Always rendered under a "Player
 * Reported" header on the public profile — never mixed with verified
 * game stats. We replace-not-append because the editor is a what-
 * you-see-is-what-you-save list; partial updates would be confusing.
 * The whole list lives in a single JSONB column on `players` (no
 * separate table needed for v1).
 */
export async function updatePriorStatsAction(
  input: PriorStatInput[],
): Promise<{ error: string | null }> {
  // Flag gate — player-reported stats are gated by both the
  // advanced-profile flag (parent module) and the self-reported-
  // stats sub-flag. Both must be on.
  if (
    !isFeatureEnabled("NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES") ||
    !isFeatureEnabled("NEXT_PUBLIC_ENABLE_PLAYER_SELF_REPORTED_STATS")
  ) {
    return {
      error: featureDisabledMessage("NEXT_PUBLIC_ENABLE_PLAYER_SELF_REPORTED_STATS"),
    };
  }
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const parsed = priorStatsArraySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id")
    .eq("claimed_by_user_id", user.id)
    .maybeSingle();
  if (pErr || !player) return { error: "No claimed player profile found." };

  const { error: updErr } = await supabase
    .from("players")
    .update({ prior_stats: parsed.data })
    .eq("id", player.id);

  if (updErr) return { error: updErr.message };

  revalidatePath("/me/profile");
  return { error: null };
}
