"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";
import type { Verdict } from "@/lib/services/tryouts";
import {
  CreateStationInput as CreateStationSchema,
  CreateTryoutInput as CreateTryoutSchema,
  RecordScoreInput as RecordScoreSchema,
  firstZodError,
  validateScoreForStationType,
} from "@/lib/validation/schemas";

/**
 * Tryouts actions — writes. Reads live in lib/services/tryouts.ts.
 * All actions scoped to the caller's program via getCurrentCoach().
 *
 * If migration 20260315000008_tryouts.sql has not been applied yet,
 * each action returns a structured "migration pending" error so the
 * UI can show a single banner instead of cryptic Postgres messages.
 */

const MIGRATION_PENDING_MSG =
  "Tryouts tables not yet applied. Apply migration 20260315000008_tryouts.sql in Supabase.";

function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "42P01" || /does not exist/i.test(err.message ?? "");
}

// ── Create tryout ────────────────────────────────────────────────

export interface TryoutMetricInput {
  name: string;
  shortCode: string;
  unit: string | null;
  scoreType: "lower_better" | "higher_better" | "rating";
}

export interface CreateTryoutInput {
  name: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  /** Metrics (stations) to create with the tryout. Empty = no stations. */
  metrics?: TryoutMetricInput[];
}

export async function createTryoutAction(
  input: CreateTryoutInput,
): Promise<{ error: string | null; tryoutId?: string }> {
  const parsed = CreateTryoutSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  // Use validated input throughout the rest of the action.
  input = parsed.data as CreateTryoutInput;
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("tryouts")
    .insert({
      program_id: coach.program_id,
      name: input.name.trim(),
      start_date: input.startDate,
      end_date: input.endDate || null,
      notes: input.notes?.trim() || null,
      status: "scheduled",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isMissingTable(error)) return { error: MIGRATION_PENDING_MSG };
    return { error: error?.message ?? "Couldn't create tryout." };
  }

  // Insert the chosen metrics (stations). Order in the array becomes
  // sort_order so the coach's preview order matches what runs.
  if (input.metrics && input.metrics.length > 0) {
    const rows = input.metrics.map((m, i) => ({
      tryout_id: data.id,
      name: m.name.trim(),
      short_code: m.shortCode.trim(),
      unit: m.unit?.trim() || null,
      score_type: m.scoreType,
      sort_order: i + 1,
    }));
    const { error: stationErr } = await supabase
      .from("tryout_stations")
      .insert(rows);
    if (stationErr) {
      // Tryout exists but stations failed — log and return the partial
      // success. Coach can add stations from the tryout detail page.
      console.error("[tryouts] station insert failed:", stationErr);
    }
  }

  revalidatePath("/app/tryouts");
  revalidatePath("/app");
  return { error: null, tryoutId: data.id };
}

export async function deleteTryoutAction(
  tryoutId: string,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("tryouts")
    .delete()
    .eq("id", tryoutId)
    .eq("program_id", coach.program_id);
  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_PENDING_MSG };
    return { error: error.message };
  }
  revalidatePath("/app/tryouts");
  return { error: null };
}

// ── Stations ─────────────────────────────────────────────────────

export interface CreateStationInput {
  tryoutId: string;
  name: string;
  shortCode: string;
  unit?: string | null;
  scoreType: "lower_better" | "higher_better" | "rating";
  assignedCoachId?: string | null;
}

export async function createStationAction(
  input: CreateStationInput,
): Promise<{ error: string | null; stationId?: string }> {
  const parsed = CreateStationSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  input = parsed.data as CreateStationInput;
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("tryout_stations")
    .select("sort_order")
    .eq("tryout_id", input.tryoutId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (existing?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("tryout_stations")
    .insert({
      tryout_id: input.tryoutId,
      name: input.name.trim(),
      short_code: input.shortCode.trim(),
      unit: input.unit ?? null,
      score_type: input.scoreType,
      assigned_coach_id: input.assignedCoachId ?? null,
      sort_order: nextSort,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isMissingTable(error)) return { error: MIGRATION_PENDING_MSG };
    return { error: error?.message ?? "Couldn't add station." };
  }

  revalidatePath(`/app/tryouts/${input.tryoutId}`);
  return { error: null, stationId: data.id };
}

export async function deleteStationAction(
  stationId: string,
  tryoutId: string,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("tryout_stations")
    .delete()
    .eq("id", stationId);
  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_PENDING_MSG };
    return { error: error.message };
  }
  revalidatePath(`/app/tryouts/${tryoutId}`);
  return { error: null };
}

