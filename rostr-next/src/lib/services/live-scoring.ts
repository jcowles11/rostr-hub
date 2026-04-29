import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Live scoring service — reads from the append-only game_events log
 * introduced in migration 000016.
 *
 * Key insight: everything downstream (box scores, career stats,
 * MaxPreps exports, fan viewer feed) reads from this same event
 * stream. Events are append-only — "corrections" are separate events,
 * not UPDATE operations.
 */

export type EventType =
  | "game_start"
  | "inning_change"
  | "at_bat"
  | "substitution"
  | "pitcher_change"
  | "correction"
  | "note"
  | "game_end";

/** Canonical at-bat outcomes. */
export type AtBatOutcome =
  | "1B"
  | "2B"
  | "3B"
  | "HR"
  | "BB"
  | "HBP"
  | "K"
  | "GO"  // ground out
  | "FO"  // fly out / line out / pop out (umbrella)
  | "E"   // reached on error
  | "FC"  // fielder's choice
  | "SAC" // sacrifice
  | "GIDP" // grounded into double play (batter + lead force runner out)
  | "CI";  // catcher's interference — batter awarded 1st, no AB

export interface LiveGameState {
  gameId: string;
  programId: string;
  opponentProgramId: string | null;
  opponent: string | null;
  homeAway: "home" | "away" | "neutral";
  teamLevel: string | null;
  liveStatus: "not_started" | "in_progress" | "final";
  liveStartedAt: string | null;
  ourScore: number | null;
  opponentScore: number | null;
  /** Latest recorded event across home stream. */
  latestEvent: GameEvent | null;
  eventCount: number;
}

export interface GameEvent {
  id: string;
  gameId: string;
  sequence: number;
  eventType: EventType;
  inning: number | null;
  topBottom: "top" | "bottom" | null;
  outsAfter: number | null;
  homeScore: number | null;
  awayScore: number | null;
  /** Resolved human name for display (respects ad-hoc names). */
  playerName: string | null;
  playerJersey: number | null;
  playerId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  loggedBySide: "home" | "away";
}

/**
 * fetchLiveGameState — single query that gives the fan viewer +
 * scorekeeper everything they need to render the banner (score,
 * inning, count, most recent event).
 */
export async function fetchLiveGameState(
  gameId: string,
): Promise<LiveGameState | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("live_game_snapshot")
    .select(
      "game_id, program_id, opponent_program_id, opponent, home_away, team_level, live_status, our_score, opponent_score, latest_event, event_count",
    )
    .eq("game_id", gameId)
    .maybeSingle();
  if (error || !data) return null;

  // Pull live_started_at separately (not in the view)
  const { data: gameRow } = await supabase
    .from("games")
    .select("live_started_at")
    .eq("id", gameId)
    .maybeSingle();

  const latest = (data.latest_event as Record<string, unknown> | null) ?? null;
  return {
    gameId: data.game_id,
    programId: data.program_id,
    opponentProgramId: data.opponent_program_id,
    opponent: data.opponent,
    homeAway: (data.home_away ?? "home") as LiveGameState["homeAway"],
    teamLevel: data.team_level,
    liveStatus: (data.live_status ?? "not_started") as LiveGameState["liveStatus"],
    liveStartedAt: gameRow?.live_started_at ?? null,
    ourScore: data.our_score,
    opponentScore: data.opponent_score,
    eventCount: data.event_count ?? 0,
    latestEvent: latest ? hydrateEvent(latest, data.game_id) : null,
  };
}

export async function fetchGameEvents(
  gameId: string,
  limit = 200,
): Promise<GameEvent[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("public_game_events")
    .select(
      "id, game_id, sequence, event_type, inning, top_bottom, outs_after, home_score, away_score, payload, created_at, player_name, player_jersey",
    )
    .eq("game_id", gameId)
    .order("sequence", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    gameId: r.game_id,
    sequence: r.sequence,
    eventType: r.event_type as EventType,
    inning: r.inning,
    topBottom: r.top_bottom as "top" | "bottom" | null,
    outsAfter: r.outs_after,
    homeScore: r.home_score,
    awayScore: r.away_score,
    playerName: r.player_name,
    playerJersey: r.player_jersey,
    playerId: null, // not exposed via public view
    payload: (r.payload ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
    loggedBySide: "home", // public view filters to home side only
  }));
}

function hydrateEvent(
  raw: Record<string, unknown>,
  gameId: string,
): GameEvent {
  return {
    id: (raw.id as string) ?? "",
    gameId,
    sequence: (raw.sequence as number) ?? 0,
    eventType: (raw.event_type as EventType) ?? "at_bat",
    inning: (raw.inning as number | null) ?? null,
    topBottom: (raw.top_bottom as "top" | "bottom" | null) ?? null,
    outsAfter: (raw.outs_after as number | null) ?? null,
    homeScore: (raw.home_score as number | null) ?? null,
    awayScore: (raw.away_score as number | null) ?? null,
    playerName: null,
    playerJersey: null,
    playerId: null,
    payload: (raw.payload as Record<string, unknown>) ?? {},
    createdAt: (raw.created_at as string) ?? new Date().toISOString(),
    loggedBySide: "home",
  };
}

// ── Cross-team linking ──────────────────────────────────────────

/**
 * searchProgramsByName — for the "link opponent" picker on game
 * detail. Coach types a school name; returns matching programs.
 */
export interface ProgramLookupResult {
  id: string;
  name: string;
  schoolName: string | null;
  sport: string | null;
}

export async function searchProgramsByName(
  query: string,
  excludeProgramId: string,
  limit = 10,
): Promise<ProgramLookupResult[]> {
  if (!query.trim()) return [];
  const supabase = createSupabaseServerClient();
  const q = query.trim();
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, school_name, sport")
    .neq("id", excludeProgramId)
    .or(`name.ilike.%${q}%,school_name.ilike.%${q}%`)
    .limit(limit);
  if (error || !data) return [];
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    schoolName: p.school_name,
    sport: p.sport,
  }));
}

/**
 * fetchOpposingRoster — when a game is linked to an opposing program,
 * pull that team's roster so the scorekeeper can tap to score their
 * at-bats without creating ad-hoc names.
 */
export interface OpposingPlayer {
  id: string;
  firstName: string;
  lastName: string;
  jersey: number | null;
  positions: string[];
  teamLevel: string | null;
}

export async function fetchOpposingRoster(
  gameId: string,
): Promise<OpposingPlayer[]> {
  const supabase = createSupabaseServerClient();
  const { data: game } = await supabase
    .from("games")
    .select("opponent_program_id, team_level")
    .eq("id", gameId)
    .maybeSingle();
  if (!game?.opponent_program_id) return [];

  const { data: players } = await supabase
    .from("players")
    .select("id, first_name, last_name, player_number, positions, roster_assignments(assignment)")
    .eq("program_id", game.opponent_program_id);
  if (!players) return [];

  // If the game has a team_level, prefer players assigned to that level.
  const wantLevel = (game.team_level ?? "").toLowerCase();
  return players
    .map((p) => {
      const ra = Array.isArray(p.roster_assignments) ? p.roster_assignments[0] : p.roster_assignments;
      const level = (ra as { assignment?: string } | null)?.assignment ?? null;
      return {
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        jersey: p.player_number,
        positions: (p.positions ?? []) as string[],
        teamLevel: level,
      };
    })
    .filter((p) =>
      wantLevel
        ? (p.teamLevel ?? "").toLowerCase() === wantLevel
        : true,
    )
    .sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));
}
