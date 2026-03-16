import { describe, it, expect } from "vitest";
import {
  SPORTS,
  getSportById,
  getSportCategories,
  getSportPositions,
  sportHasBatsThrows,
  formatCategory,
} from "../sports";

describe("SPORTS config", () => {
  it("has four configured sports", () => {
    expect(SPORTS).toHaveLength(4);
    expect(SPORTS.map((s) => s.id)).toEqual(["baseball", "football", "basketball", "soccer"]);
  });

  it("every sport has a non-empty id, label, emoji, positions, categories, and defaultMetrics", () => {
    for (const sport of SPORTS) {
      expect(sport.id).toBeTruthy();
      expect(sport.label).toBeTruthy();
      expect(sport.emoji).toBeTruthy();
      expect(sport.positions.length).toBeGreaterThan(0);
      expect(sport.categories.length).toBeGreaterThan(0);
      expect(sport.defaultMetrics.length).toBeGreaterThan(0);
    }
  });

  it("every default metric has required fields and valid metric_type", () => {
    for (const sport of SPORTS) {
      for (const metric of sport.defaultMetrics) {
        expect(metric.name).toBeTruthy();
        expect(metric.unit).toBeTruthy();
        expect(metric.category).toBeTruthy();
        expect(["timed", "measured", "rated"]).toContain(metric.metric_type);
        expect(metric.sort_order).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("every default metric category exists in its sport's categories list", () => {
    for (const sport of SPORTS) {
      for (const metric of sport.defaultMetrics) {
        expect(sport.categories).toContain(metric.category);
      }
    }
  });

  it("rated metrics have min_value and max_value defined", () => {
    for (const sport of SPORTS) {
      for (const metric of sport.defaultMetrics) {
        if (metric.metric_type === "rated") {
          expect(metric.min_value).toBeDefined();
          expect(metric.max_value).toBeDefined();
          expect(metric.min_value!).toBeLessThan(metric.max_value!);
        }
      }
    }
  });
});

describe("getSportById", () => {
  it("returns the correct sport config", () => {
    const baseball = getSportById("baseball");
    expect(baseball?.label).toBe("Baseball / Softball");
  });

  it("returns undefined for unknown sport", () => {
    expect(getSportById("cricket")).toBeUndefined();
  });
});

describe("getSportCategories", () => {
  it("returns categories for a valid sport", () => {
    const cats = getSportCategories("football");
    expect(cats).toContain("speed");
    expect(cats).toContain("strength");
  });

  it("returns ['other'] for unknown sport", () => {
    expect(getSportCategories("unknown")).toEqual(["other"]);
  });
});

describe("getSportPositions", () => {
  it("returns positions for a valid sport", () => {
    const positions = getSportPositions("baseball");
    expect(positions).toContain("SS");
    expect(positions).toContain("RHP");
  });

  it("returns empty array for unknown sport", () => {
    expect(getSportPositions("unknown")).toEqual([]);
  });
});

describe("sportHasBatsThrows", () => {
  it("returns true for baseball", () => {
    expect(sportHasBatsThrows("baseball")).toBe(true);
  });

  it("returns false for non-baseball sports", () => {
    expect(sportHasBatsThrows("football")).toBe(false);
    expect(sportHasBatsThrows("basketball")).toBe(false);
    expect(sportHasBatsThrows("soccer")).toBe(false);
  });

  it("returns false for unknown sport", () => {
    expect(sportHasBatsThrows("unknown")).toBe(false);
  });
});

describe("formatCategory", () => {
  it("capitalizes single words", () => {
    expect(formatCategory("speed")).toBe("Speed");
    expect(formatCategory("other")).toBe("Other");
  });

  it("capitalizes and spaces underscored words", () => {
    expect(formatCategory("special_teams")).toBe("Special Teams");
  });
});
