import { createSupabaseServerClient } from "@/lib/supabase/server";
export { formatAvg } from "@/lib/format";

/**
 * Batting stats service — reads from the on-the-fly views introduced
 * in migration 000018 (player_career_batting, player_season_batting,
 * program_batting_leaders, player_game_batting).
 *
 * Everything is computed from the append-only game_events log, so
 * the second a coach logs an at-bat on the live-scoring page, these
 * numbers update. No snapshots, no cron jobs, no refresh triggers.
 */

export interface BattingLine {
  games: number;
  pa: number;
  ab: number;
  h: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  sac: number;
  rbi: number;
  ba: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface PlayerBattingLine extends BattingLine {
  playerId: string;
}

export interface SeasonBattingLine extends PlayerBattingLine {
  programId: string;
  seasonYear: number;
}

export async function fetchPlayerCareerBatting(
  playerId: string,
): Promise<PlayerBattingLine | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("player_career_batting")
    .select(
      "player_id, games, pa, ab, h, singles, doubles, triples, hr, bb, hbp, k, sac, rbi, ba, obp, slg, ops",
    )
    .eq("player_id", playerId)
    .maybeSingle();
  if (!error && data && (data.games ?? 0) > 0) return toBattingLine(data);

  // Fall back to imported rows (summed across seasons). Coaches who
  // haven't live-scored in Rostr yet rely on GameChanger-imported data.
  const { data: imp } = await supabase
    .from("player_imported_batting")
    .select(
      "player_id, games, pa, ab, h, singles, doubles, triples, hr, bb, hbp, k, sac, rbi, ba, obp, slg, ops",
    )
    .eq("player_id", playerId);
  if (!imp || imp.length === 0) return null;
  return sumBattingRows(imp, playerId);
}

export async function fetchPlayerSeasonBatting(
  playerId: string,
): Promise<SeasonBattingLine | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("player_season_batting")
    .select(
      "player_id, program_id, season_year, games, pa, ab, h, singles, doubles, triples, hr, bb, hbp, k, sac, rbi, ba, obp, slg, ops",
    )
    .eq("player_id", playerId)
    .maybeSingle();
  if (!error && data && (data.games ?? 0) > 0) {
    return {
      ...toBattingLine(data),
      programId: data.program_id,
      seasonYear: data.season_year,
    };
  }

  // Fallback: most recent imported season for this player.
  const { data: imp } = await supabase
    .from("player_imported_batting")
    .select(
      "player_id, program_id, season_year, games, pa, ab, h, singles, doubles, triples, hr, bb, hbp, k, sac, rbi, ba, obp, slg, ops",
    )
    .eq("player_id", playerId)
    .order("season_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!imp) return null;
  return {
    ...toBattingLine(imp),
    programId: imp.program_id,
    seasonYear: imp.season_year,
  };
}

export interface RosterBattingMap {
  [playerId: string]: {
    games: number;
    ba: number;
    obp: number;
    slg: number;
    ops: number;
    hr: number;
    rbi: number;
  };
}

/**
 * fetchRosterBattingStats — batched lookup of season stats for every
 * player on a program. Used by the roster table to render real BA
 * per row.
 */
export async function fetchRosterBattingStats(
  programId: string,
): Promise<RosterBattingMap> {
  const supabase = createSupabaseServerClient();
  // Pull both sources and merge — live takes precedence when a player
  // has any live games played.
  const [live, imported] = await Promise.all([
    supabase
      .from("player_season_batting")
      .select("player_id, games, ba, obp, slg, ops, hr, rbi")
      .eq("program_id", programId),
    supabase
      .from("player_imported_batting")
      .select("player_id, games, ba, obp, slg, ops, hr, rbi")
      .eq("program_id", programId),
  ]);
  const out: RosterBattingMap = {};
  for (const r of imported.data ?? []) {
    out[r.player_id] = {
      games: r.games,
      ba: Number(r.ba),
      obp: Number(r.obp),
      slg: Number(r.slg),
      ops: Number(r.ops),
      hr: r.hr,
      rbi: r.rbi,
    };
  }
  // Live overrides imported for any player with live data
  for (const r of live.data ?? []) {
    if ((r.games ?? 0) > 0) {
      out[r.player_id] = {
        games: r.games,
        ba: Number(r.ba),
        obp: Number(r.obp),
        slg: Number(r.slg),
        ops: Number(r.ops),
        hr: r.hr,
        rbi: r.rbi,
      };
    }
  }
  return out;
}

