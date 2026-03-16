/**
 * Zod Validation Schemas
 *
 * Centralizes validation for all critical mutation workflows.
 * These schemas are the single source of truth for data integrity
 * before any write hits Supabase.
 *
 * Covers:
 * - Player creation/edit
 * - Tryout session creation/edit
 * - Metric creation/edit
 * - Score entry (evaluation)
 * - Game creation/update
 * - Practice plan creation/update
 * - Practice block creation
 */
import { z } from "zod";

// ── Player ─────────────────────────────────────────────────────────

export const createPlayerSchema = z.object({
  program_id: z.string().uuid("Invalid program ID"),
  first_name: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(100, "First name must be under 100 characters"),
  last_name: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(100, "Last name must be under 100 characters"),
  grade: z
    .number()
    .int("Grade must be a whole number")
    .min(1, "Grade must be at least 1")
    .max(16, "Grade must be 16 or less")
    .nullable(),
  positions: z.array(z.string().min(1).max(10)).max(10, "Maximum 10 positions"),
  bats: z.enum(["R", "L", "S"]).nullable(),
  throws: z.enum(["R", "L"]).nullable(),
});

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;

// ── Tryout Session ─────────────────────────────────────────────────

export const createSessionSchema = z.object({
  program_id: z.string().uuid("Invalid program ID"),
  name: z
    .string()
    .trim()
    .min(1, "Session name is required")
    .max(200, "Session name must be under 200 characters"),
  session_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updateSessionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Session name is required")
    .max(200, "Session name must be under 200 characters"),
  session_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

// ── Metric ─────────────────────────────────────────────────────────

export const createMetricSchema = z
  .object({
    program_id: z.string().uuid("Invalid program ID"),
    name: z
      .string()
      .trim()
      .min(1, "Metric name is required")
      .max(200, "Metric name must be under 200 characters"),
    unit: z.string().max(50, "Unit must be under 50 characters").default(""),
    category: z.string().min(1, "Category is required"),
    metric_type: z.enum(["timed", "measured", "rated"], {
      errorMap: () => ({ message: "Must be timed, measured, or rated" }),
    }),
    aggregation: z.enum(["best", "average", "latest"], {
      errorMap: () => ({ message: "Must be best, average, or latest" }),
    }),
    max_attempts: z
      .number()
      .int("Must be a whole number")
      .min(1, "At least 1 attempt")
      .max(10, "Maximum 10 attempts"),
    sort_order: z.number().int().min(0).default(0),
    min_value: z.number().nullable().default(null),
    max_value: z.number().nullable().default(null),
  })
  .refine(
    (data) => {
      if (data.min_value !== null && data.max_value !== null) {
        return data.min_value < data.max_value;
      }
      return true;
    },
    { message: "Min value must be less than max value", path: ["min_value"] }
  );

export type CreateMetricInput = z.infer<typeof createMetricSchema>;

// ── Score Entry (Evaluation) ───────────────────────────────────────

export const scoreEntrySchema = z.object({
  program_id: z.string().uuid("Invalid program ID"),
  player_id: z.string().uuid("Invalid player ID"),
  metric_id: z.string().uuid("Invalid metric ID"),
  coach_id: z.string().uuid("Invalid coach ID"),
  session_id: z.string().uuid("Invalid session ID"),
  attempt_number: z
    .number()
    .int("Attempt must be a whole number")
    .min(1, "Attempt must be at least 1")
    .max(10, "Maximum 10 attempts"),
  value: z.number().finite("Value must be a finite number"),
});

export type ScoreEntryInput = z.infer<typeof scoreEntrySchema>;

// ── Game ────────────────────────────────────────────────────────────

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}$/;

export const createGameSchema = z.object({
  program_id: z.string().uuid("Invalid program ID"),
  name: z
    .string()
    .trim()
    .min(1, "Game name is required")
    .max(200, "Game name must be under 200 characters"),
  created_by: z.string().uuid("Invalid user ID"),
  opponent: z
    .string()
    .trim()
    .max(200, "Opponent must be under 200 characters")
    .optional(),
  team_level: z
    .string()
    .trim()
    .max(100, "Team level must be under 100 characters")
    .optional(),
  game_date: z
    .string()
    .regex(dateRegex, "Date must be in YYYY-MM-DD format")
    .optional(),
  game_time: z
    .string()
    .regex(timeRegex, "Time must be in HH:MM format")
    .optional(),
  location: z
    .string()
    .trim()
    .max(300, "Location must be under 300 characters")
    .optional(),
  season_id: z.string().uuid("Invalid season ID").optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be under 2000 characters")
    .optional(),
});

export type CreateGameInput = z.infer<typeof createGameSchema>;

export const updateGameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Game name is required")
    .max(200, "Game name must be under 200 characters")
    .optional(),
  opponent: z
    .string()
    .trim()
    .max(200, "Opponent must be under 200 characters")
    .nullable()
    .optional(),
  team_level: z
    .string()
    .trim()
    .max(100, "Team level must be under 100 characters")
    .nullable()
    .optional(),
  game_date: z
    .string()
    .regex(dateRegex, "Date must be in YYYY-MM-DD format")
    .optional(),
  game_time: z
    .string()
    .regex(timeRegex, "Time must be in HH:MM format")
    .nullable()
    .optional(),
  location: z
    .string()
    .trim()
    .max(300, "Location must be under 300 characters")
    .nullable()
    .optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be under 2000 characters")
    .nullable()
    .optional(),
  status: z
    .string()
    .trim()
    .min(1, "Status is required")
    .max(50, "Status must be under 50 characters")
    .optional(),
});

