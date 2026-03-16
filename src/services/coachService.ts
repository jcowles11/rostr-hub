/**
 * Coach Service
 *
 * Lightweight queries for coach/evaluator data.
 * Used by: Dashboard (evaluator filter)
 */
import { supabase } from "@/integrations/supabase/client";

export interface CoachSummary {
  id: string;
  full_name: string | null;
  role: string;
}

/** Fetch all coaches for a program (for evaluator filter dropdowns). */
export async function fetchProgramCoaches(
  programId: string
): Promise<{ data: CoachSummary[]; error: string | null }> {
  const { data, error } = await supabase
    .from("coaches")
    .select("id, full_name, role")
    .eq("program_id", programId)
    .order("role")
    .order("full_name");

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}
