"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";
import { isDemoRequest, DEMO_GUARD_MESSAGE } from "@/lib/demo-guard";
import {
  isFeatureEnabled,
  featureDisabledMessage,
} from "@/lib/feature-flags";
import {
  requirePermission,
  PermissionDeniedError,
} from "@/lib/permissions/server";

/**
 * Server actions for the coach-side player-reported review surface
 * (/app/roster/[id]/reported).
 *
 * Why a separate file: keeps coach verification code adjacent to the
 * UI that calls it. The /me/profile actions are player-side (player
 * mutating their own row); these are coach-side (coach mutating a
 * column ON another user's player row).
 */

/**
 * verifyHighlightAction — coach vouches for a player-reported clip.
 *
 * Sets `verified_by_coach=true`, `verified_by=auth.uid()`, `verified_at=now()`
 * on the highlight row. Idempotent: re-verifying an already-verified
 * row is a no-op (still updates verified_at to the current timestamp
 * so we have a fresh "last reviewed" signal — useful when the coach
 * checks a clip after the player edited the caption).
 *
 * Guards (in order):
 *   1. Flag gate — NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES.
 *   2. Demo gate — never write from a demo session.
 *   3. Auth gate — getCurrentCoach() returns the calling coach.
 *   4. Program gate — the highlight's player must be in the coach's
 *      program. If not, return a generic "not found" string (don't
 *      reveal player IDs across programs). RLS is the second gate.
 *
 * After mutating, revalidates:
 *   - /app/roster/[id]/reported  (this page)
 *   - /p/[handle] for the player so the public profile picks up the
 *     verified badge on next render.
 */
export async function verifyHighlightAction(
  highlightId: string,
): Promise<{ error: string | null }> {
  // 1. Flag gate first — when off, this action does not function in
  //    production. Belt-and-suspenders with the route's requireFlag().
  if (!isFeatureEnabled("NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES")) {
    return {
      error: featureDisabledMessage(
        "NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES",
      ),
    };
  }
  // 2. Demo gate.
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  // 3. Validate input shape.
  if (!highlightId || typeof highlightId !== "string") {
    return { error: "Missing highlight id." };
  }

  // 4. Auth + role gate: caller must be a coach with the
  //    `verify_highlight` permission. Throws PermissionDeniedError
  //    if missing — caught below and returned as a clean error string
  //    so the client toast reads correctly.
  try {
    await requirePermission("verify_highlight");
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { error: e.message };
    }
    throw e;
  }
  const coach = await getCurrentCoach();
  if (!coach) return { error: "You must be signed in as a coach." };

  // 5. Program scope: load the highlight + its player's program_id and
  //    confirm it matches this coach's program. Fail with a generic
  //    "not found" so we never disclose the existence of player IDs in
  //    other programs.
  const supabase = createSupabaseServerClient();
  const { data: row, error: fetchErr } = await supabase
    .from("player_highlights")
    .select(
      "id, player_id, verified_by_coach, players!inner(id, program_id, profile_slug, first_name, last_name)",
    )
    .eq("id", highlightId)
    .maybeSingle();
  if (fetchErr || !row) {
    return { error: "Highlight not found." };
  }

  // Defensive normalize — Supabase returns the joined row as either an
  // object or a single-element array depending on FK direction.
  const playersField = (row as unknown as { players?: unknown }).players;
  const playerRow = (
    Array.isArray(playersField)
      ? (playersField[0] as
          | { program_id?: string | null; profile_slug?: string | null }
          | undefined)
      : (playersField as
          | { program_id?: string | null; profile_slug?: string | null }
          | undefined)
  ) ?? null;

  if (!playerRow || playerRow.program_id !== coach.program_id) {
    // Same opaque message — don't leak that the highlight exists in
    // another program.
    return { error: "Highlight not found." };
  }

  // 6. Mutate. We always stamp verified_by + verified_at so re-verifying
  //    refreshes the timestamp without needing a separate "re-vouch"
  //    code path.
  const { error: updErr } = await supabase
    .from("player_highlights")
    .update({
      verified_by_coach: true,
      verified_by: coach.user_id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", highlightId);

  if (updErr) {
    return { error: updErr.message };
  }

  // 7. Cache freshness.
  revalidatePath(`/app/roster/${row.player_id}/reported`);
  if (playerRow.profile_slug) {
    revalidatePath(`/p/${playerRow.profile_slug}`);
  }
  return { error: null };
}

/**
 * unverifyHighlightAction — coach removes their (or another coach's)
 * verification from a clip. Mirrors verifyHighlightAction's gates.
 *
 * Use case: a coach hit Verify on the wrong clip, or a clip is no
 * longer accurate (player edited the caption misleadingly, etc.).
 * After unverify the clip is back in player-reported land — the
 * player can delete or replace it again.
 *
 * Note: the migration-36 trigger explicitly allows coaches in the
 * player's program to UPDATE verified rows. This action runs as the
 * coach (per-request anon-key client + RLS coach policy) so the
 * trigger passes through.
 *
 * Idempotent: unverifying an already-unverified row is a no-op,
 * which we report as success because the desired end state holds.
 */
export async function unverifyHighlightAction(
  highlightId: string,
): Promise<{ error: string | null }> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES")) {
    return {
      error: featureDisabledMessage(
        "NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES",
      ),
    };
  }
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  if (!highlightId || typeof highlightId !== "string") {
    return { error: "Missing highlight id." };
  }

  try {
    await requirePermission("unverify_highlight");
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: e.message };
    throw e;
  }
  const coach = await getCurrentCoach();
  if (!coach) return { error: "You must be signed in as a coach." };

  const supabase = createSupabaseServerClient();
  const { data: row, error: fetchErr } = await supabase
    .from("player_highlights")
    .select(
      "id, player_id, players!inner(id, program_id, profile_slug)",
    )
    .eq("id", highlightId)
    .maybeSingle();
  if (fetchErr || !row) return { error: "Highlight not found." };

  const playersField = (row as unknown as { players?: unknown }).players;
  const playerRow = (
    Array.isArray(playersField)
      ? (playersField[0] as
          | { program_id?: string | null; profile_slug?: string | null }
          | undefined)
      : (playersField as
          | { program_id?: string | null; profile_slug?: string | null }
          | undefined)
  ) ?? null;

  if (!playerRow || playerRow.program_id !== coach.program_id) {
    return { error: "Highlight not found." };
  }

  const { error: updErr } = await supabase
    .from("player_highlights")
    .update({
      verified_by_coach: false,
      verified_by: null,
      verified_at: null,
    })
    .eq("id", highlightId);

  if (updErr) return { error: updErr.message };

  revalidatePath(`/app/roster/${row.player_id}/reported`);
  if (playerRow.profile_slug) {
    revalidatePath(`/p/${playerRow.profile_slug}`);
  }
  return { error: null };
}

