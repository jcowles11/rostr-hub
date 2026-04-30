/**
 * Sport-config-driven metric benchmarks for the rankings engine.
 *
 * Why a TypeScript module (not a DB table) for v1:
 *   - The benchmarks below are baseline / public-knowledge ranges
 *     the coach can't realistically tune without explicit guidance.
 *   - Pushing them into Postgres adds an admin UI dependency and a
 *     migration we'd need to maintain. Keeping it in code lets us
 *     iterate the formula in a PR.
 *   - When a coach asks for per-program tuning, lift this into a
 *     `metric_benchmarks` table with the same shape — the rankings
 *     service consumes a `Benchmark` interface, not these literals
 *     directly. Drop-in replacement.
 *
 * Direction notes:
 *   - "lower_better" stations: smaller numbers earn higher grades
 *     (60yd time, catcher pop time).
 *   - "higher_better" stations: bigger numbers earn higher grades
 *     (exit velocity, fastball velo, infield velo).
 *
 * Grading model (Benchmark mode):
 *   Each band defines a range [min, max] and a fixed score (0-100).
 *   Within a band we LINEARLY INTERPOLATE so a 6.95 60yd doesn't
 *   collapse to the same score as a 6.99. Outside all bands we clamp
 *   to the nearest endpoint (0 if worse than the worst band, 100 if
 *   better than the best).
 *
 * Unit assumptions are documented per metric. The rankings engine
 * does NOT do unit conversion — values come from `tryout_scores`
 * which records raw numerics; whatever unit the coach typed in is
 * what the benchmark lookup compares against. If a station's data
 * is in a different unit (e.g. someone typed metric times instead
 * of seconds), benchmarks will be wrong. That's a coach-side data
 * hygiene issue, not a benchmark issue.
 */

export type ScoreDirection = "lower_better" | "higher_better" | "rating";

export interface BenchmarkBand {
  /** Inclusive lower bound of the raw value range. */
  min: number;
  /** Inclusive upper bound of the raw value range. */
  max: number;
  /** Score (0-100) at this range. Within the band we interpolate linearly. */
  score: number;
}

export interface Benchmark {
  /** Station short_code this benchmark targets (e.g. "60yd", "EV"). */
  shortCode: string;
  /** Station display name; used for tooltips. */
  displayName: string;
  /** Direction. Determines interpolation orientation in the lookup. */
  direction: ScoreDirection;
  /** Recorded unit (informational only — engine does no conversion). */
  unit: string;
  /**
   * Bands ordered from worst → best. The first band's `score` is the
   * floor (anything worse clamps to that score, typically 0); the
   * last band's `score` is the ceiling (anything better clamps to
   * that score, typically 100).
   *
   * For lower_better metrics, "worst" means largest value; "best"
   * means smallest value. We normalize by sorting at lookup time.
   */
  bands: BenchmarkBand[];
}

/**
 * Default baseball benchmarks. Numbers are calibrated against
 * widely-published HS-varsity / college recruiting reference points.
 * Treat as starting defaults — a real program will want to retune
 * once they've collected their own data.
 */