export interface LeaderLine extends SeasonBattingLine {
  firstName: string;
  lastName: string;
  playerNumber: number | null;
  profileSlug: string | null;
}

/**
 * fetchProgramBattingLeaders — top-N by OPS with at least 5 PA.
 * Powers a "team leaders" panel on Coach Hub and public recruiter
 * leaderboards.
 */
export async function fetchProgramBattingLeaders(
  programId: string,
  limit = 10,
): Promise<LeaderLine[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_batting_leaders")
    .select(
      "player_id, program_id, season_year, games, pa, ab, h, singles, doubles, triples, hr, bb, hbp, k, sac, rbi, ba, obp, slg, ops, first_name, last_name, player_number, profile_slug",
    )
    .eq("program_id", programId)
    .order("ops", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    ...toBattingLine(r),
    playerId: r.player_id,
    programId: r.program_id,
    seasonYear: r.season_year,
    firstName: r.first_name,
    lastName: r.last_name,
    playerNumber: r.player_number,
    profileSlug: r.profile_slug,
  }));
}

export interface GameBattingLine {
  gameId: string;
  ab: number;
  h: number;
  hr: number;
  rbi: number;
  bb: number;
  k: number;
}

export async function fetchPlayerGameLog(
  playerId: string,
  limit = 20,
): Promise<GameBattingLine[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("player_game_batting")
    .select("game_id, ab, h, hr, rbi, bb, k, last_ab_at")
    .eq("player_id", playerId)
    .order("last_ab_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    gameId: r.game_id,
    ab: r.ab,
    h: r.h,
    hr: r.hr,
    rbi: r.rbi,
    bb: r.bb,
    k: r.k,
  }));
}

/**
 * Sum an array of imported batting rows into a single career-style
 * line. Rates (BA/OBP/SLG/OPS) are re-derived from the summed counting
 * stats because averaging averages is wrong.
 */
function sumBattingRows(
  rows: Array<Record<string, unknown>>,
  playerId: string,
): PlayerBattingLine {
  let games = 0, pa = 0, ab = 0, h = 0, singles = 0, doubles = 0, triples = 0;
  let hr = 0, bb = 0, hbp = 0, k = 0, sac = 0, rbi = 0;
  for (const r of rows) {
    games += (r.games as number) ?? 0;
    pa += (r.pa as number) ?? 0;
    ab += (r.ab as number) ?? 0;
    h += (r.h as number) ?? 0;
    singles += (r.singles as number) ?? 0;
    doubles += (r.doubles as number) ?? 0;
    triples += (r.triples as number) ?? 0;
    hr += (r.hr as number) ?? 0;
    bb += (r.bb as number) ?? 0;
    hbp += (r.hbp as number) ?? 0;
    k += (r.k as number) ?? 0;
    sac += (r.sac as number) ?? 0;
    rbi += (r.rbi as number) ?? 0;
  }
  const ba = ab > 0 ? h / ab : 0;
  const obpDen = ab + bb + hbp + sac;
  const obp = obpDen > 0 ? (h + bb + hbp) / obpDen : 0;
  const slg = ab > 0 ? (singles + 2 * doubles + 3 * triples + 4 * hr) / ab : 0;
  return {
    playerId,
    games, pa, ab, h, singles, doubles, triples, hr, bb, hbp, k, sac, rbi,
    ba: Math.round(ba * 1000) / 1000,
    obp: Math.round(obp * 1000) / 1000,
    slg: Math.round(slg * 1000) / 1000,
    ops: Math.round((obp + slg) * 1000) / 1000,
  };
}

function toBattingLine(
  row: Record<string, unknown>,
): PlayerBattingLine {
  return {
    playerId: row.player_id as string,
    games: (row.games as number) ?? 0,
    pa: (row.pa as number) ?? 0,
    ab: (row.ab as number) ?? 0,
    h: (row.h as number) ?? 0,
    singles: (row.singles as number) ?? 0,
    doubles: (row.doubles as number) ?? 0,
    triples: (row.triples as number) ?? 0,
    hr: (row.hr as number) ?? 0,
    bb: (row.bb as number) ?? 0,
    hbp: (row.hbp as number) ?? 0,
    k: (row.k as number) ?? 0,
    sac: (row.sac as number) ?? 0,
    rbi: (row.rbi as number) ?? 0,
    ba: Number(row.ba ?? 0),
    obp: Number(row.obp ?? 0),
    slg: Number(row.slg ?? 0),
    ops: Number(row.ops ?? 0),
  };
}

// formatAvg re-exported from @/lib/format at the top of this file.