/**
 * Internal helper: write the verification flag onto a single
 * prior_stats entry identified by `priorStatId`. Returns void on
 * success, throws on cross-program / not-found / mutation errors so
 * the calling action can return a uniform error string.
 *
 * Used by both verifyPriorStatAction + unverifyPriorStatAction.
 */
async function setPriorStatVerification({
  playerId,
  priorStatId,
  coachUserId,
  programId,
  setVerified,
}: {
  playerId: string;
  priorStatId: string;
  coachUserId: string;
  programId: string;
  setVerified: boolean;
}): Promise<{ error: string | null; profileSlug: string | null }> {
  const supabase = createSupabaseServerClient();

  // Load player row + verify program scope. 404 cross-program so
  // player IDs in other programs don't leak.
  const { data: player, error: playerErr } = await supabase
    .from("players")
    .select("id, program_id, profile_slug, prior_stats")
    .eq("id", playerId)
    .maybeSingle();
  if (playerErr || !player) {
    return { error: "Player not found.", profileSlug: null };
  }
  if (player.program_id !== programId) {
    return { error: "Player not found.", profileSlug: null };
  }

  const arr = Array.isArray(player.prior_stats)
    ? (player.prior_stats as Array<Record<string, unknown>>)
    : [];
  let touched = false;
  const next = arr.map((entry) => {
    if (typeof entry["id"] !== "string") return entry;
    if (entry["id"] !== priorStatId) return entry;
    touched = true;
    if (setVerified) {
      return {
        ...entry,
        verified_by_coach: true,
        verified_by: coachUserId,
        verified_at: new Date().toISOString(),
      };
    }
    return {
      ...entry,
      verified_by_coach: false,
      verified_by: null,
      verified_at: null,
    };
  });

  if (!touched) {
    return { error: "Prior season not found.", profileSlug: null };
  }

  const { error: updErr } = await supabase
    .from("players")
    .update({ prior_stats: next })
    .eq("id", playerId);

  if (updErr) {
    return { error: updErr.message, profileSlug: null };
  }
  return { error: null, profileSlug: player.profile_slug ?? null };
}

/**
 * verifyPriorStatAction — coach vouches for a single player-reported
 * prior-season row. Same gate stack as verifyHighlightAction
 * (flag → demo → coach auth → program scope check). Idempotent: if
 * the row is already verified, the timestamp updates but nothing else
 * changes.
 *
 * Identifies the row by its stable `id` (uuid string) backfilled by
 * migration 37. The trigger from migration 37 explicitly allows coach
 * writes — only blocks player attempts to mutate verified rows.
 */
export async function verifyPriorStatAction(
  playerId: string,
  priorStatId: string,
): Promise<{ error: string | null }> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES")) {
    return {
      error: featureDisabledMessage(
        "NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES",
      ),
    };
  }
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  if (!playerId || !priorStatId) {
    return { error: "Missing identifiers." };
  }

  try {
    await requirePermission("verify_prior_stat");
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: e.message };
    throw e;
  }
  const coach = await getCurrentCoach();
  if (!coach) return { error: "You must be signed in as a coach." };

  const res = await setPriorStatVerification({
    playerId,
    priorStatId,
    coachUserId: coach.user_id,
    programId: coach.program_id,
    setVerified: true,
  });
  if (res.error) return { error: res.error };

  revalidatePath(`/app/roster/${playerId}/reported`);
  if (res.profileSlug) revalidatePath(`/p/${res.profileSlug}`);
  return { error: null };
}

/**
 * unverifyPriorStatAction — coach removes verification from a single
 * prior-season row. Mirrors unverifyHighlightAction. Idempotent.
 */
export async function unverifyPriorStatAction(
  playerId: string,
  priorStatId: string,
): Promise<{ error: string | null }> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES")) {
    return {
      error: featureDisabledMessage(
        "NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES",
      ),
    };
  }
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  if (!playerId || !priorStatId) {
    return { error: "Missing identifiers." };
  }

  try {
    await requirePermission("unverify_prior_stat");
  } catch (e) {
    if (e instanceof PermissionDeniedError) return { error: e.message };
    throw e;
  }
  const coach = await getCurrentCoach();
  if (!coach) return { error: "You must be signed in as a coach." };

  const res = await setPriorStatVerification({
    playerId,
    priorStatId,
    coachUserId: coach.user_id,
    programId: coach.program_id,
    setVerified: false,
  });
  if (res.error) return { error: res.error };

  revalidatePath(`/app/roster/${playerId}/reported`);
  if (res.profileSlug) revalidatePath(`/p/${res.profileSlug}`);
  return { error: null };
}
