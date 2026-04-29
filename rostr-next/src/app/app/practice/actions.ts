"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isDemoRequest, DEMO_GUARD_MESSAGE } from "@/lib/demo-guard";
import { checkAIRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";
import {
  createPlan,
  updatePlan,
  deletePlan,
  duplicatePlan,
  addBlock,
  updateBlock,
  removeBlock,
  reorderBlocks,
  addCustomDrill,
  deleteDrill,
  appendBlocks,
  replaceBlocks,
  getPlanById,
  getDrillLibrary,
  type FieldConstraint,
  type PlanCategory,
  type PlanLane,
  type PlanStatus,
} from "@/lib/services/practice-plans";
import {
  gatherAICoachContext,
  generatePracticePlan,
  type AIFieldConstraint,
  type AIPlanProposalBlock,
} from "@/lib/services/ai-coach";
import {
  getRecentAIFeedbackTrend,
  logAIGeneration,
  recordAIFeedback,
} from "@/lib/services/ai-feedback";
import {
  RecordAIPlanFeedbackInput as RecordAIPlanFeedbackSchema,
  firstZodError,
} from "@/lib/validation/schemas";

/**
 * Practice plan server actions.
 *
 * Every action verifies a coach exists for the calling user. RLS provides
 * the inner safety net (a coach can't touch another program's plans even
 * if they pass an ID), but the coach guard short-circuits with a friendly
 * error.
 *
 * Revalidates the practice + today surfaces so changes are visible
 * immediately after navigation.
 */

const PRACTICE_PATH = "/app/practice";
const TODAY_PATH = "/app/today";
const SCHEDULE_PATH = "/app/schedule";

function revalidatePractice() {
  revalidatePath(PRACTICE_PATH);
  revalidatePath(TODAY_PATH);
  revalidatePath(SCHEDULE_PATH);
}

// ── Legacy: kept for back-compat with existing /app/practice list flow ──

export interface CreatePracticeInput {
  title: string;
  practiceDate: string; // YYYY-MM-DD
  teamLevel?: string;
  notes?: string;
}

export async function createPracticeAction(
  input: CreatePracticeInput,
): Promise<{ error: string | null; practiceId?: string }> {
  if (!input.title.trim() || !input.practiceDate) {
    return { error: "Title and date are required." };
  }
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("practice_plans")
    .insert({
      program_id: coach.program_id,
      title: input.title.trim(),
      practice_date: input.practiceDate,
      team_level: input.teamLevel || null,
      notes: input.notes?.trim() || null,
      shared_with_players: false,
      created_by: coach.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Couldn't create practice." };

  revalidatePractice();
  return { error: null, practiceId: data.id };
}

export async function deletePracticeAction(practiceId: string): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("practice_plans")
    .delete()
    .eq("id", practiceId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePractice();
  return { error: null };
}

// ── Plan actions (new, for /app/practice planner) ────────────────

export interface CreatePlanInput {
  planDate: string;
  name?: string;
  fieldConstraint?: FieldConstraint | null;
  teamLevel?: string | null;
  /** Server-side redirect to the new plan after creation. */
  redirectTo?: boolean;
}

export async function createPlanAction(
  input: CreatePlanInput,
): Promise<{ error: string | null; planId?: string }> {
  if (!input.planDate) return { error: "Pick a date." };
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const r = await createPlan({
    programId: coach.program_id,
    planDate: input.planDate,
    name: input.name,
    fieldConstraint: input.fieldConstraint ?? null,
    teamLevel: input.teamLevel ?? null,
  });
  if (r.error || !r.data) return { error: r.error ?? "Couldn't create plan." };
  revalidatePractice();
  if (input.redirectTo) {
    redirect(`${PRACTICE_PATH}?plan=${r.data.id}`);
  }
  return { error: null, planId: r.data.id };
}

export interface UpdatePlanInput {
  planId: string;
  name?: string;
  status?: PlanStatus;
  fieldConstraint?: FieldConstraint | null;
  aiBriefText?: string | null;
  teamLevel?: string | null;
  planDate?: string;
}

export async function updatePlanAction(
  input: UpdatePlanInput,
): Promise<{ error: string | null }> {
  if (!input.planId) return { error: "Plan ID required." };
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const { planId, ...patch } = input;
  const r = await updatePlan(planId, patch);
  if (r.error) return r;
  revalidatePractice();
  return { error: null };
}

export async function deletePlanAction(
  planId: string,
): Promise<{ error: string | null }> {
  if (!planId) return { error: "Plan ID required." };
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const r = await deletePlan(planId);
  if (r.error) return r;
  revalidatePractice();
  return { error: null };
}

export async function duplicatePlanAction(
  sourcePlanId: string,
  newDate: string,
): Promise<{ error: string | null; planId?: string }> {
  if (!sourcePlanId || !newDate) return { error: "Source plan + new date required." };
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const r = await duplicatePlan(sourcePlanId, newDate);
  if (r.error || !r.data) return { error: r.error ?? "Couldn't duplicate plan." };
  revalidatePractice();
  return { error: null, planId: r.data.id };
}

// ── Block CRUD ───────────────────────────────────────────────────

export interface AddBlockInput {
  planId: string;
  category: PlanCategory;
  drillName: string;
  durationMin: number;
  lane?: PlanLane;
  focusText?: string | null;
  drillId?: string | null;
}

export async function addBlockAction(
  input: AddBlockInput,
): Promise<{ error: string | null; blockId?: string }> {
  if (!input.planId || !input.drillName?.trim()) {
    return { error: "Plan ID + drill name required." };
  }
  if (!input.durationMin || input.durationMin <= 0) {
    return { error: "Duration must be positive." };
  }
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const r = await addBlock(input);
  if (r.error || !r.data) return { error: r.error ?? "Couldn't add block." };
  revalidatePractice();
  return { error: null, blockId: r.data.id };
}

export interface UpdateBlockInput {
  blockId: string;
  planId: string;
  durationMin?: number;
  lane?: PlanLane;
  category?: PlanCategory;
  drillName?: string;
  focusText?: string | null;
}

export async function updateBlockAction(
  input: UpdateBlockInput,
): Promise<{ error: string | null }> {
  if (!input.blockId) return { error: "Block ID required." };
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const { blockId, ...patch } = input;
  const r = await updateBlock(blockId, patch);
  if (r.error) return r;
  revalidatePractice();
  return { error: null };
}

export async function removeBlockAction(
  blockId: string,
): Promise<{ error: string | null }> {
  if (!blockId) return { error: "Block ID required." };
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const r = await removeBlock(blockId);
  if (r.error) return r;
  revalidatePractice();
  return { error: null };
}

export async function reorderBlocksAction(
  planId: string,
  orderedBlockIds: string[],
): Promise<{ error: string | null }> {
  if (!planId) return { error: "Plan ID required." };
  if (!Array.isArray(orderedBlockIds)) return { error: "Bad input." };
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const r = await reorderBlocks(planId, orderedBlockIds);
  if (r.error) return r;
  revalidatePractice();
  return { error: null };
}

// ── Drill library ────────────────────────────────────────────────

export interface AddCustomDrillInput {
  name: string;
  defaultDuration: number;
  focus?: string | null;
  category: PlanCategory;
}

export async function addCustomDrillAction(
  input: AddCustomDrillInput,
): Promise<{ error: string | null; drillId?: string }> {
  if (!input.name?.trim()) return { error: "Drill name required." };
  if (!input.defaultDuration || input.defaultDuration <= 0) {
    return { error: "Default duration must be positive." };
  }
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const r = await addCustomDrill({
    programId: coach.program_id,
    ...input,
  });
  if (r.error || !r.data) return { error: r.error ?? "Couldn't add drill." };
  revalidatePractice();
  return { error: null, drillId: r.data.id };
}

export async function deleteDrillAction(
  drillId: string,
): Promise<{ error: string | null }> {
  if (!drillId) return { error: "Drill ID required." };
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const r = await deleteDrill(drillId);
  if (r.error) return r;
  revalidatePractice();
  return { error: null };
}

// ── AI Assistant Coach: practice plan generation ─────────────────

export interface GeneratePracticePlanInput {
  planId: string;
  fieldConstraint: FieldConstraint;
  /** Defaults to 90. */
  availableMinutes?: number;
  teamLevel?: string | null;
  focus?: string | null;
}

/**
 * Server action: ask the AI Assistant Coach to draft a practice plan.
 * Returns the structured proposal + the captured input context — does
 * NOT mutate the plan. The client renders a confirmation step with
 * append vs replace, then calls applyAIPracticePlanAction with the
 * user's choice.
 *
 * Returns `aiContext` (the JSON payload sent to Claude) so the apply
 * action can persist it to ai_plan_generations alongside the chosen
 * mode without re-fetching everything.
 */
export async function generatePracticePlanAction(
  input: GeneratePracticePlanInput,
): Promise<{
  error: string | null;
  notConfigured?: boolean;
  summary?: string;
  blocks?: AIPlanProposalBlock[];
  /** Echoed back so the apply action can log it. */
  aiContext?: Record<string, unknown>;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
}> {
  if (!input.planId) return { error: "Plan ID required." };
  // Hard refusal: AI is disabled on the public /demo route. Stops a
  // prospect from accidentally burning the API budget by spamming the
  // Generate button. Surfaced as `notConfigured` so the existing
  // toast UX ("Sign up to use AI") fires.
  if (isDemoRequest()) {
    return {
      error: "AI Assistant Coach is disabled in the demo. Sign up to use it for free.",
      notConfigured: true,
    };
  }
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };

  // Same rate-limit ceiling as the Hub AI Coach card. Sharing the
  // bucket is intentional — both go through the Anthropic budget.
  const rl = checkAIRateLimit(coach.id);
  if (!rl.ok) {
    return {
      error:
        rl.reason === "burst"
          ? `Slow down — try again in ${formatRetryAfter(rl.retryAfterMs)}.`
          : `You've hit the hourly AI limit. Try again in ${formatRetryAfter(rl.retryAfterMs)}.`,
    };
  }

  // Verify plan ownership + pull existing block names so the AI doesn't
  // suggest duplicates when the coach intends to append.
  const plan = await getPlanById(input.planId);
  if (!plan) return { error: "Plan not found." };

  // Pull library names so the AI prefers drills the coach already has.
  const library = await getDrillLibrary(coach.program_id);

  const baseCtx = await gatherAICoachContext(
    coach.program_id,
    coach.full_name,
    coach.program_name,
    coach.program_levels,
  );

  // Pull the program's recent 👍/👎 trend (last 90 days, up to 30
  // ratings). Empty trend if migration not applied — silent fallback.
  const feedbackTrend = await getRecentAIFeedbackTrend(coach.program_id);

  const generateInput = {
    fieldConstraint: input.fieldConstraint as AIFieldConstraint,
    availableMinutes: input.availableMinutes ?? 90,
    teamLevel: input.teamLevel ?? plan.teamLevel ?? null,
    focus: input.focus ?? null,
    existingDrillNames: plan.blocks.map((b) => b.drillName),
    libraryDrillNames: library.map((d) => d.name),
    feedbackTrend,
  };

  const proposal = await generatePracticePlan(baseCtx, generateInput);

  if (!proposal.ok) {
    return {
      error: proposal.error ?? "Plan generation failed.",
      notConfigured: proposal.notConfigured,
    };
  }

  // Echo the input context back so the apply action can log it without
  // re-running the (expensive) gather pass.
  const aiContext: Record<string, unknown> = {
    fieldConstraint: generateInput.fieldConstraint,
    availableMinutes: generateInput.availableMinutes,
    teamLevel: generateInput.teamLevel,
    focus: generateInput.focus,
    existingDrillCount: plan.blocks.length,
    libraryDrillCount: library.length,
    rosterSummary: baseCtx.rosterSummary,
    nextGame: baseCtx.nextGame,
    recentNoteCount: baseCtx.recentNotes.length,
    feedbackTrend,
  };

  return {
    error: null,
    summary: proposal.summary,
    blocks: proposal.blocks,
    aiContext,
    model: proposal.model,
    tokensIn: proposal.tokensIn,
    tokensOut: proposal.tokensOut,
  };
}

export type ApplyAIPracticePlanMode = "append" | "replace";

/**
 * Apply a previously-generated AI proposal to a plan. Append (default)
 * adds the blocks at the end of the existing plan. Replace deletes all
 * existing blocks first then inserts the new set.
 *
 * Both modes go through the service layer's bulk helpers so blocks are
 * inserted in a single statement (no N round-trips).
 *
 * Logs the generation to ai_plan_generations after a successful apply,
 * returning `generationId` so the client can attach 👍/👎 feedback.
 * Logging is best-effort — if migration 000027 isn't applied, the apply
 * still succeeds; the feedback button is just hidden client-side.
 */
export async function applyAIPracticePlanAction(
  planId: string,
  blocks: AIPlanProposalBlock[],
  mode: ApplyAIPracticePlanMode,
  /** Echo of the input context returned by generatePracticePlanAction. */
  aiContext?: Record<string, unknown>,
  meta?: { model?: string; tokensIn?: number; tokensOut?: number },
): Promise<{ error: string | null; insertedCount?: number; generationId?: string | null }> {
  if (!planId) return { error: "Plan ID required." };
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { error: "No blocks to apply." };
  }
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };

  // Verify plan ownership before touching anything (RLS would catch a
  // foreign plan too, but we want a clear error before mutating).
  const plan = await getPlanById(planId);
  if (!plan) return { error: "Plan not found." };

  // Defensive: clip to PlanCategory + PlanLane unions and sanitize.
  const safeBlocks = blocks
    .filter((b) => b && typeof b.drillName === "string" && b.drillName.trim().length > 0)
    .map((b) => ({
      category: b.category as PlanCategory,
      drillName: b.drillName.trim().slice(0, 200),
      durationMin: Math.max(1, Math.min(180, Math.round(b.durationMin))),
      lane: (b.lane === "secondary" ? "secondary" : "main") as PlanLane,
      focusText: b.focusText?.trim() || null,
      drillId: null,
    }));

  if (safeBlocks.length === 0) return { error: "No valid blocks to apply." };

  const r =
    mode === "replace"
      ? await replaceBlocks(planId, safeBlocks)
      : await appendBlocks(planId, safeBlocks);
  if (r.error) return { error: r.error };
  revalidatePractice();

  // Best-effort log. Failure here doesn't block the user-facing success.
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const log = await logAIGeneration({
    programId: coach.program_id,
    planId,
    inputContext: aiContext ?? {
      fieldConstraint: null,
      note: "context not provided by caller",
    },
    outputBlocks: safeBlocks.map((b) => ({
      category: b.category,
      drillName: b.drillName,
      durationMin: b.durationMin,
      focusText: b.focusText,
      lane: b.lane,
    })),
    mode,
    fieldConstraint: (aiContext?.fieldConstraint as string | undefined) ?? null,
    model: meta?.model ?? null,
    tokensIn: meta?.tokensIn ?? null,
    tokensOut: meta?.tokensOut ?? null,
    createdBy: user?.id ?? null,
  });

  return {
    error: null,
    insertedCount: r.data?.length ?? safeBlocks.length,
    generationId: log.generationId,
  };
}

