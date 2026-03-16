/**
 * Evaluator Service
 *
 * Extracts evaluator-related Supabase mutations from page components.
 * Used by: EvaluatorDashboard.tsx, EvaluatorSubmitForm.tsx
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────

export interface ExternalEntryRow {
  id: string;
  metric_name: string;
  metric_unit: string;
  metric_type: string;
  metric_value: number;
  event_name: string | null;
  event_date: string | null;
  notes: string | null;
  created_at: string;
  evaluator_id: string;
}

export interface EvaluatorInfo {
  id: string;
  full_name: string;
  organization_name: string;
}

// ── Queries ────────────────────────────────────────────────────────

/** Fetch external evaluator entries for a player, with evaluator details joined. */
export async function fetchPlayerExternalEntries(
  playerId: string
): Promise<{
  data: Array<Omit<ExternalEntryRow, "evaluator_id"> & { evaluator: EvaluatorInfo | null }>;
  error: string | null;
}> {
  const { data: extData, error } = await supabase
    .from("evaluator_entries")
    .select("id, metric_name, metric_unit, metric_type, metric_value, event_name, event_date, notes, created_at, evaluator_id")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  if (!extData || extData.length === 0) return { data: [], error: null };

  const evalIds = [...new Set(extData.map((e) => e.evaluator_id))];
  const { data: evaluators } = await supabase
    .from("evaluators")
    .select("id, full_name, organization_name")
    .in("id", evalIds);

  const evalMap = new Map((evaluators ?? []).map((ev) => [ev.id, ev]));

  return {
    data: extData.map((e) => ({
      id: e.id,
      metric_name: e.metric_name,
      metric_unit: e.metric_unit,
      metric_type: e.metric_type,
      metric_value: e.metric_value,
      event_name: e.event_name,
      event_date: e.event_date,
      notes: e.notes,
      created_at: e.created_at,
      evaluator: evalMap.get(e.evaluator_id) as EvaluatorInfo || null,
    })),
    error: null,
  };
}

// ── Mutations ──────────────────────────────────────────────────────

/** Create an evaluator profile. */
export async function createEvaluatorProfile(
  userId: string,
  fullName: string,
  organizationName: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("evaluators").insert({
    user_id: userId,
    full_name: fullName,
    organization_name: organizationName,
  });
  return { error: error?.message ?? null };
}

/** Submit an evaluator entry for a player. */
export async function submitEvaluatorEntry(input: {
  evaluator_id: string;
  player_id: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  metric_type: string;
  event_name: string | null;
  event_date: string | null;
  notes: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("evaluator_entries").insert(input);
  return { error: error?.message ?? null };
}
