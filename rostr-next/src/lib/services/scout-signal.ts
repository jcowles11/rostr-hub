import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  searchPlayers,
  type SearchFilters,
  type PlayerSearchResult,
} from "./recruiter";

/**
 * Scout Signal + Ranking — service used by /scout/discover.
 *
 * The flag-gated discovery surface needs more than a name + position
 * search; scouts want to see "who has the most coach-vouched data"
 * first. Migration 38 added a per-player aggregate view
 * (player_scout_signal) so we can answer that without N+1 queries.
 *
 * This module:
 *   1. Defines the score formula (TypeScript so it's tweakable
 *      without an ALTER VIEW).
 *   2. Wraps the existing `searchPlayers` with a follow-up signal
 *      lookup, joined in memory by player_id.
 *   3. Returns results sorted by score desc, then last_name + first
 *      name for stable secondary order.
 *
 * Performance note: the existing search returns at most `limit` rows
 * (default 50). The signal lookup is a single batched IN query
 * against player_scout_signal. Total round trips: 2 (search +
 * signals). No per-player loops.
 */

export interface PlayerSignal {
  /** Sum of coach-vouched data points across every surface. */
  totalVerifiedCount: number;
  /** Per-source breakdown for the card UI. */
  verifiedHighlightsCount: number;
  verifiedPriorStatsCount: number;
  verifiedMeasurablesCount: number;
  /** Booleans for the "key metric presence" component of the score. */
  hasVelo: boolean;
  hasEv: boolean;
  has60yd: boolean;
  hasField: boolean;
  hasBp: boolean;
  /**
   * Latest verified timestamp across all sources. Null when there's
   * been no coach-vouched data point on this player yet.
   */
  latestSignalAt: string | null;
  /**
   * Computed score. Higher = more recruiter-relevant. Always >= 0.
   * Formula lives in `computeSignalScore` below.
   */
  signalScore: number;
}

/**
 * Combines a recruiter PlayerSearchResult with its computed signal.
 * Returned from `searchPlayersForScout` instead of bare PlayerSearch-
 * Result so the UI doesn't need to do its own lookups.
 */
export type RankedPlayer = PlayerSearchResult & {
  signal: PlayerSignal;
};

/**
 * Score weights per source. These are empirical defaults — a verified
 * highlight (a coach watching tape and vouching for it) is the
 * loudest single signal, then prior stats (a coach signing off on
 * "this kid hit .380 last season"), then measurables (each one is a
 * single tryout-day data point).
 *
 * Key-metric bonuses reward presence of the three numbers a recruiter
 * always asks for first: pitcher velo, exit velo, 60yd.
 *
 * Recency bonus: 0-10 points based on freshness of the most recent
 * verified event. Players who got vouched-for in the last 30 days
 * float to the top.
 *
 * No magic. These are tunable; if a coach uses the surface for a
 * week and complains about ordering, change the numbers and ship.
 */
const WEIGHT_PER_VERIFIED_HIGHLIGHT = 5;
const WEIGHT_PER_VERIFIED_PRIOR_STAT = 3;
const WEIGHT_PER_VERIFIED_MEASURABLE = 2;
const BONUS_HAS_VELO = 4;
const BONUS_HAS_EV = 4;
const BONUS_HAS_60YD = 3;
const RECENCY_MAX_BONUS = 10;
const RECENCY_HALF_LIFE_DAYS = 60; // 30d → ~7pts, 60d → 5pts, 180d → ~1pt

/**
 * Compute the per-player signal score from the raw view columns.
 *
 * Total = sum(verified counts × weights) + key-metric bonuses + recency.
 *
 * Pure function — easy to unit-test, easy to retune. Always ≥ 0.
 */
