/**
 * Coach Service
 *
 * Lightweight queries for coach/evaluator data.
 * Used by: Dashboard (evaluator filter)
 */
import { supabase } from "@/integrations/supabase/client";
import { addCoachSchema, validate } from "@/lib/validation";

export interface CoachSummary {
  id: string;
  full_name: string | null;
  role: string;
}

export interface CoachWithColor {
  id: string;
  full_name: string;
  color: string;
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

/** Fetch coaches with color for assignment dropdowns (practice plans, etc.). */
export async function fetchCoachesWithColor(
  programId: string
): Promise<{ data: CoachWithColor[]; error: string | null }> {
  const { data, error } = await supabase
    .from("coaches")
    .select("id, full_name, color")
    .eq("program_id", programId);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CoachWithColor[], error: null };
}

export interface CoachDetail {
  id: string;
  full_name: string;
  email: string;
  role: string;
  color: string;
}

/** Fetch all coaches with detail fields for a program. */
export async function fetchCoachDetails(
  programId: string
): Promise<{ data: CoachDetail[]; error: string | null }> {
  const { data, error } = await supabase
    .from("coaches")
    .select("id, full_name, email, role, color")
    .eq("program_id", programId);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CoachDetail[], error: null };
}

/** Check if a coach with the given email already exists in a program. */
export async function checkCoachExists(
  programId: string,
  email: string
): Promise<{ exists: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from("coaches")
    .select("id")
    .eq("program_id", programId)
    .eq("email", email)
    .maybeSingle();

  if (error) return { exists: false, error: error.message };
  return { exists: !!data, error: null };
}

/** Add a new assistant coach to a program (validates input before writing). */
export async function addCoach(params: {
  programId: string;
  fullName: string;
  email: string;
  color: string;
}): Promise<{ error: string | null }> {
  const validation = validate(addCoachSchema, params);
  if (!validation.success) {
    return { error: validation.error };
  }
  const validated = validation.data;

  const { error } = await supabase.from("coaches").insert({
    user_id: crypto.randomUUID(),
    program_id: validated.programId,
    full_name: validated.fullName,
    email: validated.email,
    role: "assistant_coach",
    color: validated.color,
  });

  return { error: error?.message ?? null };
}

/** Remove a coach by ID. */
export async function removeCoach(
  coachId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("coaches")
    .delete()
    .eq("id", coachId);

  return { error: error?.message ?? null };
}