export type UpdateGameInput = z.infer<typeof updateGameSchema>;

// ── Practice Plan ───────────────────────────────────────────────────

export const createPracticeSchema = z.object({
  program_id: z.string().uuid("Invalid program ID"),
  practice_date: z
    .string()
    .regex(dateRegex, "Date must be in YYYY-MM-DD format"),
  team_level: z
    .string()
    .trim()
    .max(100, "Team level must be under 100 characters")
    .nullable()
    .optional(),
  title: z
    .string()
    .trim()
    .max(200, "Title must be under 200 characters")
    .optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be under 2000 characters")
    .nullable()
    .optional(),
  shared_with_players: z.boolean().optional(),
  created_by: z.string().uuid("Invalid user ID").optional(),
});

export type CreatePracticeInput = z.infer<typeof createPracticeSchema>;

export const updatePracticeSchema = z.object({
  practice_date: z
    .string()
    .regex(dateRegex, "Date must be in YYYY-MM-DD format")
    .optional(),
  team_level: z
    .string()
    .trim()
    .max(100, "Team level must be under 100 characters")
    .nullable()
    .optional(),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be under 200 characters")
    .optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be under 2000 characters")
    .nullable()
    .optional(),
  shared_with_players: z.boolean().optional(),
});

export type UpdatePracticeInput = z.infer<typeof updatePracticeSchema>;

// ── Practice Block ──────────────────────────────────────────────────

export const createPracticeBlockSchema = z.object({
  practice_plan_id: z.string().uuid("Invalid practice plan ID"),
  start_time: z
    .string()
    .regex(timeRegex, "Start time must be in HH:MM format"),
  end_time: z
    .string()
    .regex(timeRegex, "End time must be in HH:MM format"),
  activity_name: z
    .string()
    .trim()
    .min(1, "Activity name is required")
    .max(200, "Activity name must be under 200 characters"),
  player_group: z
    .string()
    .trim()
    .max(200, "Player group must be under 200 characters")
    .nullable()
    .optional(),
  assigned_coach_id: z
    .string()
    .uuid("Invalid coach ID")
    .nullable()
    .optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be under 2000 characters")
    .nullable()
    .optional(),
  sort_order: z
    .number()
    .int("Sort order must be a whole number")
    .min(0, "Sort order must be non-negative")
    .max(999, "Sort order must be under 1000")
    .optional(),
});

export type CreatePracticeBlockInput = z.infer<typeof createPracticeBlockSchema>;

// ── Player Profile Update ─────────────────────────────────────────

