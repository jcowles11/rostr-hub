import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ProgramRecord {
  wins: number;
  losses: number;
  ties: number;
  gamesCompleted: number;
  runsFor: number;
  runsAgainst: number;
  byLevel: Array<{
    teamLevel: string | null;
    wins: number;
    losses: number;
    ties: number;
    gamesCompleted: number;
    runsFor: number;
    runsAgainst: number;
  }>;
}

/**
 * fetchProgramRecord — W/L totals by team level + program-wide totals.
 * Powers the Hub stat row's "Record" tile and the game Recap tab.
 */
export async function fetchProgramRecord(
  programId: string,
): Promise<ProgramRecord> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("program_record_by_level")
    .select("team_level, wins, losses, ties, games_completed, runs_for, runs_against")
    .eq("program_id", programId);

  const byLevel = (data ?? []).map((r) => ({
    teamLevel: r.team_level,
    wins: r.wins ?? 0,
    losses: r.losses ?? 0,
    ties: r.ties ?? 0,
    gamesCompleted: r.games_completed ?? 0,
    runsFor: r.runs_for ?? 0,
    runsAgainst: r.runs_against ?? 0,
  }));

  const totals = byLevel.reduce(
    (acc, r) => ({
      wins: acc.wins + r.wins,
      losses: acc.losses + r.losses,
      ties: acc.ties + r.ties,
      gamesCompleted: acc.gamesCompleted + r.gamesCompleted,
      runsFor: acc.runsFor + r.runsFor,
      runsAgainst: acc.runsAgainst + r.runsAgainst,
    }),
    { wins: 0, losses: 0, ties: 0, gamesCompleted: 0, runsFor: 0, runsAgainst: 0 },
  );

  return { ...totals, byLevel };
}

export interface GameDetail {
  id: string;
  name: string;
  opponent: string | null;
  gameDate: string;
  gameTime: string | null;
  location: string | null;
  homeAway: string;
  teamLevel: string | null;
  status: string;
  /** Final score for our team, or null if the game hasn't been recorded. */
  ourScore: number | null;
  /** Final score for the opponent. */
  opponentScore: number | null;
  /** Derived from scores: 'W' | 'L' | 'T' | null. */
  result: "W" | "L" | "T" | null;
  recapNotes: string | null;
  completedAt: string | null;
  opponentProgramId: string | null;
  liveStatus: "not_started" | "in_progress" | "final";
  /** Game-prep fields — shown to players + parents in advance. */
  reportTime: string | null;       // time of day, HH:MM:SS
  releaseTime: string | null;      // school release time
  uniform: string | null;
  equipmentNotes: string | null;
  lineupPreview: string | null;
  prepNotes: string | null;
}

export interface GameRosterEntry {
  playerId: string;
  status: string;
}

export interface LineupEntryRecord {
  playerId: string;
  battingOrder: number;
  position: string;
}

export async function fetchGameDetail(gameId: string): Promise<{
  game: GameDetail | null;
  rosterPlayerIds: string[];
  lineup: LineupEntryRecord[];
}> {
  const supabase = createSupabaseServerClient();

  // SELECT splits into base columns (guaranteed by the original team-
  // management migration 000005) + optional columns added in later
  // migrations (000016 live_scoring, 000022 player_media_and_game_prep).
  // If a coach's database hasn't had the later migrations applied yet,
  // the full SELECT errors with "column does not exist" and the page
  // would 404 — try the full SELECT first, fall back to the base set
  // on schema-mismatch errors so the game detail still renders.
  const BASE_SELECT =
    "id, name, opponent, game_date, game_time, location, home_away, team_level, status, our_score, opponent_score, result, recap_notes, completed_at";
  const FULL_SELECT =
    BASE_SELECT +
    ", opponent_program_id, live_status, report_time, release_time, uniform, equipment_notes, lineup_preview, prep_notes";

  const isMissingColumnError = (msg: string): boolean =>
    /column .* does not exist/i.test(msg) ||
    /could not find the .* column/i.test(msg);

  const [fullRes, rosterRes, lineupRes] = await Promise.all([
    supabase.from("games").select(FULL_SELECT).eq("id", gameId).maybeSingle(),
    supabase.from("game_rosters").select("player_id, status").eq("game_id", gameId),
    supabase
      .from("lineup_entries")
      .select("player_id, batting_order, position")
      .eq("game_id", gameId)
      .order("batting_order", { ascending: true }),
  ]);

  let row: Record<string, unknown> | null =
    (fullRes.data as Record<string, unknown> | null) ?? null;
  if (fullRes.error && isMissingColumnError(fullRes.error.message)) {
    // Schema is older — re-query with base columns only.
    const baseRes = await supabase
      .from("games")
      .select(BASE_SELECT)
      .eq("id", gameId)
      .maybeSingle();
    if (baseRes.error || !baseRes.data) {
      return { game: null, rosterPlayerIds: [], lineup: [] };
    }
    row = baseRes.data as Record<string, unknown>;
  } else if (fullRes.error || !fullRes.data) {
    return { game: null, rosterPlayerIds: [], lineup: [] };
  }
  if (!row) return { game: null, rosterPlayerIds: [], lineup: [] };

  // Helper for optional columns: returns the field if present, otherwise null.
  const opt = <T>(key: string): T | null => (row && key in row ? (row[key] as T) : null);

  return {
    game: {
      id: row.id as string,
      name: ((row.name as string | null) ?? "") as string,
      opponent: row.opponent as string | null,
      gameDate: row.game_date as string,
      gameTime: row.game_time as string | null,
      location: row.location as string | null,
      homeAway: ((row.home_away as string | null) ?? "home") as string,
      teamLevel: row.team_level as string | null,
      status: ((row.status as string | null) ?? "scheduled"),
      ourScore: (row.our_score as number | null) ?? null,
      opponentScore: (row.opponent_score as number | null) ?? null,
      result: ((row.result as string | null) ?? null) as "W" | "L" | "T" | null,
      recapNotes: (row.recap_notes as string | null) ?? null,
      completedAt: (row.completed_at as string | null) ?? null,
      // Optional fields — null when migration 000016 / 000022 not applied.
      opponentProgramId: opt<string>("opponent_program_id"),
      liveStatus: (opt<string>("live_status") ?? "not_started") as
        | "not_started"
        | "in_progress"
        | "final",
      reportTime: opt<string>("report_time"),
      releaseTime: opt<string>("release_time"),
      uniform: opt<string>("uniform"),
      equipmentNotes: opt<string>("equipment_notes"),
      lineupPreview: opt<string>("lineup_preview"),
      prepNotes: opt<string>("prep_notes"),
    },
    rosterPlayerIds: (rosterRes.data ?? []).map((r) => r.player_id),
    lineup: (lineupRes.data ?? []).map((l) => ({
      playerId: l.player_id,
      battingOrder: l.batting_order,
      position: l.position,
    })),
  };
}
