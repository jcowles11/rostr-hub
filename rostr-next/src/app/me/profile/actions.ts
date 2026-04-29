"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoRequest, DEMO_GUARD_MESSAGE } from "@/lib/demo-guard";

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
