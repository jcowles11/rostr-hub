import { supabase } from "@/integrations/supabase/client";

export interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
  player_number: number | null;
}

export interface RosterAssignmentRow {
  id: string;
  player_id: string;
  assignment: string;
}

/** Fetch roster assignment for a single player (PlayerDetail). */
export async function fetchPlayerRosterAssignment(
  playerId: string
): Promise<{ data: { assignment: string } | null; error: string | null }> {
  const { data, error } = await supabase
    .from("roster_assignments")
    .select("assignment")
    .eq("player_id", playerId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function fetchPlayers(programId: string): Promise<{ data: PlayerRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, grade, positions, player_number")
    .eq("program_id", programId)
    .order("last_name");

  if (error) return { data: [], error: error.message };
  return { data: (data || []) as PlayerRow[], error: null };
}

export async function fetchRosterAssignments(programId: string): Promise<{ data: RosterAssignmentRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("roster_assignments")
    .select("id, player_id, assignment")
    .eq("program_id", programId);

  if (error) return { data: [], error: error.message };
  return { data: (data || []) as RosterAssignmentRow[], error: null };
}

export async function updateRosterAssignment(id: string, assignment: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("roster_assignments")
    .update({ assignment: assignment as any })
    .eq("id", id);

  return { error: error ? error.message : null };
}

export async function createRosterAssignment(params: {
  programId: string;
  playerId: string;
  assignment: string;
  assignedBy: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("roster_assignments").insert({
    program_id: params.programId,
    player_id: params.playerId,
    assignment: params.assignment as any,
    assigned_by: params.assignedBy,
  });

  return { error: error ? error.message : null };
}
