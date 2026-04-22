/**
 * Practice Service
 *
 * CRUD operations for practice plans and practice blocks.
 * Follows the { data, error } return contract used by all Rostr services.
 *
 * Tables: practice_plans, practice_blocks (migration 20260315000007)
 */
import { supabase } from "@/integrations/supabase/client";
import { validate, createPracticeSchema, updatePracticeSchema, createPracticeBlockSchema } from "@/lib/validation";

// ── Types ──────────────────────────────────────────────────────────

export interface PracticePlan {
  id: string;
  program_id: string;
  practice_date: string;
  team_level: string | null;
  title: string;
  notes: string | null;
  shared_with_players: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PracticeBlock {
  id: string;
  practice_plan_id: string;
  start_time: string;     // "HH:MM"
  end_time: string;       // "HH:MM"
  activity_name: string;
  player_group: string | null;
  assigned_coach_id: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

/** Block with coach name resolved (for display). */
export interface PracticeBlockWithCoach extends PracticeBlock {
  coach_name: string | null;
  coach_color: string | null;
}

export interface CreatePlanInput {
  program_id: string;
  practice_date: string;
  team_level?: string | null;
  title?: string;
  notes?: string | null;
  shared_with_players?: boolean;
  created_by?: string;
}

export interface CreateBlockInput {
  practice_plan_id: string;
  start_time: string;
  end_time: string;
  activity_name: string;
  player_group?: string | null;
  assigned_coach_id?: string | null;
  notes?: string | null;
  sort_order?: number;
}

// ── Practice Plan CRUD ─────────────────────────────────────────────

/** Fetch all practice plans for a program, newest first. */
export async function fetchPracticePlans(
  programId: string
): Promise<{ data: PracticePlan[]; error: string | null }> {
  const { data, error } = await supabase
    .from("practice_plans")
    .select("*")
    .eq("program_id", programId)
    .order("practice_date", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data as PracticePlan[]) ?? [], error: null };
}

/**
 * Fetch practice plans with a lightweight block count per plan.
 * A plan with zero blocks is treated as "needs a plan" in the UI.
 * Used by TeamHome's Needs Attention section.
 */
export async function fetchPracticePlansWithBlockCounts(
  programId: string
): Promise<{
  data: (PracticePlan & { block_count: number })[];
  error: string | null;
}> {
  const [plansRes, blocksRes] = await Promise.all([
    supabase
      .from("practice_plans")
      .select("*")
      .eq("program_id", programId)
      .order("practice_date", { ascending: true }),
    supabase
      .from("practice_blocks")
      .select("practice_plan_id"),
  ]);

  if (plansRes.error) return { data: [], error: plansRes.error.message };

  const blockCounts = new Map<string, number>();
  for (const b of (blocksRes.data as { practice_plan_id: string }[] | null) ?? []) {
    blockCounts.set(b.practice_plan_id, (blockCounts.get(b.practice_plan_id) ?? 0) + 1);
  }

  const plans = ((plansRes.data as PracticePlan[]) ?? []).map((p) => ({
    ...p,
    block_count: blockCounts.get(p.id) ?? 0,
  }));

  return { data: plans, error: null };
}

/** Fetch a single practice plan by ID. */
export async function fetchPracticePlan(
  planId: string
): Promise<{ data: PracticePlan | null; error: string | null }> {
  const { data, error } = await supabase
    .from("practice_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as PracticePlan | null, error: null };
}

/** Create a new practice plan. */
export async function createPracticePlan(
  input: CreatePlanInput
): Promise<{ data: PracticePlan | null; error: string | null }> {
  const validation = validate(createPracticeSchema, input);
  if (!validation.success) return { data: null, error: validation.error };
  const validated = validation.data;

  const { data, error } = await supabase
    .from("practice_plans")
    .insert({
      program_id: validated.program_id,
      practice_date: validated.practice_date,
      team_level: validated.team_level || null,
      title: validated.title?.trim() || "Practice",
      notes: validated.notes?.trim() || null,
      shared_with_players: validated.shared_with_players ?? false,
      created_by: validated.created_by || null,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as PracticePlan, error: null };
}

/** Update a practice plan header. */
export async function updatePracticePlan(
  planId: string,
  updates: Partial<Pick<PracticePlan, "practice_date" | "team_level" | "title" | "notes" | "shared_with_players">>
): Promise<{ data: PracticePlan | null; error: string | null }> {
  const validation = validate(updatePracticeSchema, updates);
  if (!validation.success) return { data: null, error: validation.error };
  const validated = validation.data;

  const { data, error } = await supabase
    .from("practice_plans")
    .update({ ...validated, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as PracticePlan, error: null };
}

/** Delete a practice plan (cascades blocks). */
export async function deletePracticePlan(
  planId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("practice_plans")
    .delete()
    .eq("id", planId);

  return { error: error?.message ?? null };
}

// ── Practice Block CRUD ────────────────────────────────────────────

/** Fetch all blocks for a plan, with coach name resolved. */
export async function fetchPracticeBlocks(
  planId: string
): Promise<{ data: PracticeBlockWithCoach[]; error: string | null }> {
  const { data, error } = await supabase
    .from("practice_blocks")
    .select("*, coaches(full_name, color)")
    .eq("practice_plan_id", planId)
    .order("sort_order")
    .order("start_time");

  if (error) return { data: [], error: error.message };

  const blocks: PracticeBlockWithCoach[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    practice_plan_id: row.practice_plan_id as string,
    start_time: row.start_time as string,
    end_time: row.end_time as string,
    activity_name: row.activity_name as string,
    player_group: row.player_group as string | null,
    assigned_coach_id: row.assigned_coach_id as string | null,
    notes: row.notes as string | null,
    sort_order: row.sort_order as number,
    created_at: row.created_at as string,
    coach_name: (row.coaches as Record<string, unknown> | null)?.full_name as string | null ?? null,
    coach_color: (row.coaches as Record<string, unknown> | null)?.color as string | null ?? null,
  }));

  return { data: blocks, error: null };
}

/** Create a new practice block. */
export async function createPracticeBlock(
  input: CreateBlockInput
): Promise<{ data: PracticeBlock | null; error: string | null }> {
  const validation = validate(createPracticeBlockSchema, input);
  if (!validation.success) return { data: null, error: validation.error };
  const validated = validation.data;

  const { data, error } = await supabase
    .from("practice_blocks")
    .insert({
      practice_plan_id: validated.practice_plan_id,
      start_time: validated.start_time,
      end_time: validated.end_time,
      activity_name: validated.activity_name.trim(),
      player_group: validated.player_group?.trim() || null,
      assigned_coach_id: validated.assigned_coach_id || null,
      notes: validated.notes?.trim() || null,
      sort_order: validated.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as PracticeBlock, error: null };
}

/** Update a practice block. */
export async function updatePracticeBlock(
  blockId: string,
  updates: Partial<Pick<PracticeBlock, "start_time" | "end_time" | "activity_name" | "player_group" | "assigned_coach_id" | "notes" | "sort_order">>
): Promise<{ data: PracticeBlock | null; error: string | null }> {
  const { data, error } = await supabase
    .from("practice_blocks")
    .update(updates)
    .eq("id", blockId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as PracticeBlock, error: null };
}

/** Delete a practice block. */
export async function deletePracticeBlock(
  blockId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("practice_blocks")
    .delete()
    .eq("id", blockId);

  return { error: error?.message ?? null };
}

/** Replace all blocks for a plan (delete-all + insert-all, same pattern as lineup save). */
export async function replaceAllBlocks(
  planId: string,
  blocks: CreateBlockInput[]
): Promise<{ data: PracticeBlock[]; error: string | null }> {
  // Delete existing
  const { error: delError } = await supabase
    .from("practice_blocks")
    .delete()
    .eq("practice_plan_id", planId);

  if (delError) return { data: [], error: delError.message };

  if (blocks.length === 0) return { data: [], error: null };

  // Insert new
  const rows = blocks.map((b, i) => ({
    practice_plan_id: planId,
    start_time: b.start_time,
    end_time: b.end_time,
    activity_name: b.activity_name.trim(),
    player_group: b.player_group?.trim() || null,
    assigned_coach_id: b.assigned_coach_id || null,
    notes: b.notes?.trim() || null,
    sort_order: b.sort_order ?? i,
  }));

  const { data, error } = await supabase
    .from("practice_blocks")
    .insert(rows)
    .select();

  if (error) return { data: [], error: error.message };
  return { data: (data as PracticeBlock[]) ?? [], error: null };
}
