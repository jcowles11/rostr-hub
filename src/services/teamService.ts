/**
 * Team, Season & Game Management Service
 *
 * Covers: team/season queries (Roster filtering), game CRUD,
 * game roster management, and lineup entry management.
 *
 * Used by: Roster.tsx, TeamManagement.tsx, GameDetail.tsx
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
}

export interface Season {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Game {
  id: string;
  program_id: string;
  season_id: string | null;
  name: string;
  opponent: string | null;
  team_level: string | null;
  game_date: string;
  game_time: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  created_by: string;
  created_at: string;
}

export interface GameRosterEntry {
  id: string;
  game_id: string;
  player_id: string;
  status: string;
}

export interface LineupEntry {
  id: string;
  game_id: string;
  player_id: string;
  batting_order: number | null;
  position: string | null;
  inning_half: string | null;
  notes: string | null;
}

// ── Team & Season Queries ─────────────────────────────────────────

/** Fetch teams for a program. */
export async function fetchTeams(programId: string): Promise<{ data: Team[]; error: string | null }> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name")
    .eq("program_id", programId)
    .order("name");

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

/** Fetch seasons for a program. */
export async function fetchSeasons(programId: string): Promise<{ data: Season[]; error: string | null }> {
  const { data, error } = await supabase
    .from("seasons")
    .select("id, name, is_active")
    .eq("program_id", programId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

// ── Game CRUD ─────────────────────────────────────────────────────

/** Fetch all games for a program, ordered by date descending. */
export async function fetchGames(programId: string): Promise<{ data: Game[]; error: string | null }> {
  const { data, error } = await supabase
    .from("games")
    .select("id, program_id, season_id, name, opponent, team_level, game_date, game_time, location, notes, status, created_by, created_at")
    .eq("program_id", programId)
    .order("game_date", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

/** Create a new game. */
export async function createGame(game: {
  program_id: string;
  name: string;
  created_by: string;
  opponent?: string;
  team_level?: string;
  game_date?: string;
  game_time?: string;
  location?: string;
  season_id?: string;
  notes?: string;
}): Promise<{ data: Game | null; error: string | null }> {
  const { data, error } = await supabase
    .from("games")
    .insert({
      program_id: game.program_id,
      name: game.name,
      created_by: game.created_by,
      opponent: game.opponent || null,
      team_level: game.team_level || null,
      game_date: game.game_date || new Date().toISOString().split("T")[0],
      game_time: game.game_time || null,
      location: game.location || null,
      season_id: game.season_id || null,
      notes: game.notes || null,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

/** Update an existing game. */
export async function updateGame(
  gameId: string,
  updates: Partial<Pick<Game, "name" | "opponent" | "team_level" | "game_date" | "game_time" | "location" | "notes" | "status">>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("games")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", gameId);

  return { error: error?.message ?? null };
}

/** Delete a game (cascades to game_rosters and lineup_entries). */
export async function deleteGame(gameId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("games").delete().eq("id", gameId);
  return { error: error?.message ?? null };
}

// ── Game Roster ───────────────────────────────────────────────────

/** Fetch game roster entries for a specific game. */
export async function fetchGameRoster(gameId: string): Promise<{ data: GameRosterEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from("game_rosters")
    .select("id, game_id, player_id, status")
    .eq("game_id", gameId);

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

/** Set game roster: upserts player entries, removes unlisted players. */
export async function setGameRoster(
  gameId: string,
  playerIds: string[],
  status: string = "active"
): Promise<{ error: string | null }> {
  // Remove existing entries not in the new list
  const { error: delError } = await supabase
    .from("game_rosters")
    .delete()
    .eq("game_id", gameId)
    .not("player_id", "in", `(${playerIds.join(",")})`);
  if (delError) return { error: delError.message };

  if (playerIds.length === 0) return { error: null };

  // Upsert new entries
  const rows = playerIds.map((pid) => ({ game_id: gameId, player_id: pid, status }));
  const { error } = await supabase
    .from("game_rosters")
    .upsert(rows, { onConflict: "game_id,player_id" });

  return { error: error?.message ?? null };
}

/** Update a single game roster entry status. */
export async function updateGameRosterStatus(
  gameId: string,
  playerId: string,
  status: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("game_rosters")
    .update({ status })
    .eq("game_id", gameId)
    .eq("player_id", playerId);

  return { error: error?.message ?? null };
}

// ── Lineup Entries ────────────────────────────────────────────────

/** Fetch lineup entries for a game, ordered by batting order. */
export async function fetchLineup(gameId: string): Promise<{ data: LineupEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from("lineup_entries")
    .select("id, game_id, player_id, batting_order, position, inning_half, notes")
    .eq("game_id", gameId)
    .order("batting_order", { ascending: true, nullsFirst: false });

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

/** Save full lineup for a game (replace all entries). */
export async function saveLineup(
  gameId: string,
  entries: Array<{ player_id: string; batting_order?: number | null; position?: string | null; notes?: string | null }>
): Promise<{ error: string | null }> {
  // Clear existing
  const { error: delError } = await supabase
    .from("lineup_entries")
    .delete()
    .eq("game_id", gameId);
  if (delError) return { error: delError.message };

  if (entries.length === 0) return { error: null };

  const rows = entries.map((e) => ({
    game_id: gameId,
    player_id: e.player_id,
    batting_order: e.batting_order ?? null,
    position: e.position ?? null,
    notes: e.notes ?? null,
  }));

  const { error } = await supabase.from("lineup_entries").insert(rows);
  return { error: error?.message ?? null };
}

/** Update a single lineup entry (position or batting order). */
export async function updateLineupEntry(
  gameId: string,
  playerId: string,
  updates: Partial<Pick<LineupEntry, "batting_order" | "position" | "notes">>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("lineup_entries")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("game_id", gameId)
    .eq("player_id", playerId);

  return { error: error?.message ?? null };
}
