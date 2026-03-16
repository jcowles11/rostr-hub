/**
 * Session Service
 *
 * Extracts tryout session CRUD operations from TryoutPlanner.
 * Used by: TryoutPlanner.tsx, potentially SessionContext.tsx
 */
import { supabase } from "@/integrations/supabase/client";
import { createSessionSchema, updateSessionSchema, validate } from "@/lib/validation";

// ── Types ──────────────────────────────────────────────────────────

export interface TryoutSession {
  id: string;
  name: string;
  session_date: string;
  notes: string | null;
}

// ── Queries ────────────────────────────────────────────────────────

/** Fetch all tryout sessions for a program, ordered by date ascending. */
export async function fetchTryoutSessions(programId: string): Promise<{ data: TryoutSession[]; error: string | null }> {
  const { data, error } = await supabase
    .from("tryout_sessions")
    .select("*")
    .eq("program_id", programId)
    .order("session_date", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

// ── Mutations ──────────────────────────────────────────────────────

/** Create a new tryout session (validates input). */
export async function createTryoutSession(input: {
  program_id: string;
  name: string;
  session_date: string;
}): Promise<{ error: string | null }> {
  const validation = validate(createSessionSchema, input);
  if (!validation.success) {
    return { error: validation.error };
  }
  const validated = validation.data;

  const { error } = await supabase.from("tryout_sessions").insert({
    program_id: validated.program_id,
    name: validated.name,
    session_date: validated.session_date,
  });

  return { error: error?.message ?? null };
}

/** Update an existing tryout session (validates input). */
export async function updateTryoutSession(
  sessionId: string,
  input: { name: string; session_date: string }
): Promise<{ error: string | null }> {
  const validation = validate(updateSessionSchema, input);
  if (!validation.success) {
    return { error: validation.error };
  }
  const validated = validation.data;

  const { error } = await supabase
    .from("tryout_sessions")
    .update({ name: validated.name, session_date: validated.session_date })
    .eq("id", sessionId);

  return { error: error?.message ?? null };
}

// ── Session Stats ─────────────────────────────────────────────────

export interface SessionStats {
  evaluationCount: number;
  attendanceCount: number;
}

/**
 * Get counts of evaluations and attendance records for a session.
 * Used to warn coaches before deletion.
 */
export async function getSessionStats(sessionId: string): Promise<{ data: SessionStats; error: string | null }> {
  const [evalRes, attRes] = await Promise.all([
    supabase
      .from("evaluations")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId),
    supabase
      .from("session_attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId),
  ]);

  if (evalRes.error || attRes.error) {
    return {
      data: { evaluationCount: 0, attendanceCount: 0 },
      error: evalRes.error?.message || attRes.error?.message || "Failed to fetch session stats",
    };
  }

  return {
    data: {
      evaluationCount: evalRes.count ?? 0,
      attendanceCount: attRes.count ?? 0,
    },
    error: null,
  };
}

/**
 * Safely delete a tryout session with proper cascade handling.
 * - Unassigns evaluations (sets session_id to null, preserving score data)
 * - Deletes attendance records
 * - Deletes the session
 * Returns the number of evaluations that were unassigned.
 */
export async function deleteTryoutSession(sessionId: string): Promise<{ error: string | null; unassignedEvaluations: number }> {
  // Step 1: Unassign evaluations (preserve data, just remove session link)
  const { count: evalCount, error: evalError } = await supabase
    .from("evaluations")
    .update({ session_id: null })
    .eq("session_id", sessionId)
    .select("id", { count: "exact", head: true });

  if (evalError) {
    return { error: `Failed to unassign evaluations: ${evalError.message}`, unassignedEvaluations: 0 };
  }

  // Step 2: Delete attendance records
  const { error: attError } = await supabase
    .from("session_attendance")
    .delete()
    .eq("session_id", sessionId);

  if (attError) {
    return { error: `Failed to delete attendance: ${attError.message}`, unassignedEvaluations: evalCount ?? 0 };
  }

  // Step 3: Delete the session itself
  const { error } = await supabase
    .from("tryout_sessions")
    .delete()
    .eq("id", sessionId);

  return { error: error?.message ?? null, unassignedEvaluations: evalCount ?? 0 };
}