export async function toggleStationStatusAction(
  stationId: string,
  tryoutId: string,
  status: "active" | "paused",
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("tryout_stations")
    .update({ status })
    .eq("id", stationId);
  if (error) return { error: error.message };
  revalidatePath(`/app/tryouts/${tryoutId}`);
  return { error: null };
}

// ── Attendees ────────────────────────────────────────────────────

export async function setAttendeesAction(
  tryoutId: string,
  playerIds: string[],
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  // Wipe + insert. Verdicts are cleared when rebuilding the attendee list.
  const { error: delErr } = await supabase
    .from("tryout_attendees")
    .delete()
    .eq("tryout_id", tryoutId);
  if (delErr) {
    if (isMissingTable(delErr)) return { error: MIGRATION_PENDING_MSG };
    return { error: delErr.message };
  }

  if (playerIds.length === 0) {
    revalidatePath(`/app/tryouts/${tryoutId}`);
    return { error: null };
  }

  const rows = playerIds.map((pid) => ({
    tryout_id: tryoutId,
    player_id: pid,
    attended: true,
  }));
  const { error } = await supabase.from("tryout_attendees").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(`/app/tryouts/${tryoutId}`);
  return { error: null };
}

export async function setAttendanceAction(
  tryoutId: string,
  playerId: string,
  attended: boolean,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("tryout_attendees")
    .upsert(
      { tryout_id: tryoutId, player_id: playerId, attended },
      { onConflict: "tryout_id,player_id" },
    );
  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_PENDING_MSG };
    return { error: error.message };
  }
  revalidatePath(`/app/tryouts/${tryoutId}`);
  return { error: null };
}

// ── Scoring ──────────────────────────────────────────────────────

export interface RecordScoreInput {
  tryoutId: string;
  stationId: string;
  playerId: string;
  value: number;
  flag?: "attention" | "standout" | null;
  note?: string | null;
}

/**
 * recordScoreAction — upserts a single (tryout, station, player) score.
 * This is the core action behind the mobile station scoring flow.
 * New values overwrite old; we keep it simple (no attempt history v1).
 */
export async function recordScoreAction(
  input: RecordScoreInput,
): Promise<{ error: string | null }> {
  // Shape validation: numeric, finite, ≥0, ≤1000, plus uuid checks.
  const parsed = RecordScoreSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const safe = parsed.data;

  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };

  const supabase = createSupabaseServerClient();

  // Per-station-type bound check: ratings must be 1-5 ints, lower_better
  // capped at 600s. Requires fetching the station's score_type first.
  const { data: station } = await supabase
    .from("tryout_stations")
    .select("score_type")
    .eq("id", safe.stationId)
    .maybeSingle();
  if (station?.score_type) {
    const check = validateScoreForStationType(safe.value, station.score_type);
    if (!check.ok) return { error: check.error };
  }

  const { error } = await supabase
    .from("tryout_scores")
    .upsert(
      {
        tryout_id: safe.tryoutId,
        station_id: safe.stationId,
        player_id: safe.playerId,
        value: safe.value,
        flag: safe.flag ?? null,
        note: safe.note,
        scored_by: coach.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tryout_id,station_id,player_id" },
    );

  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_PENDING_MSG };
    return { error: error.message };
  }

  revalidatePath(`/app/tryouts/${input.tryoutId}`);
  revalidatePath(`/app/tryouts/${input.tryoutId}/station/${input.stationId}`);
  return { error: null };
}

export async function clearScoreAction(
  tryoutId: string,
  stationId: string,
  playerId: string,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("tryout_scores")
    .delete()
    .eq("tryout_id", tryoutId)
    .eq("station_id", stationId)
    .eq("player_id", playerId);
  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_PENDING_MSG };
    return { error: error.message };
  }
  revalidatePath(`/app/tryouts/${tryoutId}`);
  revalidatePath(`/app/tryouts/${tryoutId}/station/${stationId}`);
  return { error: null };
}

