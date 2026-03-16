/**
 * Metric Service
 *
 * Extracts metric-related Supabase queries from page components.
 * Used by: ScoreEntry.tsx, Dashboard.tsx, TryoutPlanner.tsx
 */
import { supabase } from "@/integrations/supabase/client";
import { createMetricSchema, validate } from "@/lib/validation";

// ── Types ──────────────────────────────────────────────────────────

/** Full metric info for score entry (includes min/max/attempts). */
export interface MetricForScoring {
  id: string;
  name: string;
  unit: string;
  category: string;
  metric_type: string;
  min_value: number | null;
  max_value: number | null;
  max_attempts: number;
}

/** Lighter metric info for dashboard display. */
export interface MetricForDashboard {
  id: string;
  name: string;
  unit: string;
  metric_type: string;
  aggregation: string;
}

// ── Queries ────────────────────────────────────────────────────────

/** Fetch metrics configured for scoring (ScoreEntry). */
export async function fetchMetricsForScoring(programId: string): Promise<{ data: MetricForScoring[]; error: string | null }> {
  const { data, error } = await supabase
    .from("metrics")
    .select("id, name, unit, category, metric_type, min_value, max_value, max_attempts")
    .eq("program_id", programId)
    .order("sort_order");

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

/** Fetch metrics for dashboard display (Dashboard). */
export async function fetchMetricsForDashboard(programId: string): Promise<{ data: MetricForDashboard[]; error: string | null }> {
  const { data, error } = await supabase
    .from("metrics")
    .select("id, name, unit, metric_type, aggregation")
    .eq("program_id", programId)
    .order("sort_order");

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

// ── Full metric type (TryoutPlanner) ───────────────────────────────

export interface MetricFull {
  id: string;
  name: string;
  unit: string;
  category: string;
  metric_type: string;
  aggregation: string;
  max_attempts: number;
  sort_order: number;
  min_value: number | null;
  max_value: number | null;
}

/** Fetch all metric fields for the planner view. */
export async function fetchMetricsFull(programId: string): Promise<{ data: MetricFull[]; error: string | null }> {
  const { data, error } = await supabase
    .from("metrics")
    .select("*")
    .eq("program_id", programId)
    .order("sort_order");

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

// ── Mutations ──────────────────────────────────────────────────────

export interface CreateMetricInput {
  program_id: string;
  name: string;
  unit: string;
  category: string;
  metric_type: string;
  aggregation: string;
  max_attempts: number;
  sort_order: number;
  min_value: number | null;
  max_value: number | null;
}

/** Create a new metric (validates input). */
export async function createMetric(input: CreateMetricInput): Promise<{ error: string | null }> {
  const validation = validate(createMetricSchema, input);
  if (!validation.success) {
    return { error: validation.error };
  }
  const validated = validation.data;

  const { error } = await supabase.from("metrics").insert({
    program_id: validated.program_id,
    name: validated.name,
    unit: validated.unit,
    category: validated.category,
    metric_type: validated.metric_type,
    min_value: validated.min_value,
    max_value: validated.max_value,
    sort_order: validated.sort_order,
    aggregation: validated.aggregation,
    max_attempts: validated.max_attempts,
  } as any);

  return { error: error?.message ?? null };
}

/** Update an existing metric's editable fields. */
export async function updateMetric(
  metricId: string,
  input: { name?: string; unit?: string; max_attempts?: number; aggregation?: string; metric_type?: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("metrics")
    .update({
      name: input.name,
      unit: input.unit,
      max_attempts: input.max_attempts,
      aggregation: input.aggregation as any,
      metric_type: input.metric_type as any,
    })
    .eq("id", metricId);

  return { error: error?.message ?? null };
}

/** Delete a metric. */
export async function deleteMetric(metricId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("metrics")
    .delete()
    .eq("id", metricId);

  return { error: error?.message ?? null };
}
