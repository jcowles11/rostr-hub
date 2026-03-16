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
