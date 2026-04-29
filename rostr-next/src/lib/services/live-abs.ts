import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Live at-bat session service.
 *
 * Backed by the practice_sessions + practice_at_bats tables (migration
 * 000023). Distinct from official game stats — these power preseason
 * roster decisions, not the season-long stat line.
 */

export type SessionKind =
  | "live_abs"
  | "intrasquad"
  | "live_bp"
  | "pen_session"
  | "general";

export type AtBatOutcome =
  | "1B"
  | "2B"
  | "3B"
  | "HR"
  | "BB"
  | "K"      // strikeout swinging
  | "K-L"    // strikeout looking (backwards K in scoring convention)
  | "HBP"
  | "GO"
  | "FO"
  | "E"
  | "FC"
  | "SAC";

export const ALL_OUTCOMES: AtBatOutcome[] = [
  "HR", "3B", "2B", "1B", "BB", "HBP", "K", "K-L", "GO", "FO", "FC", "E", "SAC",
];

/**
 * Pitch-level results — used when a coach tracks pitch-by-pitch
 * inside an at-bat. Most pitches don't end the AB; only `in_play`
 * (which then needs an outcome), `hbp`, the 4th ball, or the 3rd
 * strike actually terminate.
 */
export type PitchResult =
  | "ball"
  | "strike_called"
  | "strike_swinging"
  | "foul"
  | "foul_tip"
  | "in_play"
  | "hbp";

export interface PracticePitch {
  sequence: number;
  result: PitchResult;
  pitchType?: string | null;
  pitchVelocity?: number | null;
  notes?: string | null;
}

export interface PracticeSession {
  id: string;
  programId: string;
  kind: SessionKind;
  name: string;
  sessionDate: string;
  location: string | null;
  notes: string | null;
  startedAt: string;
  endedAt: string | null;
  atBatCount: number;
}

export interface PracticeAtBat {
  id: string;
  sessionId: string;
  sequence: number;
  pitcherId: string;
  pitcherName: string;
  hitterId: string;
  hitterName: string;
  outcome: AtBatOutcome;
  rbi: number;
  exitVelocity: number | null;
  pitchVelocity: number | null;
  pitchType: string | null;
  notes: string | null;
  createdAt: string;
}

export interface HitterSessionStats {
  playerId: string;
  sessions: number;
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
  hardContact: number;
  rbi: number;
  avgEv: number | null;
  maxEv: number | null;
  avg: number;
  kPct: number;
  bbPct: number;
  hardPct: number;
}

export interface PitcherSessionStats {
  playerId: string;
  sessions: number;
  bf: number;
  ab: number;
  h: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  hardContact: number;
  oppAvgEv: number | null;
  avgPitchVelo: number | null;
  maxPitchVelo: number | null;
  baa: number;
  kPct: number;
  bbPct: number;
  hardPct: number;
}

// ── Session CRUD ─────────────────────────────────────────────

export async function fetchPracticeSessions(
  programId: string,
  kind: SessionKind = "live_abs",
  limit = 30,
): Promise<PracticeSession[]> {
  const supabase = createSupabaseServerClient();
  const { data: sessions, error } = await supabase
    .from("practice_sessions")
    .select("id, program_id, kind, name, session_date, location, notes, started_at, ended_at")
    .eq("program_id", programId)
    .eq("kind", kind)
    .order("session_date", { ascending: false })
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error || !sessions) return [];

  // Counts in a separate batched query to avoid N+1
  const ids = sessions.map((s) => s.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: abs } = await supabase
      .from("practice_at_bats")
      .select("session_id")
      .in("session_id", ids);
    for (const r of abs ?? []) {
      counts.set(r.session_id, (counts.get(r.session_id) ?? 0) + 1);
    }
  }

  return sessions.map((s) => ({
    id: s.id,
    programId: s.program_id,
    kind: s.kind as SessionKind,
    name: s.name,
    sessionDate: s.session_date,
    location: s.location,
    notes: s.notes,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    atBatCount: counts.get(s.id) ?? 0,
  }));
}

