"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";
import { isDemoRequest, DEMO_GUARD_MESSAGE } from "@/lib/demo-guard";
import type {
  AtBatOutcome,
  PracticePitch,
  SessionKind,
} from "@/lib/services/live-abs";

// ── Sessions ─────────────────────────────────────────────────

export interface CreateSessionInput {
  name: string;
  sessionDate: string;
  location?: string | null;
  notes?: string | null;
  kind?: SessionKind;
}

export async function createSessionAction(
  input: CreateSessionInput,
): Promise<{ error: string | null; sessionId?: string }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  if (!input.name.trim()) return { error: "Name your session." };
  if (!input.sessionDate) return { error: "Pick a date." };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("practice_sessions")
    .insert({
      program_id: coach.program_id,
      name: input.name.trim(),
      session_date: input.sessionDate,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
      kind: input.kind ?? "live_abs",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Couldn't create." };
  revalidatePath("/app/practice/live-abs");
  return { error: null, sessionId: data.id };
}

export async function endSessionAction(
  sessionId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("practice_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) return { error: error.message };
  revalidatePath(`/app/practice/live-abs/${sessionId}`);
  revalidatePath("/app/practice/live-abs");
  return { error: null };
}

export async function reopenSessionAction(
  sessionId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("practice_sessions")
    .update({ ended_at: null })
    .eq("id", sessionId);
  if (error) return { error: error.message };
  revalidatePath(`/app/practice/live-abs/${sessionId}`);
  return { error: null };
}

export async function deleteSessionAction(
  sessionId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("practice_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) return { error: error.message };
  revalidatePath("/app/practice/live-abs");
  return { error: null };
}

// ── At-bats ──────────────────────────────────────────────────

export interface RecordAtBatInput {
  sessionId: string;
  pitcherId: string;
  hitterId: string;
  outcome: AtBatOutcome;
  rbi?: number;
  exitVelocity?: number | null;
  pitchVelocity?: number | null;
  pitchType?: string | null;
  notes?: string | null;
  /**
   * Optional: full pitch sequence for the AB. When present, each pitch
   * is written to practice_pitches with the same FK back to the AB.
   * Used by pitch-by-pitch tracking mode; outcome-only mode passes
   * undefined.
   */
  pitches?: PracticePitch[];
}

export async function recordAtBatAction(
  input: RecordAtBatInput,
): Promise<{ error: string | null; id?: string }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Compute next sequence
  const { data: latest } = await supabase
    .from("practice_at_bats")
    .select("sequence")
    .eq("session_id", input.sessionId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSeq = (latest?.sequence ?? 0) + 1;

  const { data, error } = await supabase
    .from("practice_at_bats")
    .insert({
      session_id: input.sessionId,
      sequence: nextSeq,
      pitcher_id: input.pitcherId,
      hitter_id: input.hitterId,
      outcome: input.outcome,
      rbi: input.rbi ?? 0,
      exit_velocity: input.exitVelocity ?? null,
      pitch_velocity: input.pitchVelocity ?? null,
      pitch_type: input.pitchType?.trim() || null,
      notes: input.notes?.trim() || null,
      recorded_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Couldn't record." };

  // Optionally insert per-pitch detail
  if (input.pitches && input.pitches.length > 0) {
    const pitchRows = input.pitches.map((p) => ({
      at_bat_id: data.id,
      sequence: p.sequence,
      result: p.result,
      pitch_type: p.pitchType?.trim() || null,
      pitch_velocity: p.pitchVelocity ?? null,
      notes: p.notes?.trim() || null,
    }));
    const { error: pitchErr } = await supabase
      .from("practice_pitches")
      .insert(pitchRows);
    if (pitchErr) {
      console.error("[practice_pitches] insert failed:", pitchErr);
      // Don't roll back the AB — losing per-pitch detail is recoverable;
      // losing the outcome is not. Log + continue.
    }
  }

  revalidatePath(`/app/practice/live-abs/${input.sessionId}`);
  return { error: null, id: data.id };
}

export async function deleteAtBatAction(
  atBatId: string,
  sessionId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("practice_at_bats")
    .delete()
    .eq("id", atBatId);
  if (error) return { error: error.message };
  revalidatePath(`/app/practice/live-abs/${sessionId}`);
  return { error: null };
}
