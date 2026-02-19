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

export const AGGREGATION_LABELS: Record<string, string> = {
  best: "Best attempt",
  average: "Average all",
  latest: "Latest only",
};