export async function fetchPracticeSession(
  sessionId: string,
): Promise<PracticeSession | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("practice_sessions")
    .select("id, program_id, kind, name, session_date, location, notes, started_at, ended_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  const { count } = await supabase
    .from("practice_at_bats")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);
  return {
    id: data.id,
    programId: data.program_id,
    kind: data.kind as SessionKind,
    name: data.name,
    sessionDate: data.session_date,
    location: data.location,
    notes: data.notes,
    startedAt: data.started_at,
    endedAt: data.ended_at,
    atBatCount: count ?? 0,
  };
}

export async function fetchSessionAtBats(
  sessionId: string,
): Promise<PracticeAtBat[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("practice_at_bats")
    .select(
      "id, session_id, sequence, pitcher_id, hitter_id, outcome, rbi, exit_velocity, pitch_velocity, pitch_type, notes, created_at, pitcher:pitcher_id(first_name, last_name), hitter:hitter_id(first_name, last_name)",
    )
    .eq("session_id", sessionId)
    .order("sequence", { ascending: false });
  if (error || !data) return [];

  type RawAB = {
    id: string;
    session_id: string;
    sequence: number;
    pitcher_id: string;
    hitter_id: string;
    outcome: string;
    rbi: number;
    exit_velocity: number | null;
    pitch_velocity: number | null;
    pitch_type: string | null;
    notes: string | null;
    created_at: string;
    pitcher?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
    hitter?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  };

  return (data as RawAB[]).map((r) => {
    const p = Array.isArray(r.pitcher) ? r.pitcher[0] : r.pitcher;
    const h = Array.isArray(r.hitter) ? r.hitter[0] : r.hitter;
    return {
      id: r.id,
      sessionId: r.session_id,
      sequence: r.sequence,
      pitcherId: r.pitcher_id,
      pitcherName: p ? `${p.first_name} ${p.last_name}` : "Unknown",
      hitterId: r.hitter_id,
      hitterName: h ? `${h.first_name} ${h.last_name}` : "Unknown",
      outcome: r.outcome as AtBatOutcome,
      rbi: r.rbi,
      exitVelocity: r.exit_velocity,
      pitchVelocity: r.pitch_velocity,
      pitchType: r.pitch_type,
      notes: r.notes,
      createdAt: r.created_at,
    };
  });
}

// ── Aggregate views ─────────────────────────────────────────

export async function fetchHitterSessionStats(
  programId: string,
): Promise<HitterSessionStats[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("practice_hitter_stats")
    .select(
      "player_id, sessions, pa, ab, h, singles, doubles, triples, hr, bb, hbp, k, sac, hard_contact, rbi, avg_ev, max_ev, avg, k_pct, bb_pct, hard_pct",
    )
    .eq("program_id", programId);
  if (error || !data) return [];
  return data.map((r) => ({
    playerId: r.player_id,
    sessions: r.sessions,
    pa: r.pa,
    ab: r.ab,
    h: r.h,
    singles: r.singles,
    doubles: r.doubles,
    triples: r.triples,
    hr: r.hr,
    bb: r.bb,
    hbp: r.hbp,
    k: r.k,
    sac: r.sac,
    hardContact: r.hard_contact,
    rbi: r.rbi,
    avgEv: r.avg_ev != null ? Number(r.avg_ev) : null,
    maxEv: r.max_ev != null ? Number(r.max_ev) : null,
    avg: Number(r.avg),
    kPct: Number(r.k_pct),
    bbPct: Number(r.bb_pct),
    hardPct: Number(r.hard_pct),
  }));
}

export async function fetchPitcherSessionStats(
  programId: string,
): Promise<PitcherSessionStats[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("practice_pitcher_stats")
    .select(
      "player_id, sessions, bf, ab, h, hr, bb, hbp, k, hard_contact, opp_avg_ev, avg_pitch_velo, max_pitch_velo, baa, k_pct, bb_pct, hard_pct",
    )
    .eq("program_id", programId);
  if (error || !data) return [];
  return data.map((r) => ({
    playerId: r.player_id,
    sessions: r.sessions,
    bf: r.bf,
    ab: r.ab,
    h: r.h,
    hr: r.hr,
    bb: r.bb,
    hbp: r.hbp,
    k: r.k,
    hardContact: r.hard_contact,
    oppAvgEv: r.opp_avg_ev != null ? Number(r.opp_avg_ev) : null,
    avgPitchVelo: r.avg_pitch_velo != null ? Number(r.avg_pitch_velo) : null,
    maxPitchVelo: r.max_pitch_velo != null ? Number(r.max_pitch_velo) : null,
    baa: Number(r.baa),
    kPct: Number(r.k_pct),
    bbPct: Number(r.bb_pct),
    hardPct: Number(r.hard_pct),
  }));
}

