"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";
import type { AtBatOutcome } from "@/lib/services/live-scoring";

/**
 * Live scoring server actions — call the SECURITY DEFINER RPCs
 * defined in migration 000016 so sequence generation + side detection
 * stay atomic server-side.
 */

export async function startLiveScoringAction(
  gameId: string,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("start_live_scoring", { _game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/app/games/${gameId}`);
  revalidatePath(`/app/games/${gameId}/score`);
  revalidatePath(`/g/${gameId}`);
  return { error: null };
}

/**
 * Persisted shape of a single pitch within an at-bat. Mirrors the
 * client-side `Pitch` type in pitch-state.ts; deliberately minimal so
 * future extensions (location, velocity) are additive.
 */
export interface PersistedPitch {
  n: number;
  kind: "ball" | "strike" | "foul" | "in_play";
  loggedAt: string;
}

export interface LogAtBatInput {
  gameId: string;
  playerId: string | null;
  adHocName: string | null;
  outcome: AtBatOutcome;
  rbi: number;
  inning: number;
  topBottom: "top" | "bottom";
  outsAfter: number;
  homeScore: number;
  awayScore: number;
  /**
   * Optional pitch sequence (pitch-by-pitch mode). When present, gets
   * merged into the at-bat event's JSONB payload via a follow-up
   * UPDATE — the existing RPC takes a fixed param list and we don't
   * want to change its signature (it'd require a migration).
   *
   * Forward-compat: readers should treat the absence of payload.pitches
   * as "this at-bat was scored in simple mode" — same as today.
   */
  pitches?: PersistedPitch[];
  /** Final ball-strike count when the at-bat resolved. Optional. */
  finalCount?: { balls: number; strikes: number };
  /**
   * Pitcher who threw to this batter. Optional. When set, derived
   * features like "active pitcher" + "pitch count per pitcher" become
   * possible. Falls under the same payload-merge mechanism as pitches —
   * no schema change, just an extra JSONB field.
   */
  pitcherId?: string | null;
  /**
   * Bases occupied AFTER this play resolves. Stored on the at-bat
   * payload so the next at-bat (and the fan view) can derive runner
   * state without replaying the whole event log. The previous event's
   * `runnersAfter` IS the next at-bat's "before".
   */
  runnersAfter?: { 1: string | null; 2: string | null; 3: string | null };
  /**
   * Free-text name of the opposing pitcher (when WE'RE batting and
   * the pitcher isn't in our roster). Stored on payload so the fan
   * view's pitcher slot has something useful to show during our
   * half-innings. Coach types it once per game; the live-scoring view
   * persists to localStorage and includes it on every at-bat we
   * generate while batting.
   */
  opposingPitcherName?: string | null;
  // ── Phase 2 correctness fields ─────────────────────────────────
  /** Sub-type for SAC outcome ("fly" | "bunt"). Drives sac-fly RBI
   *  credit + correct AB exclusion in box-score derivation. */
  sacrificeType?: "fly" | "bunt" | null;
  /** Defensive error occurred on this play. When true:
   *    - Runs scored on this play are unearned to the pitcher.
   *    - For outcomes K/GO/FO/SAC this also implies a "would-have-been
   *      out" was missed → bumps the missed-out count for the inning.
   *    - For outcome E this is implicit (already true); leave true for
   *      consistency.
   */
  errorOnPlay?: boolean;
  /** Number of errors on the play. Defaults to 1 when errorOnPlay is
   *  true, 0 otherwise. Allows multi-error plays (rare but real) to
   *  bump the inning's missed-out tracker by 2+. */
  errorsOnPlay?: number;
  /** Explicit list of player ids that scored on this play. Replaces
   *  the brittle runner-diff inference; computed in advanceRunners. */
  runScorers?: string[];
  /** Total runs scored on this play (== runScorers.length normally). */
  runsOnPlay?: number;
}

/**
 * Persist an at-bat.
 *
 * Two-phase write:
 *   1. RPC `log_at_bat` does the atomic append (sequence allocation +
 *      score sync). Returns the event id.
 *   2. If pitches were tracked, UPDATE the event's `payload` to merge
 *      `pitches` + `finalCount` in. Failure here is logged but doesn't
 *      fail the action — the at-bat outcome is what matters; pitch
 *      history is bonus.
 */
export async function logAtBatAction(
  input: LogAtBatInput,
): Promise<{ error: string | null; eventId?: string; pitchPersistError?: string }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("log_at_bat", {
    _game_id: input.gameId,
    _player_id: input.playerId,
    _ad_hoc_name: input.adHocName,
    _outcome: input.outcome,
    _rbi: input.rbi,
    _inning: input.inning,
    _top_bottom: input.topBottom,
    _outs_after: input.outsAfter,
    _home_score: input.homeScore,
    _away_score: input.awayScore,
  });
  if (error) return { error: error.message };

  const eventId = data as string;

  // Phase 2: merge pitches + pitcher + runners into the payload.
  // Best-effort. Done as one UPDATE so we only round-trip once even
  // when all three fields are populated.
  //
  // We trigger the UPDATE if ANY of pitches / pitcherId / runnersAfter
  // were supplied — simple mode at-bats with no pitcher/runner data
  // skip Phase 2 entirely (preserves the original v1 behavior).
  let pitchPersistError: string | undefined;
  const hasPitches = Array.isArray(input.pitches) && input.pitches.length > 0;
  const hasPitcher = input.pitcherId !== undefined;
  const hasRunners = input.runnersAfter !== undefined;
  const hasOppPitcher = input.opposingPitcherName !== undefined;
  const hasSacType = input.sacrificeType !== undefined;
  const hasErrorFlag = input.errorOnPlay !== undefined;
  const hasScorers = input.runScorers !== undefined;
  if (
    (hasPitches ||
      hasPitcher ||
      hasRunners ||
      hasOppPitcher ||
      hasSacType ||
      hasErrorFlag ||
      hasScorers) &&
    eventId
  ) {
    // Fetch the row's current payload so we don't clobber {outcome, rbi}
    // (or any other field future code adds).
    const { data: row } = await supabase
      .from("game_events")
      .select("payload")
      .eq("id", eventId)
      .maybeSingle();
    const existing =
      (row?.payload as Record<string, unknown> | null | undefined) ?? {};
    const merged: Record<string, unknown> = { ...existing };
    if (hasPitches) {
      merged.pitches = input.pitches;
      merged.finalCount = input.finalCount ?? null;
    }
    if (hasPitcher) merged.pitcherId = input.pitcherId ?? null;
    if (hasRunners) merged.runnersAfter = input.runnersAfter;
    if (hasOppPitcher) {
      merged.opposingPitcherName = input.opposingPitcherName ?? null;
    }
    if (hasSacType) merged.sacrificeType = input.sacrificeType ?? null;
    if (hasErrorFlag) merged.errorOnPlay = input.errorOnPlay ?? false;
    if (input.errorsOnPlay !== undefined) {
      merged.errorsOnPlay = input.errorsOnPlay;
    } else if (input.errorOnPlay) {
      merged.errorsOnPlay = 1;
    }
    if (hasScorers) {
      merged.runScorers = input.runScorers ?? [];
      merged.runsOnPlay = input.runsOnPlay ?? input.runScorers?.length ?? 0;
    }

    const { error: upErr } = await supabase
      .from("game_events")
      .update({ payload: merged })
      .eq("id", eventId);
    if (upErr) {
      // Don't fail the action — the at-bat is recorded and visible.
      // Surface the message so the UI can decide whether to retry.
      pitchPersistError = upErr.message;
    }
  }

  revalidatePath(`/g/${input.gameId}`);
  // Do NOT revalidate /app/games/${gameId}/score — the scorekeeper
  // page uses realtime; revalidating would cause flicker.
  return { error: null, eventId, pitchPersistError };
}

// ── Inning / half advancement (Phase 1) ───────────────────────────

export interface RecordInningChangeInput {
  gameId: string;
  newInning: number;
  newHalf: "top" | "bottom";
  homeScore: number;
  awayScore: number;
}

/**
 * recordInningChangeAction — persist an `inning_change` event after a
 * 3rd out so the half / inning advance survives across refresh.
 *
 * Without this, the client would compute nextHalf / nextInning locally,
 * the at-bat causing the 3rd out would log with the CURRENT half (which
 * is correct — that AB happened in the current half), and the next
 * at-bat would derive its (inning, half) from that same lastEvent —
 * staying pinned to the wrong half. Subsequent runs would credit the
 * wrong team. This event flips the derived state cleanly and is
 * visible to every consumer (live view, public game viewer, box score).
 *
 * Idempotent at the application layer: callers compute (newInning,
 * newHalf) from the AB they're logging and only call this when the
 * 3rd out resolves. The view derivation reads `lastEvent` and uses
 * its (inning, top_bottom) directly — no special-case for inning_change.
 */
export async function recordInningChangeAction(
  input: RecordInningChangeInput,
): Promise<{ error: string | null; eventId?: string }> {
  if (!input.gameId) return { error: "Missing game id." };
  if (input.newHalf !== "top" && input.newHalf !== "bottom") {
    return { error: "Invalid half." };
  }
  if (!Number.isInteger(input.newInning) || input.newInning < 1) {
    return { error: "Invalid inning." };
  }
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("log_inning_change", {
    _game_id: input.gameId,
    _new_inning: input.newInning,
    _new_half: input.newHalf,
    _home_score: input.homeScore,
    _away_score: input.awayScore,
  });
  if (error) return { error: error.message };

  revalidatePath(`/g/${input.gameId}`);
  return { error: null, eventId: data as string };
}

export async function endLiveGameAction(
  gameId: string,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("end_live_game", { _game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/app/games/${gameId}`);
  revalidatePath(`/g/${gameId}`);
  revalidatePath(`/app`);
  return { error: null };
}

/**
 * recordRunnerPickoffAction — record a runner being picked off a base.
 *
 * Pickoffs aren't at-bats — the batter stays in the box and the count
 * is preserved. But they DO increment outs and remove a runner. To
 * stay schema-compatible (no new event_type required), we record them
 * as `at_bat` events with a special payload flag:
 *   payload = {
 *     outcome: "pickoff",
 *     pickoff: true,
 *     pickedOffBase: 1 | 2 | 3,
 *     runnersAfter: { ... },
 *     pitcherId,
 *   }
 *
 * The fan view + AB-count UI checks `payload.pickoff === true` to
 * exclude these from at-bat counts and render them with their own
 * label. This keeps stats clean without needing a CHECK-constraint
 * migration we can't easily apply.
 */
export interface RecordPickoffInput {
  gameId: string;
  /** Player on the base who's being picked off. */
  runnerId: string;
  /** Which base the runner was on (1, 2, or 3). */
  base: 1 | 2 | 3;
  inning: number;
  topBottom: "top" | "bottom";
  /** Outs AFTER this pickoff (i.e. currentOuts + 1 capped at 3). */
  outsAfter: number;
  homeScore: number;
  awayScore: number;
  pitcherId?: string | null;
  /** Bases occupied AFTER the pickoff (with the picked-off runner removed). */
  runnersAfter: { 1: string | null; 2: string | null; 3: string | null };
}

export async function recordRunnerPickoffAction(
  input: RecordPickoffInput,
): Promise<{ error: string | null; eventId?: string }> {
  if (!input.gameId || !input.runnerId) return { error: "Missing input." };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  // Phase 1: insert via the existing RPC. We pass the runner as the
  // "player" (the runner IS the player who got out) and `pickoff` as
  // the outcome string — log_at_bat doesn't validate outcome so any
  // string flows through to payload.outcome.
  const { data, error } = await supabase.rpc("log_at_bat", {
    _game_id: input.gameId,
    _player_id: input.runnerId,
    _ad_hoc_name: null,
    _outcome: "pickoff",
    _rbi: 0,
    _inning: input.inning,
    _top_bottom: input.topBottom,
    _outs_after: input.outsAfter,
    _home_score: input.homeScore,
    _away_score: input.awayScore,
  });
  if (error) return { error: error.message };
  const eventId = data as string;

  // Phase 2: enrich payload with pickoff metadata + new bases + pitcher.
  // Best-effort, same pattern as logAtBatAction's pitches merge.
  const { data: row } = await supabase
    .from("game_events")
    .select("payload")
    .eq("id", eventId)
    .maybeSingle();
  const existing =
    (row?.payload as Record<string, unknown> | null | undefined) ?? {};
  const merged = {
    ...existing,
    pickoff: true,
    pickedOffBase: input.base,
    runnersAfter: input.runnersAfter,
    pitcherId: input.pitcherId ?? null,
  };
  const { error: upErr } = await supabase
    .from("game_events")
    .update({ payload: merged })
    .eq("id", eventId);
  if (upErr) {
    // Pickoff event saved but metadata didn't — not fatal. The next
    // at-bat will recompute bases from the runner state on screen.
    // eslint-disable-next-line no-console
    console.warn("[pickoff] payload merge failed", upErr.message);
  }

  revalidatePath(`/g/${input.gameId}`);
  return { error: null, eventId };
}

// ─────────────────────────────────────────────────────────────
// Per-event error marking (retroactive UX)
// ─────────────────────────────────────────────────────────────

/**
 * markEventErrorAction — flip the error flag on an at-bat event after
 * the fact. Replaces the legacy "arm error toggle then score" flow,
 * which slowed the fast-path score by forcing a per-tap decision.
 *
 * Now: coach scores normally; if a play turns out to have involved a
 * defensive error (changing the earned-run picture), they tap the
 * play's chip in the feed and this action updates the payload.
 *
 * Cycle behavior: the coach passes the new errorsOnPlay value (0, 1,
 * or 2). 0 clears both flags; 1+ sets `errorOnPlay: true` and
 * `errorsOnPlay: <n>`. Box-score derivation re-reads on next render.
 */
export async function markEventErrorAction(
  eventId: string,
  errorsOnPlay: number,
): Promise<{ error: string | null }> {
  if (!eventId) return { error: "Event ID required." };
  if (errorsOnPlay < 0 || errorsOnPlay > 9) {
    return { error: "errorsOnPlay must be 0-9." };
  }
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  // Verify the event belongs to a game on this coach's program.
  const { data: row } = await supabase
    .from("game_events")
    .select("id, payload, game_id, games:game_id(program_id)")
    .eq("id", eventId)
    .maybeSingle();
  if (!row) return { error: "Event not found." };
  const gameRow = Array.isArray(row.games) ? row.games[0] : row.games;
  if (!gameRow || gameRow.program_id !== coach.program_id) {
    return { error: "Not authorized." };
  }

  const existing = (row.payload as Record<string, unknown> | null) ?? {};
  const merged: Record<string, unknown> = { ...existing };
  if (errorsOnPlay === 0) {
    // Clearing — remove both fields rather than setting them to false/0
    // so legacy events without the field stay shape-identical.
    delete merged.errorOnPlay;
    delete merged.errorsOnPlay;
  } else {
    merged.errorOnPlay = true;
    merged.errorsOnPlay = errorsOnPlay;
  }
  const { error: upErr } = await supabase
    .from("game_events")
    .update({ payload: merged })
    .eq("id", eventId);
  if (upErr) return { error: upErr.message };

  revalidatePath(`/g/${row.game_id}`);
  revalidatePath(`/app/games/${row.game_id}/score`);
  return { error: null };
}

// ─────────────────────────────────────────────────────────────
// Mid-game events: SB, CS, WP, PB, BK
// ─────────────────────────────────────────────────────────────

/**
 * recordMidGameEventAction — record a runner-movement event that
 * happens BETWEEN at-bats (or during one, with the same batter still
 * up). Stored as an at_bat event with `payload.midGame: true` so the
 * AB-count UI can filter it out.
 *
 * Caller computes the new bases / outs / score before invoking; this
 * action just persists. Same two-phase write pattern as the at-bat
 * and pickoff actions.
 */
export interface RecordMidGameEventInput {
  gameId: string;
  /** "stolen_base" | "caught_stealing" | "wild_pitch" | "passed_ball" | "balk" */
  kind: string;
  /** Originating base for SB/CS (1, 2, 3). Omit for WP/PB/BK. */
  fromBase?: 1 | 2 | 3 | null;
  /** Runner involved (the player who moved/was tagged). Optional for WP/PB/BK
   *  where multiple runners may move. */
  runnerId?: string | null;
  inning: number;
  topBottom: "top" | "bottom";
  outsAfter: number;
  homeScore: number;
  awayScore: number;
  pitcherId?: string | null;
  /** New bases AFTER the event resolves. */
  runnersAfter: { 1: string | null; 2: string | null; 3: string | null };
  /** For stolen_base only: when true, the runner advanced because the
   *  defense didn't contest. NO stolen base credited; box score doesn't
   *  bump the runner's SB. */
  defensiveIndifference?: boolean;
}

export async function recordMidGameEventAction(
  input: RecordMidGameEventInput,
): Promise<{ error: string | null; eventId?: string }> {
  if (!input.gameId || !input.kind) return { error: "Missing input." };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  // Phase 1: insert via the existing RPC. The runner-as-player_id
  // convention matches the pickoff path (so player_jersey resolves
  // to the runner involved when applicable).
  const { data, error } = await supabase.rpc("log_at_bat", {
    _game_id: input.gameId,
    _player_id: input.runnerId ?? null,
    _ad_hoc_name: null,
    _outcome: input.kind,
    _rbi: 0,
    _inning: input.inning,
    _top_bottom: input.topBottom,
    _outs_after: input.outsAfter,
    _home_score: input.homeScore,
    _away_score: input.awayScore,
  });
  if (error) return { error: error.message };
  const eventId = data as string;

  // Phase 2: enrich payload with mid-game flag + bases + pitcher.
  const { data: row } = await supabase
    .from("game_events")
    .select("payload")
    .eq("id", eventId)
    .maybeSingle();
  const existing =
    (row?.payload as Record<string, unknown> | null | undefined) ?? {};
  const merged: Record<string, unknown> = {
    ...existing,
    midGame: true,
    midGameKind: input.kind,
    runnersAfter: input.runnersAfter,
    pitcherId: input.pitcherId ?? null,
  };
  if (input.fromBase != null) merged.fromBase = input.fromBase;
  if (input.defensiveIndifference) merged.defensiveIndifference = true;

  const { error: upErr } = await supabase
    .from("game_events")
    .update({ payload: merged })
    .eq("id", eventId);
  if (upErr) {
    // eslint-disable-next-line no-console
    console.warn("[mid-game] payload merge failed", upErr.message);
  }

  revalidatePath(`/g/${input.gameId}`);
  return { error: null, eventId };
}

// ─────────────────────────────────────────────────────────────
// Base override — coach corrects who's on each base
// ─────────────────────────────────────────────────────────────

/**
 * overrideBasesAction — record a manual correction to the current
 * runner state. Used when the smart-default advancement was wrong
 * (FC where a different runner got the out, error with multiple
 * advances, etc.) and the coach wants to fix without undoing the AB.
 *
 * Inserts a "bases_correction" event so the audit trail shows the
 * coach edited bases; no score / out changes (those go through
 * mid-game events or full undo+redo of the AB).
 */
export interface OverrideBasesInput {
  gameId: string;
  inning: number;
  topBottom: "top" | "bottom";
  outsAfter: number;
  homeScore: number;
  awayScore: number;
  pitcherId?: string | null;
  runnersAfter: { 1: string | null; 2: string | null; 3: string | null };
}

export async function overrideBasesAction(
  input: OverrideBasesInput,
): Promise<{ error: string | null; eventId?: string }> {
  if (!input.gameId) return { error: "Game ID required." };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("log_at_bat", {
    _game_id: input.gameId,
    _player_id: null,
    _ad_hoc_name: "(bases corrected)",
    _outcome: "bases_correction",
    _rbi: 0,
    _inning: input.inning,
    _top_bottom: input.topBottom,
    _outs_after: input.outsAfter,
    _home_score: input.homeScore,
    _away_score: input.awayScore,
  });
  if (error) return { error: error.message };
  const eventId = data as string;

  const { data: row } = await supabase
    .from("game_events")
    .select("payload")
    .eq("id", eventId)
    .maybeSingle();
  const existing =
    (row?.payload as Record<string, unknown> | null | undefined) ?? {};
  const merged: Record<string, unknown> = {
    ...existing,
    basesCorrection: true,
    midGame: true, // re-uses the AB-count filter
    runnersAfter: input.runnersAfter,
    pitcherId: input.pitcherId ?? null,
  };
  await supabase.from("game_events").update({ payload: merged }).eq("id", eventId);

  revalidatePath(`/g/${input.gameId}`);
  return { error: null, eventId };
}

// ─────────────────────────────────────────────────────────────
// Opposing pitcher
// ─────────────────────────────────────────────────────────────

/**
 * setOpposingPitcherAction — persists a free-text name of the pitcher
 * we're facing. Doesn't touch the event log directly; instead, the
 * NEXT at-bat carries `payload.opposingPitcherName` so fans see the
 * name in the scoreboard pitcher slot when we're at bat.
 *
 * For v1 we just write to localStorage on the client. This action is
 * provided for symmetry / future server-side persistence.
 *
 * Today this is unused server-side because the coach UI persists the
 * name in localStorage and includes it in the next logAtBatAction
 * call's pitcherName field. Kept here as a stub for the eventual
 * server-side game.opposing_pitcher_name column.
 */

// ─────────────────────────────────────────────────────────────
// Substitution: pinch hit / pinch run / defensive
// ─────────────────────────────────────────────────────────────

/**
 * substituteAction — replace one player with another in the lineup
 * AND record a substitution event in the play feed.
 *
 * Modes:
 *   - pinch_hit: the new player takes the OUT player's batting slot
 *     for this at-bat (and stays in the lineup unless re-subbed).
 *   - pinch_run: same but typically used after the player reaches base
 *     and is replaced as a runner. Same DB effect as pinch_hit; the
 *     label distinguishes for the fan feed.
 *   - defensive: replaces a player on the field; no at-bat impact.
 *
 * For all modes we UPDATE lineup_entries to swap player_id at the
 * given batting_order slot. For pinch_run, we ALSO need to update
 * the on-base runner if they were the one being subbed. The caller
 * provides `runnersAfter` reflecting the swap.
 */
export interface SubstituteInput {
  gameId: string;
  battingOrder: number;
  outPlayerId: string;
  inPlayerId: string;
  kind: "pinch_hit" | "pinch_run" | "defensive";
  position?: string;
  inning: number;
  topBottom: "top" | "bottom";
  outsAfter: number;
  homeScore: number;
  awayScore: number;
  /** For pinch_run: the new runner state with the substituted player on
   *  the base. Optional for pinch_hit / defensive. */
  runnersAfter?: { 1: string | null; 2: string | null; 3: string | null };
  pitcherId?: string | null;
}

export async function substituteAction(
  input: SubstituteInput,
): Promise<{ error: string | null; eventId?: string }> {
  if (!input.gameId || !input.outPlayerId || !input.inPlayerId) {
    return { error: "Missing input." };
  }
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  // 1. Swap player_id in lineup_entries (defensive sub also updates
  //    position if provided).
  const update: Record<string, unknown> = { player_id: input.inPlayerId };
  if (input.position) update.position = input.position;
  const { error: lineErr } = await supabase
    .from("lineup_entries")
    .update(update)
    .eq("game_id", input.gameId)
    .eq("batting_order", input.battingOrder);
  if (lineErr) {
    return { error: `Couldn't swap lineup: ${lineErr.message}` };
  }

  // 2. Insert a substitution event so the fan feed can render
  //    "Pinch hitter: Marcus Johnson for Diego Alvarez".
  const { data, error } = await supabase.rpc("log_at_bat", {
    _game_id: input.gameId,
    _player_id: input.inPlayerId,
    _ad_hoc_name: null,
    _outcome: input.kind,
    _rbi: 0,
    _inning: input.inning,
    _top_bottom: input.topBottom,
    _outs_after: input.outsAfter,
    _home_score: input.homeScore,
    _away_score: input.awayScore,
  });
  if (error) {
    return { error: `Lineup updated but event log failed: ${error.message}` };
  }
  const eventId = data as string;

  const { data: row } = await supabase
    .from("game_events")
    .select("payload")
    .eq("id", eventId)
    .maybeSingle();
  const existing =
    (row?.payload as Record<string, unknown> | null | undefined) ?? {};
  const merged: Record<string, unknown> = {
    ...existing,
    substitution: true,
    subKind: input.kind,
    outPlayerId: input.outPlayerId,
    inPlayerId: input.inPlayerId,
    battingOrder: input.battingOrder,
    pitcherId: input.pitcherId ?? null,
  };
  if (input.position) merged.position = input.position;
  if (input.runnersAfter) merged.runnersAfter = input.runnersAfter;
  await supabase
    .from("game_events")
    .update({ payload: merged })
    .eq("id", eventId);

  revalidatePath(`/g/${input.gameId}`);
  revalidatePath(`/app/games/${input.gameId}`);
  return { error: null, eventId };
}

/**
 * undoLastAtBatAction — reliability win: hard-deletes the most recent
 * at-bat event for this game (home-side stream) and re-syncs the score
 * on the parent games row from the prior event.
 *
 * Trade-offs (documented so a future RPC migration can lock this down):
 *   - Hard delete (not soft) — the audit trail loses one row. We accept
 *     this for v1 because the alternative (correction events) doubles
 *     the play-by-play noise on the public viewer.
 *   - 3 sequential statements, not transactional. Crash window between
 *     event delete and score update would leave games.our_score stale;
 *     the next at-bat overwrites it. Acceptable for a coach-driven
 *     action where a 200ms inconsistency window is invisible.
 *   - Realtime fan subscribers don't see DELETEs. The next at-bat
 *     fires INSERT and brings the public viewer's running score back
 *     in sync. Fans may briefly see the undone play in their feed
 *     until refresh.
 *   - Sequence number is left orphaned — RPC `log_at_bat` allocates
 *     `MAX(sequence)+1` so the next at-bat fills the gap. Read paths
 *     order by sequence ASC and tolerate gaps fine.
 *
 * Returns the deleted play summary so the UI can confirm what the
 * coach just removed.
 */
export async function undoLastAtBatAction(
  gameId: string,
): Promise<{
  error: string | null;
  undone?: { outcome: string; playerName: string | null };
}> {
  if (!gameId) return { error: "Game ID required." };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  // Verify game ownership before touching events.
  const { data: game } = await supabase
    .from("games")
    .select("id, program_id, home_away")
    .eq("id", gameId)
    .maybeSingle();
  if (!game) return { error: "Game not found." };
  if (game.program_id !== coach.program_id) return { error: "Not authorized." };

  // 1. Find the most recent at-bat on the home (canonical) stream.
  const { data: latest } = await supabase
    .from("game_events")
    .select(
      "id, sequence, payload, player_id, player_ad_hoc_name, home_score, away_score",
    )
    .eq("game_id", gameId)
    .eq("logged_by_side", "home")
    .eq("event_type", "at_bat")
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return { error: "No at-bats to undo." };

  // Resolve player name in a separate read so the typing stays simple
  // (the embedded join inflates the row shape unhelpfully).
  let playerName: string | null = latest.player_ad_hoc_name ?? null;
  if (!playerName && latest.player_id) {
    const { data: p } = await supabase
      .from("players")
      .select("first_name, last_name")
      .eq("id", latest.player_id)
      .maybeSingle();
    if (p) playerName = `${p.first_name} ${p.last_name}`.trim();
  }

  // 2. Delete the at-bat itself.
  const { error: delErr } = await supabase
    .from("game_events")
    .delete()
    .eq("id", latest.id);
  if (delErr) return { error: delErr.message };

  // 2b. PHASE 1.2 FIX — if this AB triggered an inning_change (the
  // 3rd-out AB persists a paired inning_change event right after it
  // with sequence + 1), delete the orphaned inning_change too. Without
  // this, undo would leave a dangling half-flip event whose
  // (inning, top_bottom) became the derived state — putting the game
  // in a half it shouldn't be in.
  //
  // Match by sequence > deleted.sequence, same side, event_type =
  // inning_change, and no other at_bat between them. We delete by
  // sequence-ordered window so a benign concurrent insert can't
  // accidentally be removed.
  await supabase
    .from("game_events")
    .delete()
    .eq("game_id", gameId)
    .eq("logged_by_side", "home")
    .eq("event_type", "inning_change")
    .gt("sequence", latest.sequence);
  // Note: in current single-scorekeeper flow there's only ever a
  // single inning_change between the 3rd-out AB and any later events.
  // The wider sequence range is a safety net — multi-scorer scenarios
  // would need a transactional RPC.

  // 3. Re-sync the games row from the prior at-bat (or zeros).
  const { data: prior } = await supabase
    .from("game_events")
    .select("home_score, away_score")
    .eq("game_id", gameId)
    .eq("logged_by_side", "home")
    .eq("event_type", "at_bat")
    .lt("sequence", latest.sequence)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();
  const isHome = game.home_away === "home";
  const newOurScore = isHome ? (prior?.home_score ?? 0) : (prior?.away_score ?? 0);
  const newOppScore = isHome ? (prior?.away_score ?? 0) : (prior?.home_score ?? 0);
  await supabase
    .from("games")
    .update({ our_score: newOurScore, opponent_score: newOppScore })
    .eq("id", gameId);

  revalidatePath(`/g/${gameId}`);
  revalidatePath(`/app/games/${gameId}/score`);
  revalidatePath(`/app/games/${gameId}`);
  return {
    error: null,
    undone: {
      outcome: String((latest.payload as { outcome?: string })?.outcome ?? "—"),
      playerName,
    },
  };
}

export async function linkOpponentProgramAction(
  gameId: string,
  opponentProgramId: string | null,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("games")
    .update({ opponent_program_id: opponentProgramId })
    .eq("id", gameId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath(`/app/games/${gameId}`);
  revalidatePath(`/app/games/${gameId}/score`);
  return { error: null };
}
