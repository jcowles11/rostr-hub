import { z } from "zod";

/**
 * Centralized Zod schemas for every server-action mutation path that
 * touches user-entered data.
 *
 * Why one file:
 *   - One spot to audit "what bounds do we enforce" — the answer is here,
 *     not scattered across 12 actions.
 *   - Schemas are reused on the AI plan apply path (it accepts blocks
 *     from the model, which is just another untrusted source).
 *
 * All schemas are designed to be permissive on shape (accept extra
 * fields, coerce stringly numbers when reasonable) and strict on bounds.
 * The output type is exactly what the action layer hands to Supabase.
 *
 * Pattern for callers:
 *   const r = ParsePlayerInput.safeParse(input);
 *   if (!r.success) return { error: firstZodError(r.error) };
 *   const safeInput = r.data;
 *
 * `firstZodError` returns a single human-readable line — coaches don't
 * need to see a JSON dump of issues. The other issues are dropped.
 */

// ── Helpers ──────────────────────────────────────────────────────

const NameField = z
  .string()
  .trim()
  .min(1, "required")
  .max(80, "too long (max 80 chars)");

// Names with stricter rules — first/last on a player row.
// (No unicode-class regex — keeps the schema portable across TS targets
// and we'd false-reject legitimate non-ASCII names anyway. The trim +
// length cap on NameField is the real defense against malformed input.)
const PersonName = NameField;

// Optional non-empty string. Empty/whitespace becomes null.
const OptText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `too long (max ${max} chars)`)
    .nullable()
    .optional()
    .transform((v) => (v == null || v.length === 0 ? null : v));

const HttpUrl = z
  .string()
  .trim()
  .max(500, "URL too long")
  .url("must be a valid URL")
  .refine((u) => /^https?:\/\//i.test(u), "must start with http(s)://");

const OptHttpUrl = z
  .union([z.literal(""), HttpUrl])
  .nullable()
  .optional()
  .transform((v) => (v == null || v === "" ? null : v));

// Bats/throws — single capital letter.
const Bats = z
  .enum(["L", "R", "S"])
  .nullable()
  .optional()
  .transform((v) => v ?? null);
const Throws = z
  .enum(["L", "R"])
  .nullable()
  .optional()
  .transform((v) => v ?? null);

// Grade level (HS): 9–12. Allow null.
const Grade = z
  .number()
  .int()
  .min(9, "grade must be 9-12")
  .max(12, "grade must be 9-12")
  .nullable()
  .optional()
  .transform((v) => v ?? null);

// Jersey number: 0–999. Allow null.
const PlayerNumber = z
  .number()
  .int()
  .min(0, "jersey must be 0-999")
  .max(999, "jersey must be 0-999")
  .nullable()
  .optional()
  .transform((v) => v ?? null);

// Position codes — known baseball codes only. Caller can pre-filter to
// drop unknowns + warn (the CSV import does this) or pass-through.
export const VALID_POSITION_CODES = [
  "P", "C",
  "1B", "2B", "3B", "SS",
  "LF", "CF", "RF", "OF",
  "DH", "UT",
] as const;

const PositionList = z
  .array(z.string().trim().toUpperCase().max(3))
  .max(20, "too many positions")
  .default([])
  .transform((arr) =>
    // Dedupe + drop empties; keep unknowns (warn upstream — UI handles).
    Array.from(new Set(arr.filter((p) => p.length > 0))),
  );

// Year for commitment / class year. Spans recent past + 6 yrs out.
const FutureYear = z
  .number()
  .int()
  .min(1990, "year out of range")
  .max(new Date().getFullYear() + 8, "year out of range")
  .nullable()
  .optional()
  .transform((v) => v ?? null);

// ── Player CRUD ─────────────────────────────────────────────────

export const CreatePlayerInput = z
  .object({
    firstName: PersonName,
    lastName: PersonName,
    grade: Grade,
    positions: PositionList,
    bats: Bats,
    throws: Throws,
    playerNumber: PlayerNumber,
  })
  .strict();
export type CreatePlayerInput = z.input<typeof CreatePlayerInput>;

export const UpdatePlayerInput = z
  .object({
    id: z.string().uuid("player id must be a UUID"),
    firstName: PersonName,
    lastName: PersonName,
    grade: Grade,
    positions: PositionList,
    bats: Bats,
    throws: Throws,
    playerNumber: PlayerNumber,
  })
  .strict();
export type UpdatePlayerInput = z.input<typeof UpdatePlayerInput>;

export const PlayerAvailabilityInput = z
  .object({
    playerId: z.string().uuid(),
    status: z.enum(["ok", "questionable", "out"]),
    note: OptText(280),
  })
  .strict();
export type PlayerAvailabilityInput = z.input<typeof PlayerAvailabilityInput>;

// Bulk player import (post-CSV-parse). Names trimmed, jersey clamped.
// Per-row validation; the action splits valid/skipped before insert.
export const BulkPlayerInput = z.object({
  firstName: PersonName,
  lastName: PersonName,
  grade: Grade,
  positions: PositionList.optional().default([]),
  bats: Bats,
  throws: Throws,
  playerNumber: PlayerNumber,
});
export type BulkPlayerInput = z.input<typeof BulkPlayerInput>;

// ── Notes ───────────────────────────────────────────────────────

// Hard cap so a copy-paste doesn't blow up the AI context (we feed
// recent notes into the system prompt) and to keep the DB sane.
export const CreateNoteInput = z
  .object({
    playerId: z.string().uuid(),
    content: z
      .string()
      .trim()
      .min(1, "note can't be empty")
      .max(2000, "note too long (max 2000 chars)"),
  })
  .strict();
export type CreateNoteInput = z.input<typeof CreateNoteInput>;

// ── Tryout / evaluation scoring ─────────────────────────────────

/**
 * Tryout score bounds:
 *   - lower_better stations (e.g. 60 yard dash): 0 → 600 sec
 *   - higher_better stations (exit velo, jump): 0 → 1000 (catches typo'd 9999)
 *   - rating: 1 → 5
 *
 * The action validates against both the input value AND the station's
 * scoreType. We can't introspect the station here without extra fetches,
 * so the schema enforces the union range; the action does the per-type
 * check after fetching the station.
 */
export const RecordScoreInput = z
  .object({
    tryoutId: z.string().uuid(),
    stationId: z.string().uuid(),
    playerId: z.string().uuid(),
    value: z
      .number()
      .finite("must be a number")
      .min(0, "score can't be negative")
      .max(1000, "score out of range"),
    flag: z.enum(["attention", "standout"]).nullable().optional(),
    note: OptText(280),
  })
  .strict();
export type RecordScoreInput = z.input<typeof RecordScoreInput>;

/**
 * Per-station-type bound check. Call after RecordScoreInput passes,
 * once you've fetched the station's scoreType from the DB.
 */
export function validateScoreForStationType(
  value: number,
  scoreType: "lower_better" | "higher_better" | "rating",
): { ok: true } | { ok: false; error: string } {
  if (scoreType === "rating") {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return { ok: false, error: "rating must be an integer 1-5" };
    }
  } else if (scoreType === "lower_better") {
    if (value < 0 || value > 600) {
      return { ok: false, error: "time must be 0-600 seconds" };
    }
  } else {
    // higher_better: distance / velocity / power
    if (value < 0 || value > 1000) {
      return { ok: false, error: "value out of range" };
    }
  }
  return { ok: true };
}

