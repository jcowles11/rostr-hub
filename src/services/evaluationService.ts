/**
 * Evaluation Service
 *
 * Extracts all evaluation/scoring Supabase queries from page components.
 * Used by: ScoreEntry.tsx, Dashboard.tsx
 */
import { supabase } from "@/integrations/supabase/client";
import { scoreEntrySchema, validate, validateScoreValue, type MetricBounds } from "@/lib/validation";

// ── Types ──────────────────────────────────────────────────────────

export interface Evaluation {
  id: string;
  player_id: string;
  metric_id: string;
  attempt_number: number;
  value: number;
}

export interface EvaluationRaw {
  player_id: string;
  metric_id: string;
  coach_id: string;
  value: number;
  created_at: string;
}

export interface PreviousScore {
  session_name: string;
  session_date: string;
  attempt_number: number;
  value: number;
}

export interface SaveScoreInput {
  program_id: string;
  player_id: string;
  metric_id: string;
  coach_id: string;
  session_id: string;
  attempt_number: number;
  value: number;
}

// ── Queries ────────────────────────────────────────────────────────

/** Fetch evaluations for a specific metric/coach/session combo (ScoreEntry). */
export async function fetchSessionEvaluations(
  programId: string,
  metricId: string,
  coachId: string,
  sessionId: string
): Promise<{ data: Evaluation[]; error: string | null }> {
  const { data, error } = await supabase
    .from("evaluations")
    .select("id, player_id, metric_id, attempt_number, value")
    .eq("program_id", programId)
    .eq("metric_id", metricId)
    .eq("coach_id", coachId)
    .eq("session_id", sessionId);

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

/**
 * Fetch ALL evaluations for a program with pagination (Dashboard).
 * Supabase has a 1000-row default limit, so we paginate.
 */
export async function fetchAllEvaluations(
  programId: string,
  sessionId?: string
): Promise<{ data: EvaluationRaw[]; error: string | null }> {
  const allEvals: EvaluationRaw[] = [];
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let q = supabase
      .from("evaluations")
      .select("player_id, metric_id, coach_id, value, created_at")
      .eq("program_id", programId)
      .order("created_at")
      .range(offset, offset + batchSize - 1);

    if (sessionId && sessionId !== "all") {
      q = q.eq("session_id", sessionId);
    }

    const { data, error } = await q;
    if (error) {
      return { data: [], error: error.message };
    }

    const batch = data ?? [];
    allEvals.push(...batch);
    hasMore = batch.length === batchSize;
    offset += batchSize;
  }

  return { data: allEvals, error: null };
}

/**
 * Fetch previous-session scores for a player+metric (ScoreEntry history display).
 */
export async function fetchPreviousSessionScores(
  programId: string,
  playerId: string,
  metricId: string,
  currentSessionId: string
): Promise<{ data: PreviousScore[]; error: string | null }> {
  const { data, error } = await supabase
    .from("evaluations")
    .select("attempt_number, value, session_id")
    .eq("program_id", programId)
    .eq("metric_id", metricId)
    .eq("player_id", playerId)
    .neq("session_id", currentSessionId);

  if (error) {
    return { data: [], error: error.message };
  }

  if (!data || data.length === 0) {
    return { data: [], error: null };
  }

  // Fetch session names for the referenced sessions
  const sessionIds = [...new Set(data.map((d) => d.session_id).filter(Boolean))] as string[];
  const { data: sessData } = await supabase
    .from("tryout_sessions")
    .select("id, name, session_date")
    .in("id", sessionIds);

  const sessMap = new Map((sessData ?? []).map((s) => [s.id, s]));

  const scores: PreviousScore[] = data
    .filter((d) => d.session_id && sessMap.has(d.session_id))
    .map((d) => ({
      session_name: sessMap.get(d.session_id!)?.name || "",
      session_date: sessMap.get(d.session_id!)?.session_date || "",
      attempt_number: d.attempt_number,
      value: d.value,
    }));

  return { data: scores, error: null };
}

