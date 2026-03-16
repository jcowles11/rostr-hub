import { describe, it, expect } from "vitest";
import { aggregateValues, computePercentiles } from "../metrics";

// ── aggregateValues ────────────────────────────────────────────────

describe("aggregateValues", () => {
  it("returns null for empty values", () => {
    expect(aggregateValues([], "best", "measured")).toBeNull();
    expect(aggregateValues([], "average", "timed")).toBeNull();
    expect(aggregateValues([], "latest", "rated")).toBeNull();
  });

  describe("best aggregation", () => {
    it("returns highest value for measured metrics", () => {
      expect(aggregateValues([85, 90, 88], "best", "measured")).toBe(90);
    });

    it("returns highest value for rated metrics", () => {
      expect(aggregateValues([6, 8, 7], "best", "rated")).toBe(8);
    });

    it("returns lowest value for timed metrics (lower is better)", () => {
      expect(aggregateValues([7.2, 6.8, 7.0], "best", "timed")).toBe(6.8);
    });

    it("handles single value", () => {
      expect(aggregateValues([42], "best", "measured")).toBe(42);
    });
  });

  describe("average aggregation", () => {
    it("computes mean of all values", () => {
      expect(aggregateValues([10, 20, 30], "average", "measured")).toBe(20);
    });

    it("handles decimal precision", () => {
      const result = aggregateValues([7.1, 7.2, 7.3], "average", "timed");
      expect(result).toBeCloseTo(7.2, 10);
    });

    it("returns value itself for single entry", () => {
      expect(aggregateValues([5], "average", "rated")).toBe(5);
    });
  });

  describe("latest aggregation", () => {
    it("returns last value (assumes chronological order)", () => {
      expect(aggregateValues([85, 90, 88], "latest", "measured")).toBe(88);
    });

    it("returns only value for single entry", () => {
      expect(aggregateValues([42], "latest", "timed")).toBe(42);
    });
  });
});

// ── computePercentiles ─────────────────────────────────────────────

describe("computePercentiles", () => {
  const makePlayer = (id: string, scores: Record<string, number>) => ({
    id,
    scores: new Map(Object.entries(scores)),
  });

  const metrics = [
    { id: "m1", metric_type: "measured" },
    { id: "m2", metric_type: "timed" },
  ];

  it("returns empty map when no players have scores", () => {
    const players = [makePlayer("p1", {}), makePlayer("p2", {})];
    const result = computePercentiles(players, metrics);
    expect(result.size).toBe(0);
  });

  it("assigns 100 percentile to sole scorer on a metric", () => {
    const players = [makePlayer("p1", { m1: 90 })];
    const result = computePercentiles(players, metrics);
    expect(result.get("p1")).toBe(100);
  });

  it("ranks higher value better for measured metrics", () => {
    const players = [
      makePlayer("p1", { m1: 90 }),
      makePlayer("p2", { m1: 80 }),
      makePlayer("p3", { m1: 70 }),
    ];
    const result = computePercentiles(players, [{ id: "m1", metric_type: "measured" }]);
    // p1 is rank 0 (best), p3 is rank 2 (worst) out of 3
    expect(result.get("p1")!).toBe(100);
    expect(result.get("p2")!).toBe(50);
    expect(result.get("p3")!).toBe(0);
  });

  it("ranks lower value better for timed metrics", () => {
    const players = [
      makePlayer("p1", { m2: 6.5 }),
      makePlayer("p2", { m2: 7.0 }),
      makePlayer("p3", { m2: 7.5 }),
    ];
    const result = computePercentiles(players, [{ id: "m2", metric_type: "timed" }]);
    // p1 (6.5) is best for timed
    expect(result.get("p1")!).toBe(100);
    expect(result.get("p2")!).toBe(50);
    expect(result.get("p3")!).toBe(0);
  });

  it("handles ties by assigning average rank percentile", () => {
    const players = [
      makePlayer("p1", { m1: 90 }),
      makePlayer("p2", { m1: 90 }),
      makePlayer("p3", { m1: 70 }),
    ];
    const result = computePercentiles(players, [{ id: "m1", metric_type: "measured" }]);
    // p1 and p2 tie at rank 0-1 → average rank 0.5 → percentile = (2 - 0.5) / 2 * 100 = 75
    expect(result.get("p1")!).toBe(75);
    expect(result.get("p2")!).toBe(75);
    expect(result.get("p3")!).toBe(0);
  });

  it("computes composite as average of per-metric percentiles", () => {
    // p1: best at measured (100%), worst at timed (0%) → composite 50
    // p2: worst at measured (0%), best at timed (100%) → composite 50
    const players = [
      makePlayer("p1", { m1: 90, m2: 7.5 }),
      makePlayer("p2", { m1: 70, m2: 6.5 }),
    ];
    const result = computePercentiles(players, metrics);
    expect(result.get("p1")!).toBe(50);
    expect(result.get("p2")!).toBe(50);
  });

  it("excludes players with no scores from results", () => {
    const players = [
      makePlayer("p1", { m1: 90 }),
      makePlayer("p2", {}), // no scores
    ];
    const result = computePercentiles(players, metrics);
    expect(result.has("p1")).toBe(true);
    expect(result.has("p2")).toBe(false);
  });

  it("handles player scored on only some metrics", () => {
    const players = [
      makePlayer("p1", { m1: 90, m2: 7.0 }),
      makePlayer("p2", { m1: 80 }), // only m1
    ];
    const result = computePercentiles(players, metrics);
    // p1 composite: average of (100% on m1, 100% solo on m2) = 100
    // p2 composite: 0% on m1 (only metric they have) = 0
    expect(result.get("p1")!).toBe(100);
    expect(result.get("p2")!).toBe(0);
  });
});