// ── Verdicts ─────────────────────────────────────────────────────

export async function setVerdictAction(
  tryoutId: string,
  playerId: string,
  verdict: Verdict | null,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("tryout_attendees")
    .upsert(
      {
        tryout_id: tryoutId,
        player_id: playerId,
        attended: true,
        verdict: verdict,
        decided_by: verdict ? coach.id : null,
        decided_at: verdict ? new Date().toISOString() : null,
      },
      { onConflict: "tryout_id,player_id" },
    );
  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_PENDING_MSG };
    return { error: error.message };
  }
  revalidatePath(`/app/tryouts/${tryoutId}`);
  return { error: null };
}

/**
 * applyVerdictsToRosterAction — push decided verdicts into
 * roster_assignments so they show up on the Roster page immediately.
 *
 * Verdict vocabulary (post-migration 000009):
 *   - "cut"     → roster_assignments.assignment = 'cut'
 *   - "bubble"  → untouched (coach still deciding)
 *   - "lock"    → placed on the top configured level (programs.levels[0])
 *   - any other → placed on that level name (case-insensitive match)
 *
 * Legacy values from the first tryouts migration are translated for
 * backward compatibility ("keep_varsity" → configured V name, etc.).
 */
export async function applyVerdictsToRosterAction(
  tryoutId: string,
): Promise<{ error: string | null; applied: number }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program.", applied: 0 };
  const supabase = createSupabaseServerClient();

  const { data: rows, error } = await supabase
    .from("tryout_attendees")
    .select("player_id, verdict")
    .eq("tryout_id", tryoutId);
  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_PENDING_MSG, applied: 0 };
    return { error: error.message, applied: 0 };
  }

  const levels = coach.program_levels ?? [];
  const topLevel = levels[0]?.toLowerCase() ?? "varsity";

  /**
   * resolveVerdict — produce the target roster_assignments.assignment
   * for a verdict string. Returns null to skip (bubble / unrecognized /
   * no matching level).
   */
  const resolveVerdict = (v: string | null | undefined): string | null => {
    if (!v) return null;
    const lower = v.toLowerCase();
    if (lower === "bubble") return null;
    if (lower === "cut") return "cut";
    if (lower === "lock") return topLevel;
    // Legacy aliases from the original tryouts migration.
    if (lower === "keep_varsity") return levels[0]?.toLowerCase() ?? "varsity";
    if (lower === "keep_jv") return levels[1]?.toLowerCase() ?? "jv";
    if (lower === "keep_freshman")
      return levels[levels.length - 1]?.toLowerCase() ?? "freshman";
    // Match verdict string against the program's configured levels.
    const match = levels.find((l) => l.toLowerCase() === lower);
    if (match) return match.toLowerCase();
    // Unknown verdict — leave the player alone so a typo doesn't
    // silently drop them into the wrong team.
    return null;
  };

  const upserts: Array<{
    player_id: string;
    program_id: string;
    assignment: string;
    assigned_by: string;
  }> = [];
  for (const r of rows ?? []) {
    const mapped = resolveVerdict(r.verdict);
    if (!mapped) continue;
    upserts.push({
      player_id: r.player_id,
      program_id: coach.program_id,
      assignment: mapped,
      assigned_by: coach.id,
    });
  }

  if (upserts.length === 0) return { error: null, applied: 0 };

  // roster_assignments has UNIQUE(player_id). Conflict target is a single
  // column, not a composite. The assigned_by column is NOT NULL.
  const { error: upErr } = await supabase
    .from("roster_assignments")
    .upsert(upserts, { onConflict: "player_id" });
  if (upErr) return { error: upErr.message, applied: 0 };

  revalidatePath(`/app/tryouts/${tryoutId}`);
  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null, applied: upserts.length };
}

export async function setTryoutStatusAction(
  tryoutId: string,
  status: "scheduled" | "live" | "complete",
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("tryouts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", tryoutId)
    .eq("program_id", coach.program_id);
  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_PENDING_MSG };
    return { error: error.message };
  }
  revalidatePath(`/app/tryouts/${tryoutId}`);
  revalidatePath("/app/tryouts");
  return { error: null };
}