// ── Feedback ─────────────────────────────────────────────────────

export interface RecordAIPlanFeedbackInput {
  generationId: string;
  rating: 1 | -1;
  note?: string | null;
}

/**
 * Capture a coach's 👍/👎 reaction to a previously-applied AI plan.
 * Upserted on (generation_id, coach), so flipping the vote replaces
 * the previous rating. Note is optional (max 500 chars).
 *
 * If the AI logging migration hasn't been applied, returns the
 * pending-migration message so the UI can hide the feedback bar.
 */
export async function recordAIPlanFeedbackAction(
  input: RecordAIPlanFeedbackInput,
): Promise<{ error: string | null }> {
  const parsed = RecordAIPlanFeedbackSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const safe = parsed.data;

  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Verify the generation belongs to this coach's program before
  // accepting feedback. RLS will catch the cross-program insert too,
  // but the explicit check produces a clear error.
  const { data: gen } = await supabase
    .from("ai_plan_generations")
    .select("program_id")
    .eq("id", safe.generationId)
    .maybeSingle();
  if (!gen) return { error: "Generation not found (or AI logging migration pending)." };
  if (gen.program_id !== coach.program_id) return { error: "Not authorized." };

  const r = await recordAIFeedback({
    generationId: safe.generationId,
    programId: coach.program_id,
    rating: safe.rating,
    note: safe.note,
    createdBy: user?.id ?? null,
  });
  if (r.error) return r;
  return { error: null };
}
