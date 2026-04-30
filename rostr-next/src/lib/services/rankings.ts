import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  scoreAgainstBenchmark,
  getBenchmark,
  type Benchmark,
  type ScoreDirection,
} from "./rankings-benchmarks";

/**
 * Rankings engine. Pure-ish service consumed by /app/rankings (and
 * eventually any other surface that wants to compare players against
 * their roster).
 *
 * Two scoring modes:
 *
 *   1. "percentile" — internal comparison. For each metric, the
 *      player's raw value is converted to a 0–100 percentile against
 *      every other player in the comparison group who has a value
 *      for that same metric. Respects per-metric direction
 *      (lower_better vs higher_better).
 *
 *   2. "benchmark" — external grade. For each metric, the player's
 *      raw value is graded 0–100 against the configured benchmark
 *      bands in `rankings-benchmarks.ts`. No comparison group
 *      involved — same numbers grade the same regardless of who
 *      else is in the program.
 *
 * Overall score = simple mean of per-metric scores. Missing metrics
 * are EXCLUDED from the mean (not zeroed). Players with zero scored
 * metrics get a null overall and are reported separately so the
 * coach knows they aren't ranked yet.
 *
 * The service does the heavy lifting:
 *   - Fetches roster + tryout sessions + scores in batched queries
 *     (no N+1).
 *   - Applies all filters before scoring so percentile groups respect
 *     them (filtering by class affects who you're compared against).
 *   - Returns a stable shape regardless of which mode was chosen so
 *     the UI doesn't branch.
 *
 * Filters are intentionally orthogonal — passing none returns every
 * player in the program with at least one tryout score.
 */

// ── Public types ────────────────────────────────────────────────

export type ScoringMode = "percentile" | "benchmark";

export interface RankingsFilters {
  /** Limit to scores from a single tryout. Null = all tryouts in program. */
  tryoutId?: string | null;
  /**
   * Subset of station short_codes to include in the overall score.
   * If unset / empty, every station with at least one score in the
   * program counts.
   */
  metricShortCodes?: string[];
  /** Class-year array (e.g. ["2026", "2027"]). Null/empty = all. */
  gradYears?: number[];
  /** Position array (e.g. ["P", "SS"]). Match any. Null/empty = all. */
  positions?: string[];
  /**
   * Roster level (e.g. "Varsity"). Sourced from roster_assignments.
   * Null/empty = all.
   */
  teamLevels?: string[];
}

export interface RankingsRequest {
  /** Coach's program. Required — service does NOT cross programs. */
  programId: string;
  scoringMode: ScoringMode;
  filters?: RankingsFilters;
}

export interface MetricScore {
  /** Station short_code (e.g. "60yd", "EV"). */
  shortCode: string;
  /** Display name from tryout_stations.name (most-recent wins). */
  displayName: string;
  /** Raw value — best across all included tryouts. */
  rawValue: number;
  /** Direction (drives interpretation of rank + percentile). */
  direction: ScoreDirection;
  /** Unit string ("s", "mph", "rating"). */
  unit: string | null;
  /** 0–100 score. Computed per the active scoringMode. */
  score: number;
  /** Position (1 = best) within the comparison group, only in percentile mode. */
  rank: number | null;
  /** Out of how many in the comparison group, only in percentile mode. */
  rankOf: number | null;
  /** Percentile (0–100). Same as score in percentile mode; null in benchmark mode. */
  percentile: number | null;
}

export interface RankedPlayerEntry {
  playerId: string;
  firstName: string;
  lastName: string;
  positions: string[];
  grade: number | null;
  classYear: number | null;
  teamLevel: string | null;
  /**
   * Mean of perMetric.score, ignoring missing metrics. Null when the
   * player has no scored metrics in scope (still listed in
   * `unrankedPlayers` for visibility).
   */
  overallScore: number | null;
  perMetric: MetricScore[];
  metricsIncluded: number;
  /** Station short_codes this player is missing in scope. */
  missingMetrics: string[];
  /** 1-based rank by overallScore (within the filtered + scored set). */
  rank: number | null;
}