export const BASEBALL_BENCHMARKS: Record<string, Benchmark> = {
  // 60-yard dash — lower is better. Standard recruiting reference:
  //   ≤6.5s D1-elite, ~6.9s D1-good, 7.2s solid HS varsity, 7.5s+ JV.
  "60yd": {
    shortCode: "60yd",
    displayName: "60-yard dash",
    direction: "lower_better",
    unit: "s",
    bands: [
      { min: 8.0, max: 8.5, score: 0 },
      { min: 7.6, max: 7.99, score: 25 },
      { min: 7.3, max: 7.59, score: 50 },
      { min: 7.0, max: 7.29, score: 70 },
      { min: 6.7, max: 6.99, score: 85 },
      { min: 6.4, max: 6.69, score: 95 },
      { min: 5.9, max: 6.39, score: 100 },
    ],
  },
  // Exit velocity (off the tee or BP) — higher is better.
  //   90 mph+ D1-elite, 85 mph D1-typical, 80 mph solid HS varsity.
  EV: {
    shortCode: "EV",
    displayName: "Exit velocity",
    direction: "higher_better",
    unit: "mph",
    bands: [
      { min: 60, max: 69.9, score: 0 },
      { min: 70, max: 74.9, score: 25 },
      { min: 75, max: 79.9, score: 50 },
      { min: 80, max: 84.9, score: 70 },
      { min: 85, max: 89.9, score: 85 },
      { min: 90, max: 94.9, score: 95 },
      { min: 95, max: 110, score: 100 },
    ],
  },
  // Fastball velo (mound) — higher is better.
  //   90 mph+ D1, 85 mph mid-D1, 80 mph solid HS, <75 still developing.
  Velo: {
    shortCode: "Velo",
    displayName: "Fastball velocity",
    direction: "higher_better",
    unit: "mph",
    bands: [
      { min: 60, max: 69.9, score: 0 },
      { min: 70, max: 74.9, score: 25 },
      { min: 75, max: 79.9, score: 50 },
      { min: 80, max: 82.9, score: 65 },
      { min: 83, max: 86.9, score: 80 },
      { min: 87, max: 89.9, score: 90 },
      { min: 90, max: 99, score: 100 },
    ],
  },
  // Infield velo (across-the-diamond) — higher is better.
  //   85+ D1 SS / 3B, 78 mid-D1, 72 HS varsity, <65 needs work.
  IFVelo: {
    shortCode: "IFVelo",
    displayName: "Infield velocity",
    direction: "higher_better",
    unit: "mph",
    bands: [
      { min: 55, max: 64.9, score: 0 },
      { min: 65, max: 69.9, score: 30 },
      { min: 70, max: 74.9, score: 55 },
      { min: 75, max: 79.9, score: 75 },
      { min: 80, max: 84.9, score: 90 },
      { min: 85, max: 100, score: 100 },
    ],
  },
  // Outfield velo — higher is better.
  //   90+ D1, 85 mid-D1, 78 HS varsity.
  OFVelo: {
    shortCode: "OFVelo",
    displayName: "Outfield velocity",
    direction: "higher_better",
    unit: "mph",
    bands: [
      { min: 60, max: 69.9, score: 0 },
      { min: 70, max: 74.9, score: 30 },
      { min: 75, max: 79.9, score: 55 },
      { min: 80, max: 84.9, score: 75 },
      { min: 85, max: 89.9, score: 90 },
      { min: 90, max: 105, score: 100 },
    ],
  },
  // Catcher pop time (home → second) — lower is better.
  //   <1.85 D1-elite, 1.95 D1-typical, 2.05 HS varsity, >2.20 needs work.
  Pop: {
    shortCode: "Pop",
    displayName: "Catcher pop time",
    direction: "lower_better",
    unit: "s",
    bands: [
      { min: 2.30, max: 2.50, score: 0 },
      { min: 2.15, max: 2.29, score: 30 },
      { min: 2.00, max: 2.14, score: 60 },
      { min: 1.90, max: 1.99, score: 80 },
      { min: 1.80, max: 1.89, score: 95 },
      { min: 1.65, max: 1.79, score: 100 },
    ],
  },
  // Subjective rating stations (Field, BP) — already 1-5 / 1-10 scale.
  // Direction higher_better; just normalize to the 0-100 grid.
  Field: {
    shortCode: "Field",
    displayName: "Fielding (rating)",
    direction: "rating",
    unit: "1-5",
    bands: [
      { min: 1, max: 1.99, score: 0 },
      { min: 2, max: 2.99, score: 35 },
      { min: 3, max: 3.99, score: 65 },
      { min: 4, max: 4.49, score: 85 },
      { min: 4.5, max: 5, score: 100 },
    ],
  },
  BP: {
    shortCode: "BP",
    displayName: "BP (rating)",
    direction: "rating",
    unit: "1-5",
    bands: [
      { min: 1, max: 1.99, score: 0 },
      { min: 2, max: 2.99, score: 35 },
      { min: 3, max: 3.99, score: 65 },
      { min: 4, max: 4.49, score: 85 },
      { min: 4.5, max: 5, score: 100 },
    ],
  },
};