// ── Kind-filterable stats (live ABs vs intrasquad split) ─────────
//
// The materialized views above (`practice_hitter_stats`,
// `practice_pitcher_stats`) aggregate across every session kind for a
// program. The coach stats dashboard at /app/practice/live-abs/stats
// needs to slice by kind ("live_abs" vs "intrasquad") so the team can
// see how players perform in scrimmage pressure separately from
// preseason cage work.
//
// Implementation: when the caller asks for "all", we fall through to
// the fast view-backed path. For a specific kind we re-aggregate from
// the raw practice_at_bats table, joining through practice_sessions to
// filter on kind. The math mirrors the view's calculation so the
// numbers line up.

export type StatsKindFilter = "all" | "live_abs" | "intrasquad";

export interface HitterStatsRow extends HitterSessionStats {
  /** Joined player metadata so the stats table can render the row
   *  without a second roster lookup. */
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  positions: string[];
  classYearShort: string;
}

export interface PitcherStatsRow extends PitcherSessionStats {
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  positions: string[];
  classYearShort: string;
}

/** Hard-contact threshold (mph). Mirrors the view definition. */
const HARD_CONTACT_EV = 85;

/** Outcomes counted as a "hit" for batting average / hitter stats. */
const HIT_OUTCOMES = new Set<AtBatOutcome>(["1B", "2B", "3B", "HR"]);
/** Outcomes counted as an at-bat (PA minus walks/HBP/SAC). */
const AB_OUTCOMES = new Set<AtBatOutcome>(["1B", "2B", "3B", "HR", "K", "K-L", "GO", "FO", "E", "FC"]);

/**
 * fetchHitterStatsByKind — team-wide hitter aggregation, optionally
 * filtered to one session kind. Returns one row per hitter with
 * roster metadata pre-joined.
 *
 * Robustness: if the kind filter is "all" we still aggregate from
 * raw at-bats (instead of the view) so the response shape always
 * includes `firstName/lastName/positions/etc.`. The performance
 * tradeoff is fine for HS varsity volumes (<2k ABs / season).
 */
