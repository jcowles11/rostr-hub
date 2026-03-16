import { describe, it, expect } from "vitest";
import {
  createPlayerSchema,
  createSessionSchema,
  updateSessionSchema,
  createMetricSchema,
  scoreEntrySchema,
  validate,
  validateScoreValue,
  type MetricBounds,
} from "../validation";

// ── createPlayerSchema ─────────────────────────────────────────────

describe("createPlayerSchema", () => {
  const validPlayer = {
    program_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    first_name: "John",
    last_name: "Smith",
    grade: 10,
    positions: ["SS", "2B"],
    bats: "R" as const,
    throws: "R" as const,
  };

  it("accepts valid player data", () => {
    const result = createPlayerSchema.safeParse(validPlayer);
    expect(result.success).toBe(true);
  });

  it("trims whitespace from names", () => {
    const result = createPlayerSchema.safeParse({
      ...validPlayer,
      first_name: "  John  ",
      last_name: "  Smith  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.first_name).toBe("John");
      expect(result.data.last_name).toBe("Smith");
    }
  });

  it("rejects empty first name", () => {
    const result = createPlayerSchema.safeParse({ ...validPlayer, first_name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty last name", () => {
    const result = createPlayerSchema.safeParse({ ...validPlayer, last_name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only names", () => {
    const result = createPlayerSchema.safeParse({ ...validPlayer, first_name: "   " });
    expect(result.success).toBe(false);
  });

  it("allows null grade", () => {
    const result = createPlayerSchema.safeParse({ ...validPlayer, grade: null });
    expect(result.success).toBe(true);
  });

  it("rejects grade out of range", () => {
    expect(createPlayerSchema.safeParse({ ...validPlayer, grade: 0 }).success).toBe(false);
    expect(createPlayerSchema.safeParse({ ...validPlayer, grade: 17 }).success).toBe(false);
  });

  it("rejects non-integer grade", () => {
    expect(createPlayerSchema.safeParse({ ...validPlayer, grade: 10.5 }).success).toBe(false);
  });

  it("allows null bats/throws", () => {
    const result = createPlayerSchema.safeParse({ ...validPlayer, bats: null, throws: null });
    expect(result.success).toBe(true);
  });

  it("rejects invalid bats value", () => {
    const result = createPlayerSchema.safeParse({ ...validPlayer, bats: "X" });
    expect(result.success).toBe(false);
  });

  it("allows empty positions array", () => {
    const result = createPlayerSchema.safeParse({ ...validPlayer, positions: [] });
    expect(result.success).toBe(true);
  });

  it("rejects more than 10 positions", () => {
    const positions = Array.from({ length: 11 }, (_, i) => `P${i}`);
    const result = createPlayerSchema.safeParse({ ...validPlayer, positions });
    expect(result.success).toBe(false);
  });

  it("rejects invalid program_id format", () => {
    const result = createPlayerSchema.safeParse({ ...validPlayer, program_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

// ── createSessionSchema ────────────────────────────────────────────

describe("createSessionSchema", () => {
  const validSession = {
    program_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "Fall Tryouts",
    session_date: "2026-03-15",
  };

  it("accepts valid session data", () => {
    const result = createSessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createSessionSchema.safeParse({ ...validSession, name: "" }).success).toBe(false);
  });

  it("trims name", () => {
    const result = createSessionSchema.safeParse({ ...validSession, name: "  Fall Tryouts  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Fall Tryouts");
  });

  it("rejects invalid date format", () => {
    expect(createSessionSchema.safeParse({ ...validSession, session_date: "03/15/2026" }).success).toBe(false);
    expect(createSessionSchema.safeParse({ ...validSession, session_date: "2026-3-15" }).success).toBe(false);
  });
});

// ── createMetricSchema ─────────────────────────────────────────────

describe("createMetricSchema", () => {
  const validMetric = {
    program_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "60-Yard Dash",
    unit: "sec",
    category: "running",
    metric_type: "timed" as const,
    aggregation: "best" as const,
    max_attempts: 3,
    sort_order: 0,
    min_value: null,
    max_value: null,
  };

  it("accepts valid metric data", () => {
    const result = createMetricSchema.safeParse(validMetric);
    expect(result.success).toBe(true);
  });

  it("rejects empty metric name", () => {
    expect(createMetricSchema.safeParse({ ...validMetric, name: "" }).success).toBe(false);
  });

  it("rejects invalid metric_type", () => {
    expect(createMetricSchema.safeParse({ ...validMetric, metric_type: "speed" }).success).toBe(false);
  });

  it("rejects invalid aggregation", () => {
    expect(createMetricSchema.safeParse({ ...validMetric, aggregation: "median" }).success).toBe(false);
  });

  it("rejects max_attempts of 0", () => {
    expect(createMetricSchema.safeParse({ ...validMetric, max_attempts: 0 }).success).toBe(false);
  });

  it("rejects max_attempts over 10", () => {
    expect(createMetricSchema.safeParse({ ...validMetric, max_attempts: 11 }).success).toBe(false);
  });

  it("rejects min_value >= max_value when both set", () => {
    const result = createMetricSchema.safeParse({ ...validMetric, min_value: 80, max_value: 20 });
    expect(result.success).toBe(false);
  });

  it("allows min_value < max_value", () => {
    const result = createMetricSchema.safeParse({ ...validMetric, min_value: 20, max_value: 80 });
    expect(result.success).toBe(true);
  });
});

// ── scoreEntrySchema ───────────────────────────────────────────────

describe("scoreEntrySchema", () => {
  const validScore = {
    program_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    player_id: "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
    metric_id: "c1b2c3d4-e5f6-7890-abcd-ef1234567890",
    coach_id: "d1b2c3d4-e5f6-7890-abcd-ef1234567890",
    session_id: "e1b2c3d4-e5f6-7890-abcd-ef1234567890",
    attempt_number: 1,
    value: 6.85,
  };

  it("accepts valid score data", () => {
    const result = scoreEntrySchema.safeParse(validScore);
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID IDs", () => {
    expect(scoreEntrySchema.safeParse({ ...validScore, player_id: "abc" }).success).toBe(false);
  });

  it("rejects attempt_number of 0", () => {
    expect(scoreEntrySchema.safeParse({ ...validScore, attempt_number: 0 }).success).toBe(false);
  });

  it("rejects NaN value", () => {
    expect(scoreEntrySchema.safeParse({ ...validScore, value: NaN }).success).toBe(false);
  });

  it("rejects Infinity value", () => {
    expect(scoreEntrySchema.safeParse({ ...validScore, value: Infinity }).success).toBe(false);
  });

  it("accepts negative values (some metrics can be negative)", () => {
    expect(scoreEntrySchema.safeParse({ ...validScore, value: -5 }).success).toBe(true);
  });

  it("accepts zero value", () => {
    expect(scoreEntrySchema.safeParse({ ...validScore, value: 0 }).success).toBe(true);
  });
});

// ── validate helper ────────────────────────────────────────────────

describe("validate helper", () => {
  it("returns success with parsed data for valid input", () => {
    const result = validate(scoreEntrySchema, {
      program_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      player_id: "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
      metric_id: "c1b2c3d4-e5f6-7890-abcd-ef1234567890",
      coach_id: "d1b2c3d4-e5f6-7890-abcd-ef1234567890",
      session_id: "e1b2c3d4-e5f6-7890-abcd-ef1234567890",
      attempt_number: 1,
      value: 6.85,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.value).toBe(6.85);
  });

  it("returns error string for invalid input", () => {
    const result = validate(scoreEntrySchema, { value: "not a number" });
    expect(result.success).toBe(false);
    if (!result.success) expect(typeof result.error).toBe("string");
  });
});

// ── validateScoreValue (metric bounds) ─────────────────────────────

describe("validateScoreValue", () => {
  const ratedMetric: MetricBounds = {
    min_value: 20,
    max_value: 80,
    metric_type: "rated",
    name: "Fielding",
    unit: "20-80",
  };

  const timedMetric: MetricBounds = {
    min_value: null,
    max_value: null,
    metric_type: "timed",
    name: "60-Yard Dash",
    unit: "sec",
  };

  it("returns null for value within rated bounds", () => {
    expect(validateScoreValue(50, ratedMetric)).toBeNull();
    expect(validateScoreValue(20, ratedMetric)).toBeNull();
    expect(validateScoreValue(80, ratedMetric)).toBeNull();
  });

  it("rejects value below min for rated metric", () => {
    const error = validateScoreValue(15, ratedMetric);
    expect(error).not.toBeNull();
    expect(error).toContain("minimum");
    expect(error).toContain("20");
  });

  it("rejects value above max for rated metric", () => {
    const error = validateScoreValue(85, ratedMetric);
    expect(error).not.toBeNull();
    expect(error).toContain("maximum");
    expect(error).toContain("80");
  });

  it("returns null for any finite value when no bounds set", () => {
    expect(validateScoreValue(6.5, timedMetric)).toBeNull();
    expect(validateScoreValue(100, timedMetric)).toBeNull();
    expect(validateScoreValue(-1, timedMetric)).toBeNull();
  });

  it("rejects NaN", () => {
    expect(validateScoreValue(NaN, timedMetric)).not.toBeNull();
  });

  it("rejects Infinity", () => {
    expect(validateScoreValue(Infinity, timedMetric)).not.toBeNull();
  });

  it("handles only min_value set", () => {
    const onlyMin: MetricBounds = { ...timedMetric, min_value: 0 };
    expect(validateScoreValue(5, onlyMin)).toBeNull();
    expect(validateScoreValue(-1, onlyMin)).not.toBeNull();
  });

  it("handles only max_value set", () => {
    const onlyMax: MetricBounds = { ...timedMetric, max_value: 100 };
    expect(validateScoreValue(50, onlyMax)).toBeNull();
    expect(validateScoreValue(101, onlyMax)).not.toBeNull();
  });
});