export function computeSignalScore(
  s: Omit<PlayerSignal, "signalScore" | "totalVerifiedCount"> & {
    latestSignalAt: string | null;
  },
): number {
  let score = 0;
  score += s.verifiedHighlightsCount * WEIGHT_PER_VERIFIED_HIGHLIGHT;
  score += s.verifiedPriorStatsCount * WEIGHT_PER_VERIFIED_PRIOR_STAT;
  score += s.verifiedMeasurablesCount * WEIGHT_PER_VERIFIED_MEASURABLE;
  if (s.hasVelo) score += BONUS_HAS_VELO;
  if (s.hasEv) score += BONUS_HAS_EV;
  if (s.has60yd) score += BONUS_HAS_60YD;
  // Recency bonus: exponential decay. Max bonus when latest_signal_at
  // is right now; falls to RECENCY_MAX_BONUS / 2 at the half-life.
  if (s.latestSignalAt) {
    const t = Date.parse(s.latestSignalAt);
    if (!Number.isNaN(t)) {
      const daysAgo = Math.max(0, (Date.now() - t) / (1000 * 60 * 60 * 24));
      const decay = Math.pow(0.5, daysAgo / RECENCY_HALF_LIFE_DAYS);
      score += RECENCY_MAX_BONUS * decay;
    }
  }
  return Math.round(score * 10) / 10; // one decimal for readability
}

/**
 * Search for players, then attach signal metadata + sort by score.
 *
 * Behavior:
 *   - Reuses searchPlayers, which gates on profile_public=true at
 *     the SQL view layer.
 *   - Issues a single follow-up SELECT against player_scout_signal
 *     restricted by the result-set ids (no N+1 — one extra query
 *     regardless of result count).
 *   - Players missing from player_scout_signal (e.g. fresh row, view
 *     replica lag) get a zero-signal default.
 *   - Default sort: signalScore DESC, then last_name ASC, then
 *     first_name ASC. Caller can pass `verifiedOnly: true` to drop
 *     zero-score players entirely.
 */
/**
 * State codes whose programs are excluded from scout discovery. Mirrors
 * the middleware-level scout signup gate. Underlying reasons:
 *   CA — SOPIPA prohibits ed-tech profile creation for non-K-12 use
 *   NY — Ed Law 2-d Bill of Rights / DPA / DPO infrastructure not built
 * Migration 40 enforces the same restriction at the SQL view layer
 * (scout_eligible_player_search); this app-layer filter is defense-
 * in-depth.
 */
const SCOUT_GEO_BLOCKED_OPERATING_STATES = new Set(["CA", "NY"]);

