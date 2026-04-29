import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Pitching stats service — mirrors batting-stats.ts structure, reads
 * from the on-the-fly views introduced in migration 000019
 * (player_game_pitching, player_career_pitching, player_season_pitching,
 * program_pitching_leaders).
 *
 * Like batting stats, these derive live from the append-only game_events
 * log — no snapshots, no refresh jobs.
 */

export interface PitchingLine {
  games: number;
  bf: number;
  outs: number;
  ip: number;
  h: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  r: number;
  er: number;
  era: number;
  whip: number;
  k9: number;
  bb9: number;
  kBB: number;
}

export interface PlayerPitchingLine extends PitchingLine {
  playerId: string;
}

export interface SeasonPitchingLine extends PlayerPitchingLine {
  programId: string;
  seasonYear: number;
}

export async function fetchPlayerCareerPitching(
  playerId: string,
): Promise<PlayerPitchingLine | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("player_career_pitching")
    .select(
      "player_id, games, bf, outs, ip, h, hr, bb, hbp, k, r, er, era, whip, k9, bb9, k_bb",
    )
    .eq("player_id", playerId)
    .maybeSingle();
  if (!error && data && (data.games ?? 0) > 0) return toPitchingLine(data);

  const { data: imp } = await supabase
    .from("player_imported_pitching")
    .select(
      "player_id, games, bf, outs, ip, h, hr, bb, hbp, k, r, er, era, whip, k9, bb9",
    )
    .eq("player_id", playerId);
  if (!imp || imp.length === 0) return null;
  return sumPitchingRows(imp, playerId);
}

export async function fetchPlayerSeasonPitching(
  playerId: string,
): Promise<SeasonPitchingLine | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("player_season_pitching")
    .select(
      "player_id, program_id, season_year, games, bf, outs, ip, h, hr, bb, hbp, k, r, er, era, whip, k9, bb9, k_bb",
    )
    .eq("player_id", playerId)
    .maybeSingle();
  if (!error && data && (data.games ?? 0) > 0) {
    return {
      ...toPitchingLine(data),
      programId: data.program_id,
      seasonYear: data.season_year,
    };
  }

  const { data: imp } = await supabase
    .from("player_imported_pitching")
    .select(
      "player_id, program_id, season_year, games, bf, outs, ip, h, hr, bb, hbp, k, r, er, era, whip, k9, bb9",
    )
    .eq("player_id", playerId)
    .order("season_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!imp) return null;
  return {
    ...toPitchingLine(imp),
    programId: imp.program_id,
    seasonYear: imp.season_year,
  };
}

export interface RosterPitchingMap {
  [playerId: string]: {
    games: number;
    ip: number;
    era: number;
    whip: number;
    k: number;
    k9: number;
  };
}

/**
 * Batch lookup for every pitcher on a program — powers roster-level
 * pitching line display.
 */
export async function fetchRosterPitchingStats(
  programId: string,
): Promise<RosterPitchingMap> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("player_season_pitching")
    .select("player_id, games, ip, era, whip, k, k9")
    .eq("program_id", programId);
  if (error || !data) return {};
  const out: RosterPitchingMap = {};
  for (const r of data) {
    out[r.player_id] = {
      games: r.games,
      ip: Number(r.ip),
      era: Number(r.era),
      whip: Number(r.whip),
      k: r.k,
      k9: Number(r.k9),
    };
  }
  return out;
}

export interface PitcherLeaderLine extends SeasonPitchingLine {
  firstName: string;
  lastName: string;
  playerNumber: number | null;
  profileSlug: string | null;
}

/**
 * Top-N pitchers by ERA (ascending — lower is better) with at least 3 IP.
 */
export async function fetchProgramPitchingLeaders(
  programId: string,
  limit = 10,
): Promise<PitcherLeaderLine[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_pitching_leaders")
    .select(
      "player_id, program_id, season_year, games, bf, outs, ip, h, hr, bb, hbp, k, r, er, era, whip, k9, bb9, k_bb, first_name, last_name, player_number, profile_slug",
    )
    .eq("program_id", programId)
    .order("era", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    ...toPitchingLine(r),
    playerId: r.player_id,
    programId: r.program_id,
    seasonYear: r.season_year,
    firstName: r.first_name,
    lastName: r.last_name,
    playerNumber: r.player_number,
    profileSlug: r.profile_slug,
  }));
}

/**
 * Sum imported pitching rows into a career-style line. Rate stats
 * (ERA/WHIP/K9/BB9) are re-derived from the summed counting stats
 * because weighting by innings is the right aggregation.
 */
function sumPitchingRows(
  rows: Array<Record<string, unknown>>,
  playerId: string,
): PlayerPitchingLine {
  let games = 0, bf = 0, outs = 0, h = 0, hr = 0, bb = 0, hbp = 0, k = 0, r = 0, er = 0;
  for (const row of rows) {
    games += (row.games as number) ?? 0;
    bf += (row.bf as number) ?? 0;
    outs += (row.outs as number) ?? 0;
    h += (row.h as number) ?? 0;
    hr += (row.hr as number) ?? 0;
    bb += (row.bb as number) ?? 0;
    hbp += (row.hbp as number) ?? 0;
    k += (row.k as number) ?? 0;
    r += (row.r as number) ?? 0;
    er += (row.er as number) ?? 0;
  }
  const ip = Math.round((outs / 3) * 100) / 100;
  const era = outs > 0 ? Math.round(((er * 27) / outs) * 100) / 100 : 0;
  const whip = outs > 0 ? Math.round((((h + bb) * 3) / outs) * 1000) / 1000 : 0;
  const k9 = outs > 0 ? Math.round(((k * 27) / outs) * 100) / 100 : 0;
  const bb9 = outs > 0 ? Math.round(((bb * 27) / outs) * 100) / 100 : 0;
  const kBB = bb > 0 ? Math.round((k / bb) * 100) / 100 : k;
  return {
    playerId,
    games, bf, outs, ip, h, hr, bb, hbp, k, r, er,
    era, whip, k9, bb9, kBB,
  };
}

function toPitchingLine(
  row: Record<string, unknown>,
): PlayerPitchingLine {
  return {
    playerId: row.player_id as string,
    games: (row.games as number) ?? 0,
    bf: (row.bf as number) ?? 0,
    outs: (row.outs as number) ?? 0,
    ip: Number(row.ip ?? 0),
    h: (row.h as number) ?? 0,
    hr: (row.hr as number) ?? 0,
    bb: (row.bb as number) ?? 0,
    hbp: (row.hbp as number) ?? 0,
    k: (row.k as number) ?? 0,
    r: (row.r as number) ?? 0,
    er: (row.er as number) ?? 0,
    era: Number(row.era ?? 0),
    whip: Number(row.whip ?? 0),
    k9: Number(row.k9 ?? 0),
    bb9: Number(row.bb9 ?? 0),
    kBB: Number(row.k_bb ?? 0),
  };
}