export interface RankingsResponse {
  scoringMode: ScoringMode;
  /** Players with at least one scored metric, sorted by overallScore desc. */
  players: RankedPlayerEntry[];
  /** Players in scope who have zero scored metrics — surfaced separately. */
  unrankedPlayers: Array<
    Pick<RankedPlayerEntry, "playerId" | "firstName" | "lastName" | "positions" | "grade" | "classYear" | "teamLevel">
  >;
  /**
   * The metrics actually included in scoring (after filtering). Useful
   * for the UI to render column headers / chips.
   */
  metricsInScope: Array<{
    shortCode: string;
    displayName: string;
    direction: ScoreDirection;
    unit: string | null;
    /** Number of players in the comparison group with a value here. */
    sampleSize: number;
    /** Whether a benchmark is available for this metric. */
    hasBenchmark: boolean;
  }>;
  /** Tryouts visible to this program — for the session-filter UI. */
  availableTryouts: Array<{ id: string; name: string; startDate: string | null }>;
  /** Configured program levels (e.g. ["Varsity", "JV", "Freshman"]). */
  availableLevels: string[];
}

// ── Engine ──────────────────────────────────────────────────────

/**
 * Main entry point. Returns ranked + unranked player lists plus the
 * scope metadata the UI needs. Pure-fetch + pure-compute; no
 * mutations.
 */
