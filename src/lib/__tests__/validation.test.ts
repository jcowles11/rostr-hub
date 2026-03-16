import { describe, it, expect } from "vitest";
import {
  createPlayerSchema,
  createSessionSchema,
  updateSessionSchema,
  createMetricSchema,
  scoreEntrySchema,
  createGameSchema,
  updateGameSchema,
  createPracticeSchema,
  updatePracticeSchema,
  createPracticeBlockSchema,
  updatePlayerProfileSchema,
  addCoachSchema,
  createSeasonSchema,
  createProgramSchema,
  createOrganizationSchema,
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

// ── updateSessionSchema ───────────────────────────────────────────

describe("updateSessionSchema", () => {
  const validUpdate = {
    name: "Updated Tryouts",
    session_date: "2026-04-01",
  };

  it("accepts valid update data", () => {
    const result = updateSessionSchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(updateSessionSchema.safeParse({ ...validUpdate, name: "" }).success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    expect(updateSessionSchema.safeParse({ ...validUpdate, name: "   " }).success).toBe(false);
  });

  it("trims name", () => {
    const result = updateSessionSchema.safeParse({ ...validUpdate, name: "  Trimmed  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Trimmed");
  });

  it("rejects invalid date format", () => {
    expect(updateSessionSchema.safeParse({ ...validUpdate, session_date: "04/01/2026" }).success).toBe(false);
    expect(updateSessionSchema.safeParse({ ...validUpdate, session_date: "2026-4-1" }).success).toBe(false);
  });

  it("rejects name over 200 characters", () => {
    const result = updateSessionSchema.safeParse({ ...validUpdate, name: "A".repeat(201) });
    expect(result.success).toBe(false);
  });
});

// ── createGameSchema ──────────────────────────────────────────────

describe("createGameSchema", () => {
  const validGame = {
    program_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "vs Rival High",
    created_by: "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
  };

  it("accepts valid game with required fields only", () => {
    const result = createGameSchema.safeParse(validGame);
    expect(result.success).toBe(true);
  });

  it("accepts valid game with all optional fields", () => {
    const result = createGameSchema.safeParse({
      ...validGame,
      opponent: "Rival High",
      team_level: "Varsity",
      game_date: "2026-05-10",
      game_time: "14:30",
      location: "Home Field",
      season_id: "c1b2c3d4-e5f6-7890-abcd-ef1234567890",
      notes: "Bring extra bats",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createGameSchema.safeParse({ ...validGame, name: "" }).success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    expect(createGameSchema.safeParse({ ...validGame, name: "   " }).success).toBe(false);
  });

  it("trims name", () => {
    const result = createGameSchema.safeParse({ ...validGame, name: "  vs Rival  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("vs Rival");
  });

  it("rejects invalid program_id", () => {
    expect(createGameSchema.safeParse({ ...validGame, program_id: "not-uuid" }).success).toBe(false);
  });

  it("rejects invalid created_by", () => {
    expect(createGameSchema.safeParse({ ...validGame, created_by: "not-uuid" }).success).toBe(false);
  });

  it("rejects invalid date format", () => {
    expect(createGameSchema.safeParse({ ...validGame, game_date: "05/10/2026" }).success).toBe(false);
    expect(createGameSchema.safeParse({ ...validGame, game_date: "2026-5-10" }).success).toBe(false);
  });

  it("rejects invalid time format", () => {
    expect(createGameSchema.safeParse({ ...validGame, game_time: "2:30 PM" }).success).toBe(false);
    expect(createGameSchema.safeParse({ ...validGame, game_time: "2:30" }).success).toBe(false);
  });

  it("rejects invalid season_id", () => {
    expect(createGameSchema.safeParse({ ...validGame, season_id: "not-uuid" }).success).toBe(false);
  });

  it("rejects name over 200 characters", () => {
    expect(createGameSchema.safeParse({ ...validGame, name: "A".repeat(201) }).success).toBe(false);
  });

  it("rejects notes over 2000 characters", () => {
    expect(createGameSchema.safeParse({ ...validGame, notes: "A".repeat(2001) }).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(createGameSchema.safeParse({}).success).toBe(false);
    expect(createGameSchema.safeParse({ program_id: validGame.program_id }).success).toBe(false);
  });
});

// ── updateGameSchema ──────────────────────────────────────────────

describe("updateGameSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    const result = updateGameSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid name update", () => {
    const result = updateGameSchema.safeParse({ name: "Updated Game" });
    expect(result.success).toBe(true);
  });

  it("rejects empty string name (min 1 after trim)", () => {
    expect(updateGameSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    expect(updateGameSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("accepts null for nullable optional fields", () => {
    const result = updateGameSchema.safeParse({
      opponent: null,
      team_level: null,
      game_time: null,
      location: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    expect(updateGameSchema.safeParse({ game_date: "05/10/2026" }).success).toBe(false);
  });

  it("rejects invalid time format", () => {
    expect(updateGameSchema.safeParse({ game_time: "2:30 PM" }).success).toBe(false);
  });

  it("accepts valid status", () => {
    const result = updateGameSchema.safeParse({ status: "completed" });
    expect(result.success).toBe(true);
  });

  it("rejects status over 50 characters", () => {
    expect(updateGameSchema.safeParse({ status: "A".repeat(51) }).success).toBe(false);
  });
});

// ── createPracticeSchema ──────────────────────────────────────────

describe("createPracticeSchema", () => {
  const validPractice = {
    program_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    practice_date: "2026-05-12",
  };

  it("accepts valid practice with required fields only", () => {
    const result = createPracticeSchema.safeParse(validPractice);
    expect(result.success).toBe(true);
  });

  it("accepts valid practice with all optional fields", () => {
    const result = createPracticeSchema.safeParse({
      ...validPractice,
      team_level: "Varsity",
      title: "Infield Practice",
      notes: "Focus on double plays",
      shared_with_players: true,
      created_by: "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid program_id", () => {
    expect(createPracticeSchema.safeParse({ ...validPractice, program_id: "bad" }).success).toBe(false);
  });

  it("rejects invalid date format", () => {
    expect(createPracticeSchema.safeParse({ ...validPractice, practice_date: "05/12/2026" }).success).toBe(false);
  });

  it("rejects missing practice_date", () => {
    expect(createPracticeSchema.safeParse({ program_id: validPractice.program_id }).success).toBe(false);
  });

  it("accepts null team_level and notes", () => {
    const result = createPracticeSchema.safeParse({ ...validPractice, team_level: null, notes: null });
    expect(result.success).toBe(true);
  });

  it("rejects title over 200 characters", () => {
    expect(createPracticeSchema.safeParse({ ...validPractice, title: "A".repeat(201) }).success).toBe(false);
  });

  it("rejects notes over 2000 characters", () => {
    expect(createPracticeSchema.safeParse({ ...validPractice, notes: "A".repeat(2001) }).success).toBe(false);
  });

  it("rejects invalid created_by", () => {
    expect(createPracticeSchema.safeParse({ ...validPractice, created_by: "not-uuid" }).success).toBe(false);
  });
});

// ── updatePracticeSchema ──────────────────────────────────────────

describe("updatePracticeSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    const result = updatePracticeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid date update", () => {
    const result = updatePracticeSchema.safeParse({ practice_date: "2026-06-01" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    expect(updatePracticeSchema.safeParse({ practice_date: "06/01/2026" }).success).toBe(false);
  });

  it("rejects empty title (min 1 after trim)", () => {
    expect(updatePracticeSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects whitespace-only title", () => {
    expect(updatePracticeSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("accepts null for nullable optional fields", () => {
    const result = updatePracticeSchema.safeParse({ team_level: null, notes: null });
    expect(result.success).toBe(true);
  });

  it("accepts boolean shared_with_players", () => {
    const result = updatePracticeSchema.safeParse({ shared_with_players: false });
    expect(result.success).toBe(true);
  });
});

// ── createPracticeBlockSchema ─────────────────────────────────────

describe("createPracticeBlockSchema", () => {
  const validBlock = {
    practice_plan_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    start_time: "09:00",
    end_time: "09:30",
    activity_name: "Warm-up Drills",
  };

  it("accepts valid block with required fields only", () => {
    const result = createPracticeBlockSchema.safeParse(validBlock);
    expect(result.success).toBe(true);
  });

  it("accepts valid block with all optional fields", () => {
    const result = createPracticeBlockSchema.safeParse({
      ...validBlock,
      player_group: "Infielders",
      assigned_coach_id: "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
      notes: "Focus on fundamentals",
      sort_order: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid practice_plan_id", () => {
    expect(createPracticeBlockSchema.safeParse({ ...validBlock, practice_plan_id: "bad" }).success).toBe(false);
  });

  it("rejects invalid start_time format", () => {
    expect(createPracticeBlockSchema.safeParse({ ...validBlock, start_time: "9:00" }).success).toBe(false);
    expect(createPracticeBlockSchema.safeParse({ ...validBlock, start_time: "9:00 AM" }).success).toBe(false);
  });

  it("rejects invalid end_time format", () => {
    expect(createPracticeBlockSchema.safeParse({ ...validBlock, end_time: "9:30" }).success).toBe(false);
  });

  it("rejects empty activity_name", () => {
    expect(createPracticeBlockSchema.safeParse({ ...validBlock, activity_name: "" }).success).toBe(false);
  });

  it("rejects whitespace-only activity_name", () => {
    expect(createPracticeBlockSchema.safeParse({ ...validBlock, activity_name: "   " }).success).toBe(false);
  });

  it("trims activity_name", () => {
    const result = createPracticeBlockSchema.safeParse({ ...validBlock, activity_name: "  Drills  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.activity_name).toBe("Drills");
  });

  it("rejects activity_name over 200 characters", () => {
    expect(createPracticeBlockSchema.safeParse({ ...validBlock, activity_name: "A".repeat(201) }).success).toBe(false);
  });

  it("accepts null for nullable optional fields", () => {
    const result = createPracticeBlockSchema.safeParse({ ...validBlock, player_group: null, assigned_coach_id: null, notes: null });
    expect(result.success).toBe(true);
  });

  it("rejects invalid assigned_coach_id", () => {
    expect(createPracticeBlockSchema.safeParse({ ...validBlock, assigned_coach_id: "not-uuid" }).success).toBe(false);
  });

  it("rejects negative sort_order", () => {
    expect(createPracticeBlockSchema.safeParse({ ...validBlock, sort_order: -1 }).success).toBe(false);
  });

  it("rejects sort_order over 999", () => {
    expect(createPracticeBlockSchema.safeParse({ ...validBlock, sort_order: 1000 }).success).toBe(false);
  });

  it("rejects non-integer sort_order", () => {
    expect(createPracticeBlockSchema.safeParse({ ...validBlock, sort_order: 1.5 }).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(createPracticeBlockSchema.safeParse({}).success).toBe(false);
    expect(createPracticeBlockSchema.safeParse({ practice_plan_id: validBlock.practice_plan_id }).success).toBe(false);
  });
});

// ── updatePlayerProfileSchema ─────────────────────────────────────

describe("updatePlayerProfileSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    const result = updatePlayerProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid name update", () => {
    const result = updatePlayerProfileSchema.safeParse({ first_name: "Jane", last_name: "Doe" });
    expect(result.success).toBe(true);
  });

  it("rejects empty first_name (min 1 after trim)", () => {
    expect(updatePlayerProfileSchema.safeParse({ first_name: "" }).success).toBe(false);
  });

  it("rejects whitespace-only first_name", () => {
    expect(updatePlayerProfileSchema.safeParse({ first_name: "   " }).success).toBe(false);
  });

  it("trims names", () => {
    const result = updatePlayerProfileSchema.safeParse({ first_name: "  Jane  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.first_name).toBe("Jane");
  });

  it("accepts null for nullable fields", () => {
    const result = updatePlayerProfileSchema.safeParse({
      grade: null,
      bats: null,
      throws: null,
      photo_url: null,
      player_number: null,
      graduation_year: null,
      height: null,
      weight: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects grade out of range", () => {
    expect(updatePlayerProfileSchema.safeParse({ grade: 0 }).success).toBe(false);
    expect(updatePlayerProfileSchema.safeParse({ grade: 17 }).success).toBe(false);
  });

  it("rejects non-integer grade", () => {
    expect(updatePlayerProfileSchema.safeParse({ grade: 10.5 }).success).toBe(false);
  });

  it("rejects invalid bats value", () => {
    expect(updatePlayerProfileSchema.safeParse({ bats: "X" }).success).toBe(false);
  });

  it("rejects invalid throws value", () => {
    expect(updatePlayerProfileSchema.safeParse({ throws: "S" }).success).toBe(false);
  });

  it("accepts valid photo_url", () => {
    const result = updatePlayerProfileSchema.safeParse({ photo_url: "https://example.com/photo.jpg" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid photo_url", () => {
    expect(updatePlayerProfileSchema.safeParse({ photo_url: "not-a-url" }).success).toBe(false);
  });

  it("rejects player_number out of range", () => {
    expect(updatePlayerProfileSchema.safeParse({ player_number: -1 }).success).toBe(false);
    expect(updatePlayerProfileSchema.safeParse({ player_number: 1000 }).success).toBe(false);
  });

  it("accepts valid player_number at boundaries", () => {
    expect(updatePlayerProfileSchema.safeParse({ player_number: 0 }).success).toBe(true);
    expect(updatePlayerProfileSchema.safeParse({ player_number: 999 }).success).toBe(true);
  });

  it("rejects graduation_year out of range", () => {
    expect(updatePlayerProfileSchema.safeParse({ graduation_year: 1999 }).success).toBe(false);
    expect(updatePlayerProfileSchema.safeParse({ graduation_year: 2101 }).success).toBe(false);
  });

  it("accepts valid graduation_year at boundaries", () => {
    expect(updatePlayerProfileSchema.safeParse({ graduation_year: 2000 }).success).toBe(true);
    expect(updatePlayerProfileSchema.safeParse({ graduation_year: 2100 }).success).toBe(true);
  });

  it("rejects weight out of range", () => {
    expect(updatePlayerProfileSchema.safeParse({ weight: -1 }).success).toBe(false);
    expect(updatePlayerProfileSchema.safeParse({ weight: 1001 }).success).toBe(false);
  });

  it("rejects height over 20 characters", () => {
    expect(updatePlayerProfileSchema.safeParse({ height: "A".repeat(21) }).success).toBe(false);
  });

  it("rejects unknown fields (strict mode)", () => {
    expect(updatePlayerProfileSchema.safeParse({ unknown_field: "value" }).success).toBe(false);
  });

  it("rejects more than 10 positions", () => {
    const positions = Array.from({ length: 11 }, (_, i) => `P${i}`);
    expect(updatePlayerProfileSchema.safeParse({ positions }).success).toBe(false);
  });
});

// ── addCoachSchema ────────────────────────────────────────────────

describe("addCoachSchema", () => {
  const validCoach = {
    programId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    email: "coach@example.com",
    color: "#FF5733",
  };

  it("accepts valid coach data", () => {
    const result = addCoachSchema.safeParse(validCoach);
    expect(result.success).toBe(true);
  });

  it("accepts coach with fullName", () => {
    const result = addCoachSchema.safeParse({ ...validCoach, fullName: "John Smith" });
    expect(result.success).toBe(true);
  });

  it("defaults fullName to empty string", () => {
    const result = addCoachSchema.safeParse(validCoach);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullName).toBe("");
  });

  it("rejects invalid programId", () => {
    expect(addCoachSchema.safeParse({ ...validCoach, programId: "bad" }).success).toBe(false);
  });

  it("rejects empty email", () => {
    expect(addCoachSchema.safeParse({ ...validCoach, email: "" }).success).toBe(false);
  });

  it("rejects invalid email format", () => {
    expect(addCoachSchema.safeParse({ ...validCoach, email: "not-an-email" }).success).toBe(false);
  });

  it("trims email", () => {
    const result = addCoachSchema.safeParse({ ...validCoach, email: "  coach@example.com  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("coach@example.com");
  });

  it("rejects empty color", () => {
    expect(addCoachSchema.safeParse({ ...validCoach, color: "" }).success).toBe(false);
  });

  it("rejects fullName over 200 characters", () => {
    expect(addCoachSchema.safeParse({ ...validCoach, fullName: "A".repeat(201) }).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(addCoachSchema.safeParse({}).success).toBe(false);
    expect(addCoachSchema.safeParse({ programId: validCoach.programId }).success).toBe(false);
  });
});

// ── createSeasonSchema ────────────────────────────────────────────

describe("createSeasonSchema", () => {
  const validSeason = {
    program_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "Spring 2026",
    is_active: true,
  };

  it("accepts valid season data", () => {
    const result = createSeasonSchema.safeParse(validSeason);
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createSeasonSchema.safeParse({ ...validSeason, name: "" }).success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    expect(createSeasonSchema.safeParse({ ...validSeason, name: "   " }).success).toBe(false);
  });

  it("trims name", () => {
    const result = createSeasonSchema.safeParse({ ...validSeason, name: "  Spring 2026  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Spring 2026");
  });

  it("rejects name over 200 characters", () => {
    expect(createSeasonSchema.safeParse({ ...validSeason, name: "A".repeat(201) }).success).toBe(false);
  });

  it("rejects invalid program_id", () => {
    expect(createSeasonSchema.safeParse({ ...validSeason, program_id: "not-uuid" }).success).toBe(false);
  });

  it("requires is_active boolean", () => {
    expect(createSeasonSchema.safeParse({ ...validSeason, is_active: "yes" }).success).toBe(false);
  });

  it("accepts is_active false", () => {
    const result = createSeasonSchema.safeParse({ ...validSeason, is_active: false });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(createSeasonSchema.safeParse({}).success).toBe(false);
    expect(createSeasonSchema.safeParse({ program_id: validSeason.program_id, name: "Test" }).success).toBe(false);
  });
});

// ── createProgramSchema ───────────────────────────────────────────

describe("createProgramSchema", () => {
  const validProgram = {
    name: "Varsity Baseball",
    sport: "baseball",
    organizationId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    createdBy: "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
  };

  it("accepts valid program data", () => {
    const result = createProgramSchema.safeParse(validProgram);
    expect(result.success).toBe(true);
  });

  it("accepts program with schoolName", () => {
    const result = createProgramSchema.safeParse({ ...validProgram, schoolName: "Lincoln High" });
    expect(result.success).toBe(true);
  });

  it("defaults schoolName to empty string", () => {
    const result = createProgramSchema.safeParse(validProgram);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.schoolName).toBe("");
  });

  it("rejects empty name", () => {
    expect(createProgramSchema.safeParse({ ...validProgram, name: "" }).success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    expect(createProgramSchema.safeParse({ ...validProgram, name: "   " }).success).toBe(false);
  });

  it("trims name", () => {
    const result = createProgramSchema.safeParse({ ...validProgram, name: "  Varsity  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Varsity");
  });

  it("rejects name over 200 characters", () => {
    expect(createProgramSchema.safeParse({ ...validProgram, name: "A".repeat(201) }).success).toBe(false);
  });

  it("rejects empty sport", () => {
    expect(createProgramSchema.safeParse({ ...validProgram, sport: "" }).success).toBe(false);
  });

  it("rejects invalid organizationId", () => {
    expect(createProgramSchema.safeParse({ ...validProgram, organizationId: "bad" }).success).toBe(false);
  });

  it("rejects invalid createdBy", () => {
    expect(createProgramSchema.safeParse({ ...validProgram, createdBy: "bad" }).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(createProgramSchema.safeParse({}).success).toBe(false);
    expect(createProgramSchema.safeParse({ name: "Test" }).success).toBe(false);
  });
});

// ── createOrganizationSchema ──────────────────────────────────────

describe("createOrganizationSchema", () => {
  const validOrg = {
    name: "Metro Youth Athletics",
    createdBy: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  };

  it("accepts valid organization data", () => {
    const result = createOrganizationSchema.safeParse(validOrg);
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createOrganizationSchema.safeParse({ ...validOrg, name: "" }).success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    expect(createOrganizationSchema.safeParse({ ...validOrg, name: "   " }).success).toBe(false);
  });

  it("trims name", () => {
    const result = createOrganizationSchema.safeParse({ ...validOrg, name: "  Metro  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Metro");
  });

  it("rejects name over 200 characters", () => {
    expect(createOrganizationSchema.safeParse({ ...validOrg, name: "A".repeat(201) }).success).toBe(false);
  });

  it("rejects invalid createdBy", () => {
    expect(createOrganizationSchema.safeParse({ ...validOrg, createdBy: "not-uuid" }).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(createOrganizationSchema.safeParse({}).success).toBe(false);
    expect(createOrganizationSchema.safeParse({ name: "Test" }).success).toBe(false);
  });
});
