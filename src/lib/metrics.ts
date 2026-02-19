/**
 * Compute aggregated value from multiple attempts based on metric settings.
 */
export function aggregateValues(
  values: number[],
  aggregation: "best" | "average" | "latest",
  metricType: "timed" | "measured" | "rated"
): number | null {
  if (values.length === 0) return null;
  if (aggregation === "average") {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  if (aggregation === "latest") {
    return values[values.length - 1]; // assumes values are in chronological order
  }
  // "best" — depends on metric type
  if (metricType === "timed") {
    return Math.min(...values); // lower is better
  }
  return Math.max(...values); // higher is better for measured/rated
}

/**
 * Compute percentile-based composite scores for all players.
 * For each metric, ranks players within the cohort and converts to 0-100 percentile.
 * Returns a map of playerId -> composite percentile (average of per-metric percentiles).
 */
export function computePercentiles(
  players: { id: string; scores: Map<string, number> }[],
  metrics: { id: string; metric_type: string }[]
): Map<string, number> {
  const metricTypeMap = new Map(metrics.map((m) => [m.id, m.metric_type]));
  // For each metric, collect { playerId, value } pairs
  const perMetricPercentiles = new Map<string, Map<string, number>>(); // metricId -> (playerId -> percentile)

  for (const metric of metrics) {
    const entries: { id: string; value: number }[] = [];
    for (const p of players) {
      const v = p.scores.get(metric.id);
      if (v !== undefined) entries.push({ id: p.id, value: v });
    }
    if (entries.length < 2) {
      // With 0 or 1 player, percentile is trivially 100 (or skip)
      const pMap = new Map<string, number>();
      entries.forEach((e) => pMap.set(e.id, 100));
      perMetricPercentiles.set(metric.id, pMap);
      continue;
    }

    const isTimed = metricTypeMap.get(metric.id) === "timed";
    // Sort: for timed lower is better (ascending = best first), otherwise descending
    entries.sort((a, b) => (isTimed ? a.value - b.value : b.value - a.value));

    const pMap = new Map<string, number>();
    const total = entries.length;
    for (let i = 0; i < total; i++) {
      // Handle ties: find the range of equal values and assign average rank
      let j = i;
      while (j < total - 1 && entries[j + 1].value === entries[i].value) j++;
      const avgRank = (i + j) / 2; // 0-indexed average rank
      const percentile = ((total - 1 - avgRank) / (total - 1)) * 100;
      for (let k = i; k <= j; k++) {
        pMap.set(entries[k].id, percentile);
      }
      i = j; // skip tied entries
    }
    perMetricPercentiles.set(metric.id, pMap);
  }

  // Composite: average percentiles across all metrics each player has
  const result = new Map<string, number>();
  for (const p of players) {
    const percentiles: number[] = [];
    for (const [metricId, pMap] of perMetricPercentiles) {
      const pctl = pMap.get(p.id);
      if (pctl !== undefined) percentiles.push(pctl);
    }
    if (percentiles.length > 0) {
      result.set(p.id, percentiles.reduce((a, b) => a + b, 0) / percentiles.length);
    }
  }
  return result;
}

export const AGGREGATION_LABELS: Record<string, string> = {
  best: "Best attempt",
  average: "Average all",
  latest: "Latest only",
};