export async function getPlayerRankings(
  req: RankingsRequest,
): Promise<RankingsResponse> {
  const supabase = createSupabaseServerClient();
  const filters = req.filters ?? {};

  // 1. Roster — every player in the program. Apply filters (grad year,
  //    positions) on the client because positions is a TEXT[] column;
  //    filtering it fully in SQL is awkward and the roster is small.
  const { data: playerRows } = await supabase
    .from("players")
    .select(
      "id, first_name, last_name, grade, positions, released_at",
    )
    .eq("program_id", req.programId);

  const players = (playerRows ?? []).filter(
    (p) => (p as { released_at?: string | null }).released_at == null,
  );

  // 2. Roster assignments — gives us team_level per player. One row
  //    per player. Optional: filter on assignment matches a level.
  const { data: assignmentRows } = await supabase
    .from("roster_assignments")
    .select("player_id, assignment")
    .eq("program_id", req.programId);
  const levelByPlayer = new Map<string, string>();
  for (const r of assignmentRows ?? []) {
    levelByPlayer.set(
      (r as { player_id: string }).player_id,
      String((r as { assignment: string }).assignment ?? ""),
    );
  }

  // 3. Tryouts available + currently-in-scope. The session filter in
  //    the UI lets a coach narrow scoring to a single tryout.
  const { data: tryoutRows } = await supabase
    .from("tryouts")
    .select("id, name, start_date")
    .eq("program_id", req.programId)
    .order("start_date", { ascending: false });
  const availableTryouts = (tryoutRows ?? []).map((t) => ({
    id: (t as { id: string }).id,
    name: (t as { name: string }).name,
    startDate: ((t as { start_date: string | null }).start_date) ?? null,
  }));
  const inScopeTryoutIds = filters.tryoutId
    ? [filters.tryoutId]
    : availableTryouts.map((t) => t.id);

  // 4. Stations across the in-scope tryouts. We need station id →
  //    short_code + name + score_type so we can identify metrics.
  const stationMap = new Map<
    string,
    {
      stationId: string;
      shortCode: string;
      name: string;
      direction: ScoreDirection;
      unit: string | null;
    }
  >();
  if (inScopeTryoutIds.length > 0) {
    const { data: stationRows } = await supabase
      .from("tryout_stations")
      .select("id, tryout_id, short_code, name, score_type, unit")
      .in("tryout_id", inScopeTryoutIds);
    for (const s of stationRows ?? []) {
      const r = s as {
        id: string;
        short_code: string;
        name: string;
        score_type: ScoreDirection;
        unit: string | null;
      };
      stationMap.set(r.id, {
        stationId: r.id,
        shortCode: r.short_code,
        name: r.name,
        direction: r.score_type,
        unit: r.unit,
      });
    }
  }

  // 5. Scores. One pass — every score for in-scope tryouts. We then
  //    aggregate per (player, short_code) keeping the best value per
  //    direction (LOWER for lower_better, MAX for higher_better/rating).
  type RawScore = {
    player_id: string;
    station_id: string;
    value: number;
  };
  const rawScores: RawScore[] = [];
  if (inScopeTryoutIds.length > 0) {
    const { data: scoreRows } = await supabase
      .from("tryout_scores")
      .select("player_id, station_id, value")
      .in("tryout_id", inScopeTryoutIds);
    for (const r of scoreRows ?? []) {
      rawScores.push({
        player_id: (r as { player_id: string }).player_id,
        station_id: (r as { station_id: string }).station_id,
        value: Number((r as { value: number }).value),
      });
    }
  }

  // 6. Aggregate to best-per-metric per player. Skip rows whose
  //    station isn't in the loaded stationMap (defensive).
  type BestEntry = {
    shortCode: string;
    displayName: string;
    direction: ScoreDirection;
    unit: string | null;
    rawValue: number;
  };
  const bestByPlayer = new Map<string, Map<string, BestEntry>>();
  for (const s of rawScores) {
    const station = stationMap.get(s.station_id);
    if (!station) continue;
    if (!Number.isFinite(s.value)) continue;
    const playerMap =
      bestByPlayer.get(s.player_id) ?? new Map<string, BestEntry>();
    const existing = playerMap.get(station.shortCode);
    const isBetter = existing
      ? station.direction === "lower_better"
        ? s.value < existing.rawValue
        : s.value > existing.rawValue
      : true;
    if (isBetter) {
      playerMap.set(station.shortCode, {
        shortCode: station.shortCode,
        displayName: station.name,
        direction: station.direction,
        unit: station.unit,
        rawValue: s.value,
      });
    }
    bestByPlayer.set(s.player_id, playerMap);
  }

  // 7. Build the comparison group. A player is in scope if they:
  //    - belong to the program (already filtered)
  //    - aren't released
  //    - match grad-year filter (if any)
  //    - overlap positions filter (if any)
  //    - match team-level filter (if any)
  type EnrichedPlayer = {
    playerId: string;
    firstName: string;
    lastName: string;
    positions: string[];
    grade: number | null;
    classYear: number | null;
    teamLevel: string | null;
  };
  const enriched: EnrichedPlayer[] = players.map((p) => {
    const r = p as {
      id: string;
      first_name: string;
      last_name: string;
      grade: number | null;
      positions: string[] | null;
    };
    return {
      playerId: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      positions: r.positions ?? [],
      grade: r.grade,
      classYear: r.grade != null ? classYearForGrade(r.grade) : null,
      teamLevel: levelByPlayer.get(r.id) ?? null,
    };
  });

  const inScopePlayers = enriched.filter((p) => {
    if (filters.gradYears && filters.gradYears.length > 0) {
      if (p.classYear == null || !filters.gradYears.includes(p.classYear)) {
        return false;
      }
    }
    if (filters.positions && filters.positions.length > 0) {
      const hit = p.positions.some((pos) => filters.positions!.includes(pos));
      if (!hit) return false;
    }
    if (filters.teamLevels && filters.teamLevels.length > 0) {
      if (!p.teamLevel || !filters.teamLevels.includes(p.teamLevel)) {
        return false;
      }
    }
    return true;
  });

  // 8. Decide which metrics are in scope for scoring.
  //    - If filters.metricShortCodes is set, use that.
  //    - Else, every short_code we've seen at least one score for.
  const allShortCodes = new Set<string>();
  for (const playerMap of Array.from(bestByPlayer.values())) {
    for (const k of Array.from(playerMap.keys())) {
      allShortCodes.add(k);
    }
  }
  const requestedMetrics = filters.metricShortCodes ?? [];
  const metricsInScopeCodes =
    requestedMetrics.length > 0
      ? requestedMetrics.filter((c) => allShortCodes.has(c))
      : Array.from(allShortCodes);
  metricsInScopeCodes.sort();

  // 9. Build per-metric comparison groups (only in-scope players'
  //    values are part of the percentile pool).
  //    Map: shortCode → sorted array of values (for percentile lookup).
  type MetricMeta = {
    shortCode: string;
    displayName: string;
    direction: ScoreDirection;
    unit: string | null;
  };
  const metricMetaByCode = new Map<string, MetricMeta>();
  const valuesByMetric = new Map<string, number[]>();
  for (const p of inScopePlayers) {
    const playerMap = bestByPlayer.get(p.playerId);
    if (!playerMap) continue;
    for (const code of metricsInScopeCodes) {
      const entry = playerMap.get(code);
      if (!entry || !Number.isFinite(entry.rawValue)) continue;
      if (!metricMetaByCode.has(code)) {
        metricMetaByCode.set(code, {
          shortCode: code,
          displayName: entry.displayName,
          direction: entry.direction,
          unit: entry.unit,
        });
      }
      const arr = valuesByMetric.get(code) ?? [];
      arr.push(entry.rawValue);
      valuesByMetric.set(code, arr);
    }
  }
  // Pre-sort each value array (asc) so percentile + rank lookups are
  // O(log n) per query downstream.
  for (const arr of Array.from(valuesByMetric.values())) {
    arr.sort((a, b) => a - b);
  }

  // 10. Score each player against each in-scope metric.
  type Scored = RankedPlayerEntry;
  const scoredEntries: Scored[] = [];
  const unranked: RankingsResponse["unrankedPlayers"] = [];

  for (const p of inScopePlayers) {
    const playerMap = bestByPlayer.get(p.playerId);
    const perMetric: MetricScore[] = [];
    const missing: string[] = [];

    for (const code of metricsInScopeCodes) {
      const entry = playerMap?.get(code);
      if (!entry || !Number.isFinite(entry.rawValue)) {
        missing.push(code);
        continue;
      }
      let score: number;
      let rank: number | null = null;
      let rankOf: number | null = null;
      let percentile: number | null = null;
      if (req.scoringMode === "percentile") {
        const pool = valuesByMetric.get(code) ?? [];
        const r = computePercentileAndRank(
          entry.rawValue,
          pool,
          entry.direction,
        );
        score = r.percentile;
        percentile = r.percentile;
        rank = r.rank;
        rankOf = r.rankOf;
      } else {
        // benchmark mode
        const bm = getBenchmark(code);
        const benchScore = bm
          ? scoreAgainstBenchmark(entry.rawValue, bm)
          : null;
        if (benchScore == null) {
          // No benchmark configured / value out-of-range with no
          // floor/ceiling → treat as missing for this metric (don't
          // pollute the average).
          missing.push(code);
          continue;
        }
        score = benchScore;
      }
      perMetric.push({
        shortCode: code,
        displayName: entry.displayName,
        rawValue: entry.rawValue,
        direction: entry.direction,
        unit: entry.unit,
        score,
        rank,
        rankOf,
        percentile,
      });
    }

    if (perMetric.length === 0) {
      unranked.push({
        playerId: p.playerId,
        firstName: p.firstName,
        lastName: p.lastName,
        positions: p.positions,
        grade: p.grade,
        classYear: p.classYear,
        teamLevel: p.teamLevel,
      });
      continue;
    }

    const overallScore =
      perMetric.reduce((s, m) => s + m.score, 0) / perMetric.length;

    scoredEntries.push({
      playerId: p.playerId,
      firstName: p.firstName,
      lastName: p.lastName,
      positions: p.positions,
      grade: p.grade,
      classYear: p.classYear,
      teamLevel: p.teamLevel,
      overallScore: round1(overallScore),
      perMetric,
      metricsIncluded: perMetric.length,
      missingMetrics: missing,
      rank: null,
    });
  }

  // 11. Rank by overallScore desc, ties broken by metricsIncluded desc.
  scoredEntries.sort((a, b) => {
    const ao = a.overallScore ?? -Infinity;
    const bo = b.overallScore ?? -Infinity;
    if (bo !== ao) return bo - ao;
    if (b.metricsIncluded !== a.metricsIncluded) {
      return b.metricsIncluded - a.metricsIncluded;
    }
    const ln = a.lastName.localeCompare(b.lastName);
    if (ln !== 0) return ln;
    return a.firstName.localeCompare(b.firstName);
  });
  scoredEntries.forEach((e, i) => {
    e.rank = i + 1;
  });

  // 12. Available levels — pulled from the program's `levels` config
  //     so the filter chip set isn't hardcoded. Falls back to the
  //     unique levels actually present in roster_assignments.
  const { data: programRows } = await supabase
    .from("programs")
    .select("levels")
    .eq("id", req.programId)
    .maybeSingle();
  const programLevels = (programRows as { levels?: string[] | null } | null)
    ?.levels ?? null;
  const observedLevels = Array.from(
    new Set(
      Array.from(levelByPlayer.values()).filter((v): v is string => Boolean(v)),
    ),
  );
  const availableLevels =
    programLevels && programLevels.length > 0 ? programLevels : observedLevels;

  // 13. metricsInScope metadata for the UI.
  const metricsInScope: RankingsResponse["metricsInScope"] =
    metricsInScopeCodes
      .map((code) => {
        const meta = metricMetaByCode.get(code);
        if (!meta) return null;
        return {
          shortCode: meta.shortCode,
          displayName: meta.displayName,
          direction: meta.direction,
          unit: meta.unit,
          sampleSize: (valuesByMetric.get(code) ?? []).length,
          hasBenchmark: getBenchmark(code) != null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

  return {
    scoringMode: req.scoringMode,
    players: scoredEntries,
    unrankedPlayers: unranked,
    metricsInScope,
    availableTryouts,
    availableLevels,
  };
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Percentile + rank lookup against a sorted array of values.
 *
 * Percentile semantics: 0–100, where 100 = "tied with the best in the
 * pool". We use the "inclusive" definition — a value tied with the
 * best gets 100; a value worse than every other gets 0. This matches
 * what coaches expect when looking at a leaderboard.
 *
 * Rank semantics: 1 = best, n = worst. Ties get the same rank (dense
 * ranking would use 1,2,2,3 — we use competition ranking 1,2,2,4).
 *
 * Edge cases:
 *   - pool empty → percentile=0, rank/rankOf=null
 *   - pool size 1 → that single value gets percentile=100, rank=1
 */
export function computePercentileAndRank(
  value: number,
  sortedAsc: number[],
  direction: ScoreDirection,
): { percentile: number; rank: number; rankOf: number } | { percentile: 0; rank: null; rankOf: null } {
  const n = sortedAsc.length;
  if (n === 0) {
    return { percentile: 0, rank: null, rankOf: null };
  }
  // For lower_better, the "best" end is the smallest value (index 0).
  // For higher_better/rating, the "best" end is the largest value (index n-1).
  // Walk from the best end and find how many values are AT-LEAST as good.
  let countBetterOrEqual = 0;
  let countStrictlyBetter = 0;
  for (let i = 0; i < n; i++) {
    const other = sortedAsc[i];
    if (direction === "lower_better") {
      if (other < value) countStrictlyBetter++;
      if (other <= value) countBetterOrEqual++;
    } else {
      if (other > value) countStrictlyBetter++;
      if (other >= value) countBetterOrEqual++;
    }
  }
  // Percentile (inclusive): fraction of pool with value <= this player's
  // (in better-or-equal terms). Using the BETTER-OR-EQUAL count divided
  // by n times 100 gives 100 for ties at the top, 0+ for ties at the bottom.
  // But that's reversed: we want HIGHER percentile for BETTER values.
  // The fraction of the pool you're better-than-or-equal-to is
  //   1 - countStrictlyBetter / n
  const percentile = round1(((n - countStrictlyBetter) / n) * 100);
  const rank = countStrictlyBetter + 1;
  return { percentile, rank, rankOf: n };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Mirror of the existing classYearForGrade in recruiter.ts. Inlined
 * here so this module doesn't drag the recruiter service in.
 */
function classYearForGrade(grade: number, today: Date = new Date()): number {
  const nowYear = today.getFullYear();
  const yearsRemaining = Math.max(0, 12 - grade);
  return nowYear + yearsRemaining;
}

// Re-export types the UI needs.
export type { ScoreDirection, Benchmark };