/**
 * Score a single raw value against a benchmark.
 *
 * For lower_better:
 *   - Values larger than the floor (worst) clamp to that score.
 *   - Values smaller than the ceiling (best) clamp to that score.
 *   - Within a band, interpolate linearly toward the next-better band.
 *
 * For higher_better / rating:
 *   - Values smaller than the floor clamp to that score.
 *   - Values larger than the ceiling clamp to that score.
 *   - Within a band, interpolate linearly toward the next-better band.
 *
 * Returns null if benchmark has no bands or value is non-finite —
 * caller should treat that as "missing" and exclude from the overall.
 */
export function scoreAgainstBenchmark(
  value: number,
  benchmark: Benchmark,
): number | null {
  if (!Number.isFinite(value)) return null;
  if (!benchmark.bands || benchmark.bands.length === 0) return null;

  // Sort bands worst→best in score-axis terms regardless of direction.
  // We always treat the band with the lowest `score` as "worst" and
  // highest `score` as "best", which matches how the literals are
  // written above; sort defensively in case the data is reordered.
  const sorted = [...benchmark.bands].sort((a, b) => a.score - b.score);
  const lower = benchmark.direction === "lower_better";

  // Locate the band that contains `value` (or the closest endpoint).
  // For lower_better: `min..max` is the value range, but smaller value
  //   = better grade. For higher_better/rating: bigger value = better.
  // Either way `value ∈ [band.min, band.max]` selects the band.
  for (let i = 0; i < sorted.length; i++) {
    const band = sorted[i];
    if (value >= band.min && value <= band.max) {
      // Interpolate toward the next-better band's score across the
      // value axis. Direction matters for which endpoint maps to the
      // "next" score:
      //   - higher_better: at band.max, we're closest to the next band → next band's score
      //     at band.min, we're at this band's floor → band.score
      //   - lower_better: at band.min, we're closest to the next band → next band's score
      //     at band.max, we're at this band's floor → band.score
      const next = sorted[i + 1];
      if (!next) {
        // Top band — clamp at this band's score (already the ceiling).
        return clamp01_100(band.score);
      }
      // Compute the t in [0..1] for how far through this band we are
      // toward the next-better one.
      let t: number;
      if (lower) {
        // Closer to band.min = closer to next band (better).
        t = (band.max - value) / (band.max - band.min || 1);
      } else {
        // Closer to band.max = closer to next band (better).
        t = (value - band.min) / (band.max - band.min || 1);
      }
      t = Math.max(0, Math.min(1, t));
      return clamp01_100(band.score + (next.score - band.score) * t);
    }
  }

  // Outside every band — clamp to the nearest endpoint by direction.
  if (lower) {
    // Smaller-is-better: if value is smaller than the smallest min,
    // it's better than the best band → ceiling. If larger than the
    // largest max, worse than the worst band → floor.
    const ceilingBand = sorted[sorted.length - 1];
    const floorBand = sorted[0];
    if (value < ceilingBand.min) return clamp01_100(ceilingBand.score);
    if (value > floorBand.max) return clamp01_100(floorBand.score);
  } else {
    const floorBand = sorted[0];
    const ceilingBand = sorted[sorted.length - 1];
    if (value < floorBand.min) return clamp01_100(floorBand.score);
    if (value > ceilingBand.max) return clamp01_100(ceilingBand.score);
  }

  return null;
}

function clamp01_100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

/**
 * Look up the benchmark for a given station short_code. Returns null
 * when the station doesn't have a configured benchmark — coach-side
 * code can decide whether to fall back to percentile-only mode.
 */
export function getBenchmark(shortCode: string): Benchmark | null {
  return BASEBALL_BENCHMARKS[shortCode] ?? null;
}

/**
 * List of well-known short_codes the engine has benchmarks for. Useful
 * for the metric-picker UI ("only show metrics that can be benchmarked").
 */
export const BENCHMARKED_SHORT_CODES = Object.keys(BASEBALL_BENCHMARKS);
