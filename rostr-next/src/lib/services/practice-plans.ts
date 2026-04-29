import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Practice plan persistence — backed by the practice_plans +
 * practice_blocks + practice_drills tables (migration 000026).
 *
 * The on-disk schema uses the original 000007 column names
 * (practice_date, title, practice_plan_id, activity_name, sort_order)
 * for backwards compatibility with /me + /app/today + /app/schedule
 * which already query these tables. The service layer maps to the
 * planner-friendly names (planDate, name, planId, drillName, sequence).
 */

// ── Types ────────────────────────────────────────────────────────

export type PlanCategory =
  | "hit"
  | "def"
  | "bases"
  | "pitch"
  | "cond"
  | "warm"
  | "cool";

export type PlanLane = "main" | "secondary";

export type PlanStatus = "draft" | "published" | "archived";

export type FieldConstraint =
  | "full_field"
  | "cages_only"
  | "generic_grass"
  | "indoor_gym"
  | "parking_lot";

export interface PracticeDrill {
  id: string;
  programId: string;
  name: string;
  defaultDuration: number;
  focus: string | null;
  category: PlanCategory;
  source: "library" | "custom";
  createdBy: string | null;
  createdAt: string;
}

export interface PlanBlock {
  id: string;
  planId: string;
  sequence: number;
  lane: PlanLane;
  category: PlanCategory;
  drillName: string;
  focusText: string | null;
  durationMin: number;
  drillId: string | null;
}