export async function fetchHitterStatsByKind(
  programId: string,
  filter: StatsKindFilter,
): Promise<HitterStatsRow[]> {
  const supabase = createSupabaseServerClient();

  // Pull every at-bat for the program with its session kind + the
  // hitter's roster row. The Supabase embed syntax `practice_sessions!inner`
  // forces an inner join + lets us filter on session.kind.
  let q = supabase
    .from("practice_at_bats")
    .select(
      "hitter_id, outcome, rbi, exit_velocity, practice_sessions!inner(kind, program_id), players:hitter_id(first_name, last_name, player_number, positions, grade)",
    )
    .eq("practice_sessions.program_id", programId);
  if (filter !== "all") q = q.eq("practice_sessions.kind", filter);

  const { data, error } = await q;
  if (error || !data) return [];

  // Group by hitter_id, accumulate raw counts.
  type Acc = {
    playerId: string;
    firstName: string;
    lastName: string;
    jerseyNumber: number | null;
    positions: string[];
    classYearShort: string;
    sessions: Set<string>; // distinct session count (best-effort, we don't have session_id here)
    pa: number; ab: number; h: number;
    singles: number; doubles: number; triples: number; hr: number;
    bb: number; hbp: number; k: number; sac: number;
    hardContact: number; rbi: number;
    evSum: number; evCount: number; evMax: number | null;
  };
  const byPlayer = new Map<string, Acc>();
  for (const r of data as Array<{
    hitter_id: string;
    outcome: AtBatOutcome;
    rbi: number | null;
    exit_velocity: number | null;
    players: { first_name: string; last_name: string; player_number: number | null; positions: string[] | null; grade: number | null } | Array<{ first_name: string; last_name: string; player_number: number | null; positions: string[] | null; grade: number | null }> | null;
  }>) {
    const player = Array.isArray(r.players) ? r.players[0] : r.players;
    if (!player) continue;
    let acc = byPlayer.get(r.hitter_id);
    if (!acc) {
      acc = {
        playerId: r.hitter_id,
        firstName: player.first_name,
        lastName: player.last_name,
        jerseyNumber: player.player_number,
        positions: player.positions ?? [],
        classYearShort: gradeToShort(player.grade),
        sessions: new Set(),
        pa: 0, ab: 0, h: 0,
        singles: 0, doubles: 0, triples: 0, hr: 0,
        bb: 0, hbp: 0, k: 0, sac: 0,
        hardContact: 0, rbi: 0,
        evSum: 0, evCount: 0, evMax: null,
      };
      byPlayer.set(r.hitter_id, acc);
    }
    // PA = every at-bat row. AB = excludes BB / HBP / SAC.
    acc.pa += 1;
    if (r.outcome !== "BB" && r.outcome !== "HBP" && r.outcome !== "SAC") acc.ab += 1;
    if (HIT_OUTCOMES.has(r.outcome)) acc.h += 1;
    switch (r.outcome) {
      case "1B": acc.singles += 1; break;
      case "2B": acc.doubles += 1; break;
      case "3B": acc.triples += 1; break;
      case "HR": acc.hr += 1; break;
      case "BB": acc.bb += 1; break;
      case "HBP": acc.hbp += 1; break;
      case "K":
      case "K-L": acc.k += 1; break;
      case "SAC": acc.sac += 1; break;
    }
    acc.rbi += r.rbi ?? 0;
    if (r.exit_velocity != null) {
      acc.evSum += r.exit_velocity;
      acc.evCount += 1;
      if (acc.evMax === null || r.exit_velocity > acc.evMax) acc.evMax = r.exit_velocity;
      if (r.exit_velocity >= HARD_CONTACT_EV) acc.hardContact += 1;
    }
  }

  return Array.from(byPlayer.values())
    .map((a): HitterStatsRow => ({
      playerId: a.playerId,
      firstName: a.firstName,
      lastName: a.lastName,
      jerseyNumber: a.jerseyNumber,
      positions: a.positions,
      classYearShort: a.classYearShort,
      sessions: a.sessions.size,
      pa: a.pa, ab: a.ab, h: a.h,
      singles: a.singles, doubles: a.doubles, triples: a.triples, hr: a.hr,
      bb: a.bb, hbp: a.hbp, k: a.k, sac: a.sac,
      hardContact: a.hardContact, rbi: a.rbi,
      avgEv: a.evCount > 0 ? a.evSum / a.evCount : null,
      maxEv: a.evMax,
      avg: a.ab > 0 ? a.h / a.ab : 0,
      kPct: a.pa > 0 ? a.k / a.pa : 0,
      bbPct: a.pa > 0 ? a.bb / a.pa : 0,
      hardPct: a.evCount > 0 ? a.hardContact / a.evCount : 0,
    }))
    .sort((a, b) => b.avg - a.avg);
}

/**
 * fetchPitcherStatsByKind — team-wide pitcher aggregation with the
 * same filter semantics as the hitter helper.
 */
