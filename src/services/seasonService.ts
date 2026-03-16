import { supabase } from "@/integrations/supabase/client";
import { createSeasonSchema, validate } from "@/lib/validation";

// ── Types ──────────────────────────────────────────────────────────

export interface Season {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

// ── Queries ─────────────────────────────────────────────────────────

/** Fetch all seasons for a program, newest first. */
export async function fetchSeasons(
  programId: string
): Promise<{ data: Season[]; error: string | null }> {
  const { data, error } = await supabase
    .from("seasons")
    .select("id, name, start_date, end_date, is_active")
    .eq("program_id", programId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

// ── Mutations ───────────────────────────────────────────────────────

/** Create a new season (validates input before writing). */
export async function createSeason(
  programId: string,
  name: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const validation = validate(createSeasonSchema, {
    program_id: programId,
    name,
    is_active: isActive,
  });
  if (!validation.success) {
    return { error: validation.error };
  }
  const validated = validation.data;

  const { error } = await supabase.from("seasons").insert({
    program_id: validated.program_id,
    name: validated.name,
    is_active: validated.is_active,
  });

  return { error: error ? "Failed to create season" : null };
}

/** Set a season as the active one (deactivates all others in the program). */
export async function setActiveSeason(
  programId: string,
  seasonId: string
): Promise<{ error: string | null }> {
  const { error: deactivateErr } = await supabase
    .from("seasons")
    .update({ is_active: false })
    .eq("program_id", programId);

  if (deactivateErr) return { error: deactivateErr.message };

  const { error } = await supabase
    .from("seasons")
    .update({ is_active: true })
    .eq("id", seasonId);

  return { error: error ? error.message : null };
}

/** Delete a season by id. */
export async function deleteSeason(
  seasonId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("seasons")
    .delete()
    .eq("id", seasonId);

  return { error: error ? "Failed to delete season" : null };
}