export const updatePlayerProfileSchema = z
  .object({
    first_name: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(100, "First name must be under 100 characters")
      .optional(),
    last_name: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(100, "Last name must be under 100 characters")
      .optional(),
    grade: z
      .number()
      .int("Grade must be a whole number")
      .min(1, "Grade must be at least 1")
      .max(16, "Grade must be 16 or less")
      .nullable()
      .optional(),
    positions: z
      .array(z.string().min(1).max(10))
      .max(10, "Maximum 10 positions")
      .optional(),
    bats: z.enum(["R", "L", "S"]).nullable().optional(),
    throws: z.enum(["R", "L"]).nullable().optional(),
    photo_url: z.string().url("Invalid photo URL").nullable().optional(),
    player_number: z
      .number()
      .int("Player number must be a whole number")
      .min(0, "Player number must be non-negative")
      .max(999, "Player number must be 999 or less")
      .nullable()
      .optional(),
    graduation_year: z
      .number()
      .int("Graduation year must be a whole number")
      .min(2000, "Graduation year must be 2000 or later")
      .max(2100, "Graduation year must be 2100 or earlier")
      .nullable()
      .optional(),
    height: z.string().max(20, "Height must be under 20 characters").nullable().optional(),
    weight: z
      .number()
      .min(0, "Weight must be non-negative")
      .max(1000, "Weight must be 1000 or less")
      .nullable()
      .optional(),
  })
  .strict();

export type UpdatePlayerProfileInput = z.infer<typeof updatePlayerProfileSchema>;

// ── Coach ─────────────────────────────────────────────────────────

export const addCoachSchema = z.object({
  programId: z.string().uuid("Invalid program ID"),
  fullName: z
    .string()
    .trim()
    .max(200, "Name must be under 200 characters")
    .default(""),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Invalid email address"),
  color: z.string().min(1, "Color is required"),
});

export type AddCoachInput = z.infer<typeof addCoachSchema>;

// ── Season ────────────────────────────────────────────────────────

export const createSeasonSchema = z.object({
  program_id: z.string().uuid("Invalid program ID"),
  name: z
    .string()
    .trim()
    .min(1, "Season name is required")
    .max(200, "Season name must be under 200 characters"),
  is_active: z.boolean(),
});

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;

// ── Program ───────────────────────────────────────────────────────

export const createProgramSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Program name is required")
    .max(200, "Program name must be under 200 characters"),
  sport: z.string().min(1, "Sport is required"),
  organizationId: z.string().uuid("Invalid organization ID"),
  schoolName: z.string().trim().default(""),
  createdBy: z.string().uuid("Invalid user ID"),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;

// ── Organization ──────────────────────────────────────────────────

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Organization name is required")
    .max(200, "Organization name must be under 200 characters"),
  createdBy: z.string().uuid("Invalid user ID"),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

// ── Metric Bounds ──────────────────────────────────────────────────

export interface MetricBounds {
  min_value: number | null;
  max_value: number | null;
  metric_type: string;
  name: string;
  unit: string;
}

/**
 * Validate a score value against metric-specific bounds.
 * Returns null if valid, or an error message string if invalid.
 *
 * This is separate from the Zod schema because bounds are dynamic
 * (different per metric) and only apply to rated metrics.
 */
export function validateScoreValue(
  value: number,
  bounds: MetricBounds
): string | null {
  if (!Number.isFinite(value)) {
    return "Value must be a valid number";
  }

  // For rated metrics with configured bounds, enforce min/max
  if (bounds.min_value !== null && value < bounds.min_value) {
    return `${bounds.name} minimum is ${bounds.min_value} ${bounds.unit}`.trim();
  }
  if (bounds.max_value !== null && value > bounds.max_value) {
    return `${bounds.name} maximum is ${bounds.max_value} ${bounds.unit}`.trim();
  }

  return null;
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Validate data against a schema and return a friendly result.
 * Use this in components before calling service functions.
 */
export function validate<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Return the first error message for display
  const firstError = result.error.errors[0];
  return { success: false, error: firstError?.message ?? "Validation failed" };
}