export async function fetchPitcherStatsByKind(
  programId: string,
  filter: StatsKindFilter,
): Promise<PitcherStatsRow[]> {
  const supabase = createSupabaseServerClient();

  let q = supabase
    .from("practice_at_bats")
    .select(
      "pitcher_id, outcome, exit_velocity, pitch_velocity, practice_sessions!inner(kind, program_id), players:pitcher_id(first_name, last_name, player_number, positions, grade)",
    )
    .eq("practice_sessions.program_id", programId);
  if (filter !== "all") q = q.eq("practice_sessions.kind", filter);

  const { data, error } = await q;
  if (error || !data) return [];

  type Acc = {
    playerId: string;
    firstName: string;
    lastName: string;
    jerseyNumber: number | null;
    positions: string[];
    classYearShort: string;
    sessions: Set<string>;
    bf: number; ab: number; h: number; hr: number;
    bb: number; hbp: number; k: number;
    hardContact: number;
    evSum: number; evCount: number;
    pitchVeloSum: number; pitchVeloCount: number; pitchVeloMax: number | null;
  };
  const byPlayer = new Map<string, Acc>();
  for (const r of data as Array<{
    pitcher_id: string;
    outcome: AtBatOutcome;
    exit_velocity: number | null;
    pitch_velocity: number | null;
    players: { first_name: string; last_name: string; player_number: number | null; positions: string[] | null; grade: number | null } | Array<{ first_name: string; last_name: string; player_number: number | null; positions: string[] | null; grade: number | null }> | null;
  }>) {
    const player = Array.isArray(r.players) ? r.players[0] : r.players;
    if (!player) continue;
    let acc = byPlayer.get(r.pitcher_id);
    if (!acc) {
      acc = {
        playerId: r.pitcher_id,
        firstName: player.first_name,
        lastName: player.last_name,
        jerseyNumber: player.player_number,
        positions: player.positions ?? [],
        classYearShort: gradeToShort(player.grade),
        sessions: new Set(),
        bf: 0, ab: 0, h: 0, hr: 0,
        bb: 0, hbp: 0, k: 0,
        hardContact: 0,
        evSum: 0, evCount: 0,
        pitchVeloSum: 0, pitchVeloCount: 0, pitchVeloMax: null,
      };
      byPlayer.set(r.pitcher_id, acc);
    }
    acc.bf += 1;
    if (r.outcome !== "BB" && r.outcome !== "HBP" && r.outcome !== "SAC") acc.ab += 1;
    if (HIT_OUTCOMES.has(r.outcome)) acc.h += 1;
    if (r.outcome === "HR") acc.hr += 1;
    if (r.outcome === "BB") acc.bb += 1;
    if (r.outcome === "HBP") acc.hbp += 1;
    if (r.outcome === "K" || r.outcome === "K-L") acc.k += 1;
    if (r.exit_velocity != null) {
      acc.evSum += r.exit_velocity;
      acc.evCount += 1;
      if (r.exit_velocity >= HARD_CONTACT_EV) acc.hardContact += 1;
    }
    if (r.pitch_velocity != null) {
      acc.pitchVeloSum += r.pitch_velocity;
      acc.pitchVeloCount += 1;
      if (acc.pitchVeloMax === null || r.pitch_velocity > acc.pitchVeloMax) {
        acc.pitchVeloMax = r.pitch_velocity;
      }
    }
  }

  return Array.from(byPlayer.values())
    .map((a): PitcherStatsRow => ({
      playerId: a.playerId,
      firstName: a.firstName,
      lastName: a.lastName,
      jerseyNumber: a.jerseyNumber,
      positions: a.positions,
      classYearShort: a.classYearShort,
      sessions: a.sessions.size,
      bf: a.bf, ab: a.ab, h: a.h, hr: a.hr,
      bb: a.bb, hbp: a.hbp, k: a.k,
      hardContact: a.hardContact,
      oppAvgEv: a.evCount > 0 ? a.evSum / a.evCount : null,
      avgPitchVelo: a.pitchVeloCount > 0 ? a.pitchVeloSum / a.pitchVeloCount : null,
      maxPitchVelo: a.pitchVeloMax,
      baa: a.ab > 0 ? a.h / a.ab : 0,
      kPct: a.bf > 0 ? a.k / a.bf : 0,
      bbPct: a.bf > 0 ? a.bb / a.bf : 0,
      hardPct: a.evCount > 0 ? a.hardContact / a.evCount : 0,
    }))
    .sort((a, b) => a.baa - b.baa);
}

function gradeToShort(grade: number | null): string {
  switch (grade) {
    case 9: return "Fr";
    case 10: return "So";
    case 11: return "Jr";
    case 12: return "Sr";
    default: return "";
  }
}