// ── Tryout structure ────────────────────────────────────────────

export const CreateStationInput = z
  .object({
    tryoutId: z.string().uuid(),
    name: z.string().trim().min(1, "station name required").max(80),
    shortCode: z.string().trim().min(1, "short code required").max(10),
    unit: OptText(20),
    scoreType: z.enum(["lower_better", "higher_better", "rating"]),
    assignedCoachId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  })
  .strict();
export type CreateStationInput = z.input<typeof CreateStationInput>;

export const CreateTryoutInput = z
  .object({
    name: z.string().trim().min(1, "tryout name required").max(120),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "start date must be YYYY-MM-DD"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "end date must be YYYY-MM-DD")
      .optional(),
    notes: OptText(2000),
    metrics: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          shortCode: z.string().trim().min(1).max(10),
          unit: z.string().trim().max(20).nullable().optional(),
          scoreType: z.enum(["lower_better", "higher_better", "rating"]),
        }),
      )
      .max(50, "too many stations")
      .optional(),
  })
  .strict();
export type CreateTryoutInput = z.input<typeof CreateTryoutInput>;

// ── Player profile media + announcements ────────────────────────

export const UpdatePlayerProfileMediaInput = z
  .object({
    playerId: z.string().uuid(),
    avatarUrl: OptHttpUrl,
    headerUrl: OptHttpUrl,
    highlightVideoUrl: OptHttpUrl,
    commitmentStatus: z
      .enum(["uncommitted", "committed", "decommitted", "decided"])
      .nullable()
      .optional(),
    commitmentSchool: OptText(120),
    commitmentYear: FutureYear,
    commitmentNote: OptText(500),
  })
  .strict();
export type UpdatePlayerProfileMediaInput = z.input<typeof UpdatePlayerProfileMediaInput>;

export const CreatePlayerAnnouncementInput = z
  .object({
    playerId: z.string().uuid(),
    kind: z.enum([
      "commitment",
      "milestone",
      "update",
      "video",
      "achievement",
      "offer",
    ]),
    title: z.string().trim().min(1, "title required").max(200),
    body: OptText(4000),
    imageUrl: OptHttpUrl,
    linkUrl: OptHttpUrl,
    pinned: z.boolean().optional().default(false),
  })
  .strict();
export type CreatePlayerAnnouncementInput = z.input<typeof CreatePlayerAnnouncementInput>;

// ── AI feedback ─────────────────────────────────────────────────

export const RecordAIPlanFeedbackInput = z
  .object({
    generationId: z.string().uuid(),
    rating: z.union([z.literal(1), z.literal(-1)]),
    note: OptText(500),
  })
  .strict();
export type RecordAIPlanFeedbackInput = z.input<typeof RecordAIPlanFeedbackInput>;

// ── Error formatting ────────────────────────────────────────────

/**
 * Pull the first user-friendly issue out of a ZodError. Coaches don't
 * need to see a JSON dump; they need ONE line that says what's wrong.
 *
 * Format: `<path>: <message>` (e.g. "playerNumber: jersey must be 0-999")
 * Path falls through to "input" if Zod issued a top-level error.
 */
export function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid input.";
  const path = issue.path
    .filter((p) => typeof p === "string" || typeof p === "number")
    .join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