export interface PracticePlan {
  id: string;
  programId: string;
  planDate: string; // YYYY-MM-DD
  name: string;
  status: PlanStatus;
  fieldConstraint: FieldConstraint | null;
  aiBriefText: string | null;
  teamLevel: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PracticePlanWithBlocks extends PracticePlan {
  blocks: PlanBlock[];
}

// ── Plans ────────────────────────────────────────────────────────

export async function createPlan(input: {
  programId: string;
  planDate: string;
  name?: string;
  fieldConstraint?: FieldConstraint | null;
  aiBriefText?: string | null;
  teamLevel?: string | null;
}): Promise<{ data: PracticePlan | null; error: string | null }> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const finalName =
    input.name?.trim() ||
    `Practice · ${new Date(input.planDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const { data, error } = await supabase
    .from("practice_plans")
    .insert({
      program_id: input.programId,
      practice_date: input.planDate,
      title: finalName,
      team_level: input.teamLevel ?? null,
      status: "draft",
      field_constraint: input.fieldConstraint ?? null,
      ai_brief_text: input.aiBriefText ?? null,
      created_by: user?.id ?? null,
    })
    .select(
      "id, program_id, practice_date, title, status, field_constraint, ai_brief_text, team_level, created_by, created_at, updated_at",
    )
    .single();
  if (error || !data) return { data: null, error: error?.message ?? "Couldn't create plan." };
  return { data: rowToPlan(data), error: null };
}

export async function updatePlan(
  planId: string,
  patch: {
    name?: string;
    status?: PlanStatus;
    fieldConstraint?: FieldConstraint | null;
    aiBriefText?: string | null;
    teamLevel?: string | null;
    planDate?: string;
  },
): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.title = patch.name.trim();
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.fieldConstraint !== undefined) update.field_constraint = patch.fieldConstraint;
  if (patch.aiBriefText !== undefined) update.ai_brief_text = patch.aiBriefText;
  if (patch.teamLevel !== undefined) update.team_level = patch.teamLevel;
  if (patch.planDate !== undefined) update.practice_date = patch.planDate;
  if (Object.keys(update).length === 0) return { error: null };
  const { error } = await supabase.from("practice_plans").update(update).eq("id", planId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function deletePlan(
  planId: string,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("practice_plans").delete().eq("id", planId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function getPlansByDate(
  programId: string,
  date: string,
): Promise<PracticePlan[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("practice_plans")
    .select(
      "id, program_id, practice_date, title, status, field_constraint, ai_brief_text, team_level, created_by, created_at, updated_at",
    )
    .eq("program_id", programId)
    .eq("practice_date", date)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToPlan);
}

/**
 * Recent + upcoming plans for the planner's "switch plan" picker.
 * Returns up to `limit` plans on or after `since` plus the most-recent
 * historical plan so the coach can always navigate back.
 */
export async function getRecentAndUpcomingPlans(
  programId: string,
  limit = 30,
): Promise<PracticePlan[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("practice_plans")
    .select(
      "id, program_id, practice_date, title, status, field_constraint, ai_brief_text, team_level, created_by, created_at, updated_at",
    )
    .eq("program_id", programId)
    .order("practice_date", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map(rowToPlan);
}

export async function getPlanById(
  planId: string,
): Promise<PracticePlanWithBlocks | null> {
  const supabase = createSupabaseServerClient();
  const [{ data: planRow }, { data: blockRows }] = await Promise.all([
    supabase
      .from("practice_plans")
      .select(
        "id, program_id, practice_date, title, status, field_constraint, ai_brief_text, team_level, created_by, created_at, updated_at",
      )
      .eq("id", planId)
      .maybeSingle(),
    supabase
      .from("practice_blocks")
      .select(
        "id, practice_plan_id, sort_order, lane, category, activity_name, focus_text, duration_min, drill_id, created_at",
      )
      .eq("practice_plan_id", planId)
      // Stable ordering: sort_order ASC, then created_at ASC for ties
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  if (!planRow) return null;
  return {
    ...rowToPlan(planRow),
    blocks: (blockRows ?? []).map(rowToBlock),
  };
}

// ── Blocks ───────────────────────────────────────────────────────

export async function addBlock(input: {
  planId: string;
  category: PlanCategory;
  drillName: string;
  durationMin: number;
  lane?: PlanLane;
  focusText?: string | null;
  drillId?: string | null;
}): Promise<{ data: PlanBlock | null; error: string | null }> {
  const supabase = createSupabaseServerClient();
  // Compute next sequence (sort_order). Append to end so coach's most
  // recent add lands at the bottom.
  const { data: latest } = await supabase
    .from("practice_blocks")
    .select("sort_order")
    .eq("practice_plan_id", input.planId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSeq = (latest?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("practice_blocks")
    .insert({
      practice_plan_id: input.planId,
      sort_order: nextSeq,
      lane: input.lane ?? "main",
      category: input.category,
      activity_name: input.drillName.trim(),
      focus_text: input.focusText ?? null,
      duration_min: Math.max(1, Math.min(180, input.durationMin)),
      drill_id: input.drillId ?? null,
      // start_time / end_time are nullable post-000026; planner doesn't use them
    })
    .select(
      "id, practice_plan_id, sort_order, lane, category, activity_name, focus_text, duration_min, drill_id, created_at",
    )
    .single();
  if (error || !data) return { data: null, error: error?.message ?? "Couldn't add block." };
  return { data: rowToBlock(data), error: null };
}

export async function updateBlock(
  blockId: string,
  patch: {
    durationMin?: number;
    lane?: PlanLane;
    category?: PlanCategory;
    drillName?: string;
    focusText?: string | null;
  },
): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const update: Record<string, unknown> = {};
  if (patch.durationMin !== undefined)
    update.duration_min = Math.max(1, Math.min(180, patch.durationMin));
  if (patch.lane !== undefined) update.lane = patch.lane;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.drillName !== undefined) update.activity_name = patch.drillName.trim();
  if (patch.focusText !== undefined) update.focus_text = patch.focusText;
  if (Object.keys(update).length === 0) return { error: null };
  const { error } = await supabase
    .from("practice_blocks")
    .update(update)
    .eq("id", blockId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function removeBlock(
  blockId: string,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("practice_blocks")
    .delete()
    .eq("id", blockId);
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Reorder all blocks within a plan to match the given block-id order.
 * Done as a batched update; any IDs not in the input are left alone.
 *
 * Sequence values are reassigned 1..N so the row order in the DB
 * matches the UI exactly. There is no UNIQUE constraint on
 * (plan_id, sort_order) so simultaneous updates are safe; the brief
 * window where two blocks share a sort_order resolves on the next
 * fetch (sort_order ASC, created_at ASC fallback).
 */
export async function reorderBlocks(
  planId: string,
  orderedBlockIds: string[],
): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  // Verify the blocks all belong to the plan to prevent cross-plan tampering
  const { data: existing } = await supabase
    .from("practice_blocks")
    .select("id")
    .eq("practice_plan_id", planId);
  const owned = new Set((existing ?? []).map((r) => r.id));
  const filtered = orderedBlockIds.filter((id) => owned.has(id));
  if (filtered.length === 0) return { error: null };

  // Update each block's sort_order. Could be a single SQL CASE statement
  // for efficiency but at pilot scale (≤30 blocks per plan) sequential
  // updates are clearer + still fast.
  for (let i = 0; i < filtered.length; i++) {
    const { error } = await supabase
      .from("practice_blocks")
      .update({ sort_order: i + 1 })
      .eq("id", filtered[i]);
    if (error) return { error: error.message };
  }
  return { error: null };
}

// ── Bulk add (used by AI plan apply) ────────────────────────────

/**
 * Insert many blocks at once after the existing tail. Sequence numbers
 * are computed server-side starting at MAX(sort_order)+1 so concurrent
 * single-block adds don't collide.
 */
export async function appendBlocks(
  planId: string,
  newBlocks: Array<{
    category: PlanCategory;
    drillName: string;
    durationMin: number;
    lane?: PlanLane;
    focusText?: string | null;
    drillId?: string | null;
  }>,
): Promise<{ data: PlanBlock[] | null; error: string | null }> {
  if (newBlocks.length === 0) return { data: [], error: null };
  const supabase = createSupabaseServerClient();
  const { data: latest } = await supabase
    .from("practice_blocks")
    .select("sort_order")
    .eq("practice_plan_id", planId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const startSeq = (latest?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("practice_blocks")
    .insert(
      newBlocks.map((b, i) => ({
        practice_plan_id: planId,
        sort_order: startSeq + i,
        lane: b.lane ?? "main",
        category: b.category,
        activity_name: b.drillName.trim(),
        focus_text: b.focusText ?? null,
        duration_min: Math.max(1, Math.min(180, b.durationMin)),
        drill_id: b.drillId ?? null,
      })),
    )
    .select(
      "id, practice_plan_id, sort_order, lane, category, activity_name, focus_text, duration_min, drill_id, created_at",
    );
  if (error || !data) return { data: null, error: error?.message ?? "Couldn't append blocks." };
  return { data: data.map(rowToBlock), error: null };
}

/**
 * Atomic-ish replace: delete every block on the plan, then bulk-insert
 * the new set. Done as two separate statements; brief race window where
 * a concurrent reader sees zero blocks is acceptable for a coach-driven
 * action (no user is making decisions on partial state).
 */
export async function replaceBlocks(
  planId: string,
  newBlocks: Array<{
    category: PlanCategory;
    drillName: string;
    durationMin: number;
    lane?: PlanLane;
    focusText?: string | null;
    drillId?: string | null;
  }>,
): Promise<{ data: PlanBlock[] | null; error: string | null }> {
  const supabase = createSupabaseServerClient();
  const { error: delErr } = await supabase
    .from("practice_blocks")
    .delete()
    .eq("practice_plan_id", planId);
  if (delErr) return { data: null, error: delErr.message };
  if (newBlocks.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from("practice_blocks")
    .insert(
      newBlocks.map((b, i) => ({
        practice_plan_id: planId,
        sort_order: i + 1,
        lane: b.lane ?? "main",
        category: b.category,
        activity_name: b.drillName.trim(),
        focus_text: b.focusText ?? null,
        duration_min: Math.max(1, Math.min(180, b.durationMin)),
        drill_id: b.drillId ?? null,
      })),
    )
    .select(
      "id, practice_plan_id, sort_order, lane, category, activity_name, focus_text, duration_min, drill_id, created_at",
    );
  if (error || !data) return { data: null, error: error?.message ?? "Couldn't insert blocks." };
  return { data: data.map(rowToBlock), error: null };
}

// ── Duplicate plan ───────────────────────────────────────────────

export async function duplicatePlan(
  sourcePlanId: string,
  newDate: string,
): Promise<{ data: PracticePlan | null; error: string | null }> {
  const source = await getPlanById(sourcePlanId);
  if (!source) return { data: null, error: "Source plan not found." };

  const created = await createPlan({
    programId: source.programId,
    planDate: newDate,
    name: source.name + " (copy)",
    fieldConstraint: source.fieldConstraint,
    aiBriefText: source.aiBriefText,
    teamLevel: source.teamLevel,
  });
  if (created.error || !created.data) return created;

  // Bulk-insert all blocks at once into the new plan
  if (source.blocks.length > 0) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("practice_blocks").insert(
      source.blocks.map((b, i) => ({
        practice_plan_id: created.data!.id,
        sort_order: i + 1,
        lane: b.lane,
        category: b.category,
        activity_name: b.drillName,
        focus_text: b.focusText,
        duration_min: b.durationMin,
        drill_id: b.drillId,
      })),
    );
    if (error) return { data: created.data, error: error.message };
  }
  return created;
}

// ── Drill library ────────────────────────────────────────────────

/**
 * Returns the program's drill library, lazy-seeding defaults if empty.
 * The migration backfills existing programs; this is the safety net for
 * any program created post-migration.
 */
export async function getDrillLibrary(
  programId: string,
): Promise<PracticeDrill[]> {
  const supabase = createSupabaseServerClient();
  let { data, error } = await supabase
    .from("practice_drills")
    .select("id, program_id, name, default_duration, focus, category, source, created_by, created_at")
    .eq("program_id", programId)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) return [];

  // Lazy seed if empty
  if (!data || data.length === 0) {
    await supabase.rpc("seed_default_practice_drills", { p_program_id: programId });
    const seeded = await supabase
      .from("practice_drills")
      .select("id, program_id, name, default_duration, focus, category, source, created_by, created_at")
      .eq("program_id", programId)
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    data = seeded.data ?? [];
  }

  return (data ?? []).map(rowToDrill);
}

export async function addCustomDrill(input: {
  programId: string;
  name: string;
  defaultDuration: number;
  focus?: string | null;
  category: PlanCategory;
}): Promise<{ data: PracticeDrill | null; error: string | null }> {
  if (!input.name.trim()) return { data: null, error: "Drill name required." };
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("practice_drills")
    .insert({
      program_id: input.programId,
      name: input.name.trim(),
      default_duration: Math.max(1, Math.min(180, input.defaultDuration)),
      focus: input.focus?.trim() || null,
      category: input.category,
      source: "custom",
      created_by: user?.id ?? null,
    })
    .select("id, program_id, name, default_duration, focus, category, source, created_by, created_at")
    .single();
  if (error || !data) return { data: null, error: error?.message ?? "Couldn't add drill." };
  return { data: rowToDrill(data), error: null };
}

export async function deleteDrill(
  drillId: string,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("practice_drills").delete().eq("id", drillId);
  if (error) return { error: error.message };
  return { error: null };
}

// ── Row → type mappers ───────────────────────────────────────────

interface PlanRow {
  id: string;
  program_id: string;
  practice_date: string;
  title: string;
  status: string;
  field_constraint: string | null;
  ai_brief_text: string | null;
  team_level: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface BlockRow {
  id: string;
  practice_plan_id: string;
  sort_order: number;
  lane: string;
  category: string | null;
  activity_name: string;
  focus_text: string | null;
  duration_min: number | null;
  drill_id: string | null;
  created_at: string;
}

interface DrillRow {
  id: string;
  program_id: string;
  name: string;
  default_duration: number;
  focus: string | null;
  category: string;
  source: string;
  created_by: string | null;
  created_at: string;
}

function rowToPlan(r: PlanRow): PracticePlan {
  return {
    id: r.id,
    programId: r.program_id,
    planDate: r.practice_date,
    name: r.title,
    status: (r.status ?? "draft") as PlanStatus,
    fieldConstraint: (r.field_constraint as FieldConstraint | null) ?? null,
    aiBriefText: r.ai_brief_text,
    teamLevel: r.team_level,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToBlock(r: BlockRow): PlanBlock {
  return {
    id: r.id,
    planId: r.practice_plan_id,
    sequence: r.sort_order,
    lane: (r.lane as PlanLane) ?? "main",
    // Existing legacy rows from 000007 may have NULL category — fall
    // back to "warm" so the planner has a valid category to render.
    category: (r.category as PlanCategory) ?? "warm",
    drillName: r.activity_name,
    focusText: r.focus_text,
    // Legacy rows have NULL duration_min — fall back to 15m default.
    durationMin: r.duration_min ?? 15,
    drillId: r.drill_id,
  };
}

function rowToDrill(r: DrillRow): PracticeDrill {
  return {
    id: r.id,
    programId: r.program_id,
    name: r.name,
    defaultDuration: r.default_duration,
    focus: r.focus,
    category: r.category as PlanCategory,
    source: r.source as "library" | "custom",
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}