// ── Mutations ──────────────────────────────────────────────────────

export interface SaveScoreResult {
  error: string | null;
  operation: "insert" | "update";
  /** True if the error is likely transient (network) and the save should be retried. */
  retryable: boolean;
}

/** Save or update a single score (validates input + metric bounds before writing). */
export async function saveScore(
  input: SaveScoreInput,
  existingEvalId?: string,
  metricBounds?: MetricBounds
): Promise<SaveScoreResult> {
  const op: "insert" | "update" = existingEvalId ? "update" : "insert";

  const validation = validate(scoreEntrySchema, input);
  if (!validation.success) {
    return { error: validation.error, operation: op, retryable: false };
  }
  const validated = validation.data;

  // Enforce metric-specific bounds (especially for rated metrics with min/max)
  if (metricBounds) {
    const boundsError = validateScoreValue(validated.value, metricBounds);
    if (boundsError) {
      return { error: boundsError, operation: op, retryable: false };
    }
  }

  // Past this point, validation passed — any error is a Supabase/network failure (retryable)
  if (existingEvalId) {
    const { error } = await supabase
      .from("evaluations")
      .update({ value: validated.value })
      .eq("id", existingEvalId);
    return { error: error?.message ?? null, operation: "update", retryable: !!error };
  }

  const { error } = await supabase.from("evaluations").insert({
    program_id: validated.program_id,
    player_id: validated.player_id,
    metric_id: validated.metric_id,
    coach_id: validated.coach_id,
    value: validated.value,
    attempt_number: validated.attempt_number,
    session_id: validated.session_id,
  });

  return { error: error?.message ?? null, operation: "insert", retryable: !!error };
}

/** Delete a single evaluation by ID. Only the owning coach should call this (RLS enforces). */
export async function deleteScore(
  evalId: string
): Promise<{ error: string | null }> {
  if (!evalId) return { error: "Missing evaluation ID" };
  const { error } = await supabase
    .from("evaluations")
    .delete()
    .eq("id", evalId);
  return { error: error?.message ?? null };
}

/**
 * Update only the value of an existing evaluation (validates bounds if provided).
 * Used by PlayerDetail inline editing where session/attempt context isn't available.
 */
export async function updateScoreValue(
  evalId: string,
  value: number,
  metricBounds?: MetricBounds
): Promise<{ error: string | null }> {
  if (!evalId) return { error: "Missing evaluation ID" };
  if (!Number.isFinite(value)) return { error: "Value must be a finite number" };

  if (metricBounds) {
    const boundsError = validateScoreValue(value, metricBounds);
    if (boundsError) return { error: boundsError };
  }

  const { error } = await supabase
    .from("evaluations")
    .update({ value })
    .eq("id", evalId);
  return { error: error?.message ?? null };
}

/**
 * Insert an ad-hoc evaluation from PlayerDetail (no session/attempt context required).
 * Validates bounds if provided.
 */
export async function addAdHocScore(
  input: {
    program_id: string;
    player_id: string;
    metric_id: string;
    coach_id: string;
    value: number;
  },
  metricBounds?: MetricBounds
): Promise<{ error: string | null }> {
  if (!input.program_id || !input.player_id || !input.metric_id || !input.coach_id) {
    return { error: "Missing required fields" };
  }
  if (!Number.isFinite(input.value)) return { error: "Value must be a finite number" };

  if (metricBounds) {
    const boundsError = validateScoreValue(input.value, metricBounds);
    if (boundsError) return { error: boundsError };
  }

  const { error } = await supabase.from("evaluations").insert({
    program_id: input.program_id,
    player_id: input.player_id,
    metric_id: input.metric_id,
    coach_id: input.coach_id,
    value: input.value,
  });
  return { error: error?.message ?? null };
}