export async function searchPlayersForScout(
  filters: SearchFilters & { verifiedOnly?: boolean },
): Promise<{ players: RankedPlayer[]; total: number }> {
  const { players: rawPlayers, total } = await searchPlayers(filters);
  if (rawPlayers.length === 0) {
    return { players: [], total };
  }

  const supabase = createSupabaseServerClient();

  // Geo gate: drop players whose program is in a restricted state.
  // PlayerSearchResult doesn't currently expose program_id; we look it
  // up via a single batched query on the players table — cheap because
  // we already have the player ids in memory.
  const playerIds = rawPlayers.map((p) => p.id);
  const { data: programByPlayer } = await supabase
    .from("players")
    .select("id, program_id")
    .in("id", playerIds);
  const programIdByPlayer = new Map<string, string>(
    (programByPlayer ?? []).map(
      (r) =>
        [
          (r as { id: string }).id,
          (r as { program_id: string }).program_id,
        ] as [string, string],
    ),
  );
  const programIds = Array.from(new Set(programIdByPlayer.values()));
  let blockedProgramIds = new Set<string>();
  if (programIds.length > 0) {
    const { data: progRows } = await supabase
      .from("programs")
      .select("id, operating_state")
      .in("id", programIds);
    blockedProgramIds = new Set(
      (progRows ?? [])
        .filter((p) =>
          SCOUT_GEO_BLOCKED_OPERATING_STATES.has(
            String((p as { operating_state: string | null }).operating_state ?? ""),
          ),
        )
        .map((p) => (p as { id: string }).id),
    );
  }
  const players = rawPlayers.filter((p) => {
    const pid = programIdByPlayer.get(p.id);
    return pid != null && !blockedProgramIds.has(pid);
  });
  if (players.length === 0) {
    return { players: [], total: 0 };
  }
  const ids = players.map((p) => p.id);
  const { data: signals } = await supabase
    .from("player_scout_signal")
    .select(
      "player_id, verified_highlights_count, verified_prior_stats_count, has_velo, has_ev, has_60yd, has_field, has_bp, latest_signal_at",
    )
    .in("player_id", ids);

  const signalById = new Map<string, PlayerSignal>();
  for (const r of signals ?? []) {
    const playerId = (r as { player_id: string }).player_id;
    const verifiedHighlightsCount =
      Number(
        (r as { verified_highlights_count: number | null })
          .verified_highlights_count,
      ) || 0;
    const verifiedPriorStatsCount =
      Number(
        (r as { verified_prior_stats_count: number | null })
          .verified_prior_stats_count,
      ) || 0;
    const hasVelo = Boolean((r as { has_velo: number }).has_velo);
    const hasEv = Boolean((r as { has_ev: number }).has_ev);
    const has60yd = Boolean((r as { has_60yd: number }).has_60yd);
    const hasField = Boolean((r as { has_field: number }).has_field);
    const hasBp = Boolean((r as { has_bp: number }).has_bp);
    // verifiedMeasurablesCount = sum of present measurable flags.
    // Tryout scores are coach-recorded so each present measurable
    // counts as one verified data point.
    const verifiedMeasurablesCount =
      (hasVelo ? 1 : 0) +
      (hasEv ? 1 : 0) +
      (has60yd ? 1 : 0) +
      (hasField ? 1 : 0) +
      (hasBp ? 1 : 0);
    const latestSignalAtRaw = (r as { latest_signal_at: string | null })
      .latest_signal_at;
    // -infinity sentinel from the view's GREATEST() reads as ISO string;
    // treat it as null for downstream UX.
    const latestSignalAt =
      latestSignalAtRaw && !latestSignalAtRaw.startsWith("-")
        ? latestSignalAtRaw
        : null;

    const totalVerifiedCount =
      verifiedHighlightsCount +
      verifiedPriorStatsCount +
      verifiedMeasurablesCount;
    const signalScore = computeSignalScore({
      verifiedHighlightsCount,
      verifiedPriorStatsCount,
      verifiedMeasurablesCount,
      hasVelo,
      hasEv,
      has60yd,
      hasField,
      hasBp,
      latestSignalAt,
    });
    signalById.set(playerId, {
      totalVerifiedCount,
      verifiedHighlightsCount,
      verifiedPriorStatsCount,
      verifiedMeasurablesCount,
      hasVelo,
      hasEv,
      has60yd,
      hasField,
      hasBp,
      latestSignalAt,
      signalScore,
    });
  }

  // Default-zero for any player missing from the view (race condition
  // or fresh insert). Treat as "no signal yet" rather than excluding.
  const ranked: RankedPlayer[] = players.map((p) => ({
    ...p,
    signal:
      signalById.get(p.id) ?? {
        totalVerifiedCount: 0,
        verifiedHighlightsCount: 0,
        verifiedPriorStatsCount: 0,
        verifiedMeasurablesCount: 0,
        hasVelo: false,
        hasEv: false,
        has60yd: false,
        hasField: false,
        hasBp: false,
        latestSignalAt: null,
        signalScore: 0,
      },
  }));

  // Verified-only filter: players with no coach-vouched data point
  // anywhere drop out. Stricter than the v1 "has any tryout
  // measurable" definition — the new test is signalScore > 0.
  const filtered = filters.verifiedOnly
    ? ranked.filter((r) => r.signal.signalScore > 0)
    : ranked;

  // Sort by score desc, then alphabetical for stable secondary order.
  filtered.sort((a, b) => {
    if (b.signal.signalScore !== a.signal.signalScore) {
      return b.signal.signalScore - a.signal.signalScore;
    }
    const ln = a.lastName.localeCompare(b.lastName);
    if (ln !== 0) return ln;
    return a.firstName.localeCompare(b.firstName);
  });

  return { players: filtered, total: filtered.length };
}
