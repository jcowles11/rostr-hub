import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AIPlanProposalBlock } from "@/lib/services/ai-coach";

/**
 * AI plan generation logging + feedback aggregation.
 *
 * Backed by tables in migration 20260315000027:
 *   - ai_plan_generations: input/output of every applied AI plan
 *   - ai_plan_feedback:    coach 👍/👎 with optional note
 *
 * If the migration hasn't been applied yet, every function in this
 * module either returns a structured "not configured" result or
 * silently no-ops — no crash. The pattern mirrors tryouts actions'
 * `isMissingTable` check.
 */

const MIGRATION_PENDING_MSG =
  "AI logging tables not yet applied. Apply migration 20260315000027_ai_plan_logging.sql in Supabase.";

function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "42P01" || /does not exist/i.test(err.message ?? "");
}

// ── Logging ──────────────────────────────────────────────────────

export interface LogGenerationInput {
  programId: string;
  planId: string;
  inputContext: Record<string, unknown>;
  outputBlocks: AIPlanProposalBlock[];
  mode: "append" | "replace" | "discarded";
  fieldConstraint: string | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  createdBy: string | null;
}

/**
 * Insert a row capturing one AI generation + apply. Best-effort: if
 * the migration isn't applied, returns `{ generationId: null }` so the
 * caller can still complete the user-facing action.
 */
export async function logAIGeneration(
  input: LogGenerationInput,
): Promise<{ generationId: string | null; error: string | null }> {
  const supabase = createSupabaseServerClient();
  const totalBlocks = input.outputBlocks.length;
  const totalMinutes = input.outputBlocks
    .filter((b) => b.lane === "main")
    .reduce((s, b) => s + (b.durationMin ?? 0), 0);

  const { data, error } = await supabase
    .from("ai_plan_generations")
    .insert({
      program_id: input.programId,
      plan_id: input.planId,
      input_context: input.inputContext,
      output_blocks: input.outputBlocks,
      mode: input.mode,
      field_constraint: input.fieldConstraint,
      total_blocks: totalBlocks,
      total_minutes: totalMinutes,
      model: input.model,
      tokens_in: input.tokensIn,
      tokens_out: input.tokensOut,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isMissingTable(error)) {
      // Migration pending — non-fatal. The user-facing action still
      // succeeds; we just skip logging this run.
      return { generationId: null, error: MIGRATION_PENDING_MSG };
    }
    return { generationId: null, error: error?.message ?? "Couldn't log generation." };
  }

  return { generationId: data.id, error: null };
}

// ── Feedback ─────────────────────────────────────────────────────

export interface RecordFeedbackInput {
  generationId: string;
  programId: string;
  rating: 1 | -1;
  note: string | null;
  createdBy: string | null;
}

/**
 * Upsert one coach's reaction to a generation. Conflict target is
 * (generation_id, created_by) so a coach flipping their vote updates
 * the same row instead of creating duplicates.
 */
export async function recordAIFeedback(
  input: RecordFeedbackInput,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("ai_plan_feedback")
    .upsert(
      {
        generation_id: input.generationId,
        program_id: input.programId,
        rating: input.rating,
        note: input.note,
        created_by: input.createdBy,
      },
      { onConflict: "generation_id,created_by" },
    );
  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_PENDING_MSG };
    return { error: error.message };
  }
  return { error: null };
}

// ── Aggregation for prompt shaping ───────────────────────────────

export interface FeedbackTrend {
  thumbsUp: number;
  thumbsDown: number;
  /** Most recent down-vote notes (oldest dropped). Trimmed to ~120 chars. */
  recentDownNotes: string[];
  /** Most recent up-vote notes. */
  recentUpNotes: string[];
  /**
   * Categories that have been disliked — each rating row joins back to
   * the generation's output_blocks; we count which categories appeared
   * in down-voted plans more than up-voted ones.
   */
  underperformingCategories: string[];
  /** Same in the up direction. */
  reinforcedCategories: string[];
}

const EMPTY_TREND: FeedbackTrend = {
  thumbsUp: 0,
  thumbsDown: 0,
  recentDownNotes: [],
  recentUpNotes: [],
  underperformingCategories: [],
  reinforcedCategories: [],
};

/**
 * Pull recent feedback for a program and reduce it to a small object
 * the prompt can render. Looks back ~lookbackDays days OR last
 * `maxRows` ratings (whichever is smaller scope).
 *
 * Cheap aggregation — runs once per generation, scoped to one program.
 * Non-fatal if the migration is pending: returns the empty trend.
 */
export async function getRecentAIFeedbackTrend(
  programId: string,
  opts: { lookbackDays?: number; maxRows?: number } = {},
): Promise<FeedbackTrend> {
  const lookbackDays = opts.lookbackDays ?? 90;
  const maxRows = opts.maxRows ?? 30;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createSupabaseServerClient();

  // Pull feedback rows joined with the generation's output_blocks. We
  // do the join in app-land (two queries + map) to avoid relying on a
  // Supabase view for this small result set.
  const { data: feedback, error } = await supabase
    .from("ai_plan_feedback")
    .select("generation_id, rating, note, created_at")
    .eq("program_id", programId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(maxRows);
  if (error || !feedback || feedback.length === 0) {
    // Missing-table errors and empty result both produce the empty trend.
    return EMPTY_TREND;
  }

  const genIds = Array.from(new Set(feedback.map((f) => f.generation_id)));
  const { data: generations } = await supabase
    .from("ai_plan_generations")
    .select("id, output_blocks")
    .in("id", genIds);
  const blocksById = new Map<string, AIPlanProposalBlock[]>();
  for (const g of generations ?? []) {
    if (Array.isArray(g.output_blocks)) {
      blocksById.set(g.id, g.output_blocks as AIPlanProposalBlock[]);
    }
  }

  let thumbsUp = 0;
  let thumbsDown = 0;
  const recentDownNotes: string[] = [];
  const recentUpNotes: string[] = [];
  // Net category votes: +1 per up-voted plan that included the category,
  // -1 per down-voted. Top-N by abs value drives the prompt shaping.
  const catScore = new Map<string, number>();

  for (const f of feedback) {
    if (f.rating === 1) thumbsUp++;
    else if (f.rating === -1) thumbsDown++;

    if (f.note) {
      const trimmed = f.note.trim().slice(0, 120);
      if (trimmed.length > 0) {
        if (f.rating === -1 && recentDownNotes.length < 3) recentDownNotes.push(trimmed);
        if (f.rating === 1 && recentUpNotes.length < 3) recentUpNotes.push(trimmed);
      }
    }

    const blocks = blocksById.get(f.generation_id) ?? [];
    const cats = new Set(blocks.map((b) => b.category));
    for (const c of Array.from(cats)) {
      catScore.set(c, (catScore.get(c) ?? 0) + (f.rating === 1 ? 1 : -1));
    }
  }

  const sortedCats = Array.from(catScore.entries()).sort(
    (a, b) => Math.abs(b[1]) - Math.abs(a[1]),
  );
  const underperformingCategories = sortedCats
    .filter(([, score]) => score <= -2)
    .slice(0, 3)
    .map(([cat]) => cat);
  const reinforcedCategories = sortedCats
    .filter(([, score]) => score >= 2)
    .slice(0, 3)
    .map(([cat]) => cat);

  return {
    thumbsUp,
    thumbsDown,
    recentDownNotes,
    recentUpNotes,
    underperformingCategories,
    reinforcedCategories,
  };
}
