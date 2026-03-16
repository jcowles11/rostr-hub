/**
 * Player Service
 *
 * Extracts all player-related Supabase queries from page components.
 * Used by: Roster.tsx, Dashboard.tsx, ScoreEntry.tsx
 */
import { supabase } from "@/integrations/supabase/client";
import { createPlayerSchema, validate } from "@/lib/validation";

// ── Types ──────────────────────────────────────────────────────────

export interface PlayerListItem {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
  jersey_number_preference: number | null;
  player_number: number | null;
  photo_url: string | null;
  profile_slug: string | null;
  profile_public: boolean;
  team_id: string | null;
}

export interface PlayerSummary {
  id: string;
  first_name: string;
  last_name: string;
  player_number: number | null;
}

export interface PlayerWithGrade extends PlayerSummary {
  grade: number | null;
  positions: string[] | null;
}

export interface CreatePlayerInput {
  program_id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[];
  bats: string | null;
  throws: string | null;
}

// ── Queries ────────────────────────────────────────────────────────

/** Fetch full roster for a program (used by Roster page). */
export async function fetchRosterPlayers(programId: string): Promise<{ data: PlayerListItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, grade, positions, jersey_number_preference, player_number, photo_url, profile_slug, profile_public, team_id")
    .eq("program_id", programId)
    .order("last_name")
    .order("first_name");

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

/** Fetch lightweight player list for scoring (used by ScoreEntry). */
export async function fetchPlayerSummaries(programId: string): Promise<{ data: PlayerSummary[]; error: string | null }> {
  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, player_number")
    .eq("program_id", programId)
    .order("last_name")
    .order("first_name");

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

/** Fetch players with grade/position info for dashboard. */
export async function fetchDashboardPlayers(programId: string): Promise<{ data: PlayerWithGrade[]; error: string | null }> {
  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, grade, positions, player_number")
    .eq("program_id", programId)
    .order("last_name");

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

/** Fetch lightweight name list for duplicate detection during import. */
export async function fetchPlayerNames(
  programId: string
): Promise<{ data: { first_name: string; last_name: string }[]; error: string | null }> {
  const { data, error } = await supabase
    .from("players")
    .select("first_name, last_name")
    .eq("program_id", programId);

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

/** Build a Set of normalized "first|last" keys for O(1) duplicate lookups. */
export function buildPlayerNameIndex(players: { first_name: string; last_name: string }[]): Set<string> {
  return new Set(
    players.map((p) => `${p.first_name.trim().toLowerCase()}|${p.last_name.trim().toLowerCase()}`)
  );
}

// ── Mutations ──────────────────────────────────────────────────────

/** Create a new player (validates input before writing). */
export async function createPlayer(input: CreatePlayerInput): Promise<{ error: string | null }> {
  const validation = validate(createPlayerSchema, input);
  if (!validation.success) {
    return { error: validation.error };
  }
  const validated = validation.data;

  const { error } = await supabase.from("players").insert({
    program_id: validated.program_id,
    first_name: validated.first_name,
    last_name: validated.last_name,
    grade: validated.grade,
    positions: validated.positions,
    bats: validated.bats,
    throws: validated.throws,
  });

  return { error: error?.message ?? null };
}

/** Auto-assign sequential player numbers to unnumbered players. */
export async function autoAssignPlayerNumbers(
  players: { id: string; player_number: number | null }[]
): Promise<{ assignedCount: number; error: string | null }> {
  const unnumbered = players.filter((p) => !p.player_number);
  if (unnumbered.length === 0) {
    return { assignedCount: 0, error: null };
  }

  const maxNum = Math.max(0, ...players.filter((p) => p.player_number).map((p) => p.player_number!));
  let nextNum = maxNum + 1;

  for (const p of unnumbered) {
    const { error } = await supabase
      .from("players")
      .update({ player_number: nextNum++ })
      .eq("id", p.id);
    if (error) {
      return { assignedCount: 0, error: error.message };
    }
  }

  return { assignedCount: unnumbered.length, error: null };
}

/** Delete all players and their child records for a program. */
export async function deleteAllPlayers(
  programId: string,
  playerIds: string[]
): Promise<{ error: string | null }> {
  try {
    const batchSize = 500;
    for (let i = 0; i < playerIds.length; i += batchSize) {
      const batch = playerIds.slice(i, i + batchSize);
      // Delete child records first
      await Promise.all([
        supabase.from("evaluations").delete().in("player_id", batch),
        supabase.from("player_notes").delete().in("player_id", batch),
        supabase.from("roster_assignments").delete().in("player_id", batch),
        supabase.from("session_attendance").delete().in("player_id", batch),
      ]);
      // Then delete players
      await supabase.from("players").delete().in("id", batch);
    }
    // Final sweep for any missed
    await supabase.from("players").delete().eq("program_id", programId);
    return { error: null };
  } catch (err: any) {
    return { error: err?.message ?? "Failed to delete players" };
  }
}

/** Get the registration code for a program. */
export async function getRegistrationCode(programId: string): Promise<{ code: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("programs")
    .select("registration_code")
    .eq("id", programId)
    .single();

  if (error) {
    return { code: null, error: error.message };
  }
  return { code: data?.registration_code ?? null, error: null };
}
