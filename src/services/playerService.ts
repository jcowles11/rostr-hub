/**
 * Player Service
 *
 * Extracts all player-related Supabase queries from page components.
 * Used by: Roster.tsx, Dashboard.tsx, ScoreEntry.tsx
 */
import { supabase } from "@/integrations/supabase/client";
import {
  createPlayerSchema,
  updatePlayerProfileSchema,
  validate,
  type UpdatePlayerProfileInput,
} from "@/lib/validation";

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

/** Fetch a single player by ID (PlayerDetail). */
export async function fetchPlayerById(playerId: string): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Record<string, unknown>, error: null };
}

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

/** Lightweight player info used during data import matching. */
export interface PlayerImportSummary {
  id: string;
  first_name: string;
  last_name: string;
}

/** Fetch lightweight player list for import matching (includes id). */
export async function fetchPlayerImportSummaries(programId: string): Promise<{ data: PlayerImportSummary[]; error: string | null }> {
  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name")
    .eq("program_id", programId);

  if (error) return { data: [], error: error.message };
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

/** Bulk-create players from import (validates names, returns IDs). */
export async function bulkCreatePlayers(
  players: Array<{
    program_id: string;
    first_name: string;
    last_name: string;
    positions?: string[];
    bats?: string | null;
    throws?: string | null;
    grade?: number | null;
    graduation_year?: number | null;
    height?: string | null;
    weight?: number | null;
  }>
): Promise<{ data: Array<{ id: string; first_name: string; last_name: string }> | null; error: string | null }> {
  // Validate each player has at minimum a name
  for (const p of players) {
    const first = (p.first_name || "").trim();
    const last = (p.last_name || "").trim();
    if (!first && !last) {
      return { data: null, error: "Each player must have a first or last name" };
    }
  }

  const rows = players.map((p) => ({
    program_id: p.program_id,
    first_name: (p.first_name || "Unknown").trim(),
    last_name: (p.last_name || "Player").trim(),
    positions: p.positions || [],
    bats: p.bats || null,
    throws: p.throws || null,
    grade: p.grade || null,
    graduation_year: p.graduation_year || null,
    height: p.height || null,
    weight: p.weight || null,
  }));

  const { data, error } = await supabase
    .from("players")
    .insert(rows)
    .select("id, first_name, last_name");

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

/** Update a player's profile fields (validates input before writing). */
export async function updatePlayerProfile(
  playerId: string,
  updates: UpdatePlayerProfileInput
): Promise<{ error: string | null }> {
  if (!playerId) return { error: "Missing player ID" };
  if (Object.keys(updates).length === 0) return { error: null };

  const validation = validate(updatePlayerProfileSchema, updates);
  if (!validation.success) {
    return { error: validation.error };
  }

  const { error } = await supabase
    .from("players")
    .update(validation.data)
    .eq("id", playerId);
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

// ── Player Profile Settings ─────────────────────────────────────────

/** Fetch player profile fields for the settings page. */
export async function fetchPlayerProfileFields(
  playerId: string
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const { data, error } = await supabase
    .from("players")
    .select("profile_public, show_contact_info, graduation_year, grade, birthday, high_school, positions, bats, throws, height, weight, gpa, social_twitter, social_instagram, highlight_video_url, profile_slug, recruiting_status, committed_school_name, committed_school_logo_url, commitment_date, city, state, email, phone, gamechanger_profile_url, maxpreps_profile_url")
    .eq("id", playerId)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as unknown as Record<string, unknown>, error: null };
}

/** Save player profile settings (excluding profile_slug). */
export async function savePlayerProfile(
  playerId: string,
  fields: Record<string, unknown>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("players")
    .update(fields as any)
    .eq("id", playerId);

  return { error: error ? "Failed to save profile settings" : null };
}

// ── Visibility ──────────────────────────────────────────────────────

export interface PlayerVisibilityItem {
  id: string;
  first_name: string;
  last_name: string;
  player_number: number | null;
  results_visible: boolean | null;
}

/** Fetch player visibility info for the visibility manager. */
export async function fetchPlayerVisibility(
  programId: string
): Promise<{ data: PlayerVisibilityItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, player_number, results_visible")
    .eq("program_id", programId)
    .order("last_name");

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as PlayerVisibilityItem[], error: null };
}

/** Update a player's results_visible flag. */
export async function updatePlayerResultsVisible(
  playerId: string,
  resultsVisible: boolean | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("players")
    .update({ results_visible: resultsVisible })
    .eq("id", playerId);

  return { error: error?.message ?? null };
}

/** Bulk insert players (for roster upload). */
export async function bulkInsertPlayers(
  players: Array<{
    program_id: string;
    first_name: string;
    last_name: string;
    grade: number | null;
    positions: string[];
    jersey_number_preference: number | null;
    bats: string | null;
    throws: string | null;
  }>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("players").insert(players);
  return { error: error?.message ?? null };
}

// ── Club Teams ──────────────────────────────────────────────────────

export interface ClubTeamItem {
  id: string;
  name: string;
  is_current: boolean;
}

/** Fetch club teams for a player. */
export async function fetchClubTeams(
  playerId: string
): Promise<{ data: ClubTeamItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from("player_club_teams")
    .select("id, name, is_current")
    .eq("player_id", playerId)
    .order("is_current", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

/** Add a club team for a player. */
export async function addPlayerClubTeam(
  playerId: string,
  name: string
): Promise<{ data: ClubTeamItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from("player_club_teams")
    .insert({ player_id: playerId, name, is_current: true } as any)
    .select("id, name, is_current")
    .single();

  if (error) return { data: null, error: "Failed to add club team" };
  return { data: data as ClubTeamItem, error: null };
}

/** Remove a club team. */
export async function removePlayerClubTeam(
  clubTeamId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("player_club_teams")
    .delete()
    .eq("id", clubTeamId);

  return { error: error ? error.message : null };
}

/** Toggle current status of a club team. */
export async function togglePlayerClubTeamCurrent(
  clubTeamId: string,
  isCurrent: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("player_club_teams")
    .update({ is_current: !isCurrent } as any)
    .eq("id", clubTeamId);

  return { error: error ? error.message : null };
}

// ── Player Photo ────────────────────────────────────────────────────

/** Update a player's photo URL. */
export async function updatePlayerPhoto(
  playerId: string,
  photoUrl: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("players")
    .update({ photo_url: photoUrl })
    .eq("id", playerId);
  return { error: error?.message ?? null };
}

// ── Player-Facing Join / Link / Register ────────────────────────────

/** Join a program by updating an existing standalone player's program_id. */
export async function joinProgramByCode(
  playerId: string,
  programId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("players")
    .update({ program_id: programId })
    .eq("id", playerId);
  return { error: error?.message ?? null };
}

/** Link an existing unclaimed player record to a user (claim + update fields). */
export async function linkPlayerToUser(
  playerId: string,
  userId: string,
  fields: Record<string, unknown>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("players")
    .update({ user_id: userId, ...fields })
    .eq("id", playerId);
  return { error: error?.message ?? null };
}

/** Create a new player record (used by link page, register page, join page). */
export async function insertPlayer(
  fields: Record<string, unknown>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("players").insert(fields as any);
  return { error: error?.message ?? null };
}

/** Create a program join request. */
export async function createJoinRequest(
  programId: string,
  userId: string,
  playerName: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("program_join_requests").insert({
    program_id: programId,
    user_id: userId,
    player_name: playerName,
  } as any);
  return { error: error?.message ?? null };
}

/** Register a player for tryouts (public registration form). */
export async function registerPlayerForTryouts(input: {
  program_id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[];
  jersey_number_preference: number | null;
  travel_ball_experience: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
  photo_url: string | null;
  bats: string | null;
  throws: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("players").insert(input);
  return { error: error?.message ?? null };
}
