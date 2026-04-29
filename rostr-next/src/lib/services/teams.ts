import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Teams service — first-class teams within a program (Varsity, JV,
 * C-Team, Freshman, etc.). Replaces the `programs.levels` text array
 * for any new code that needs to assign coaches per team.
 *
 * Schema lives in migration 20260315000029.
 *
 * Backwards compat:
 *   - Existing code that reads `programs.levels` keeps working — the
 *     array is the denormalized cache; teams are the source of truth
 *     going forward.
 *   - Existing roster_assignments with only `assignment` text still
 *     work; new code prefers `team_id` when present.
 */

export interface Team {
  id: string;
  programId: string;
  name: string;          // "Varsity"
  shortCode: string | null;  // "V"
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Pre-joined: count of coaches assigned to this team (scope='team'). */
  coachCount?: number;
  /** Pre-joined: count of players currently assigned to this team. */
  playerCount?: number;
}

/**
 * fetchTeams — every team in a program, ordered by sort_order, with
 * pre-joined coach + player counts so the UI can render the list
 * without N+1.
 *
 * Optionally exclude archived teams via `includeArchived: false` (default).
 */
export async function fetchTeams(
  programId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<Team[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("teams")
    .select("id, program_id, name, short_code, sort_order, archived_at, created_at, updated_at")
    .eq("program_id", programId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (!opts.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data: teamRows, error } = await query;
  if (error || !teamRows) return [];
  if (teamRows.length === 0) return [];

  const teamIds = teamRows.map((t) => t.id);

  // Two parallel rollups — coach count + player count per team.
  const [coachCounts, playerCounts] = await Promise.all([
    supabase
      .from("coaches")
      .select("team_id")
      .in("team_id", teamIds),
    supabase
      .from("roster_assignments")
      .select("team_id")
      .in("team_id", teamIds),
  ]);

  const coachByTeam = new Map<string, number>();
  for (const c of coachCounts.data ?? []) {
    if (!c.team_id) continue;
    coachByTeam.set(c.team_id, (coachByTeam.get(c.team_id) ?? 0) + 1);
  }
  const playerByTeam = new Map<string, number>();
  for (const p of playerCounts.data ?? []) {
    if (!p.team_id) continue;
    playerByTeam.set(p.team_id, (playerByTeam.get(p.team_id) ?? 0) + 1);
  }

  return teamRows.map((r) => ({
    id: r.id,
    programId: r.program_id,
    name: r.name,
    shortCode: r.short_code,
    sortOrder: r.sort_order ?? 0,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    coachCount: coachByTeam.get(r.id) ?? 0,
    playerCount: playerByTeam.get(r.id) ?? 0,
  }));
}

/**
 * fetchTeamById — single team lookup with the same pre-joined counts.
 * Returns null when the team doesn't exist or RLS hides it.
 */
export async function fetchTeamById(teamId: string): Promise<Team | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, program_id, name, short_code, sort_order, archived_at, created_at, updated_at")
    .eq("id", teamId)
    .maybeSingle();
  if (error || !data) return null;

  const [{ count: coachCount }, { count: playerCount }] = await Promise.all([
    supabase.from("coaches").select("id", { count: "exact", head: true }).eq("team_id", teamId),
    supabase.from("roster_assignments").select("id", { count: "exact", head: true }).eq("team_id", teamId),
  ]);

  return {
    id: data.id,
    programId: data.program_id,
    name: data.name,
    shortCode: data.short_code,
    sortOrder: data.sort_order ?? 0,
    archivedAt: data.archived_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    coachCount: coachCount ?? 0,
    playerCount: playerCount ?? 0,
  };
}

// ── Mutations ──────────────────────────────────────────────────

export async function createTeam(input: {
  programId: string;
  name: string;
  shortCode?: string | null;
  sortOrder?: number;
}): Promise<{ data: Team | null; error: string | null }> {
  const supabase = createSupabaseServerClient();
  const trimmed = input.name.trim();
  if (!trimmed) return { data: null, error: "Team name is required." };
  // Auto-generate a 1-2 letter short code if none provided.
  const shortCode = input.shortCode?.trim() || trimmed.slice(0, 2).toUpperCase();
  // Sort order defaults to "after the highest current order" so new
  // teams append to the bottom of the list.
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const { data: max } = await supabase
      .from("teams")
      .select("sort_order")
      .eq("program_id", input.programId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (max?.sort_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("teams")
    .insert({
      program_id: input.programId,
      name: trimmed,
      short_code: shortCode,
      sort_order: sortOrder,
    })
    .select("id, program_id, name, short_code, sort_order, archived_at, created_at, updated_at")
    .single();
  if (error || !data) {
    // 23505 = unique violation on (program_id, lower(name))
    if (error?.code === "23505") {
      return { data: null, error: `Team "${trimmed}" already exists in this program.` };
    }
    return { data: null, error: error?.message ?? "Couldn't create team." };
  }
  return {
    data: {
      id: data.id,
      programId: data.program_id,
      name: data.name,
      shortCode: data.short_code,
      sortOrder: data.sort_order ?? 0,
      archivedAt: data.archived_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
    error: null,
  };
}

export async function updateTeam(
  teamId: string,
  patch: { name?: string; shortCode?: string | null; sortOrder?: number },
): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: "Team name can't be empty." };
    update.name = trimmed;
  }
  if (patch.shortCode !== undefined) update.short_code = patch.shortCode?.trim() || null;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (Object.keys(update).length === 0) return { error: null };
  const { error } = await supabase.from("teams").update(update).eq("id", teamId);
  if (error?.code === "23505") {
    return { error: "Another team in this program already has that name." };
  }
  return { error: error?.message ?? null };
}

/**
 * Soft-archive a team (set archived_at). Players + roster_assignments
 * still reference the team_id; the UI just hides archived teams from
 * the active picker. Reversible via unarchive.
 *
 * Hard delete is intentionally NOT exposed at the service level —
 * archive preserves stat history and any games / lineups that point
 * at this team_id.
 */
export async function archiveTeam(teamId: string): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("teams")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", teamId);
  return { error: error?.message ?? null };
}

export async function unarchiveTeam(teamId: string): Promise<{ error: string | null }> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("teams")
    .update({ archived_at: null })
    .eq("id", teamId);
  return { error: error?.message ?? null };
}

// ── Coach assignment to teams ───────────────────────────────────

export interface TeamCoach {
  coachId: string;
  userId: string | null;
  fullName: string | null;
  email: string | null;
  role: "head_coach" | "assistant_coach";
  scope: "organization" | "program" | "team";
  teamId: string | null;
  organizationId: string | null;
  programId: string;
  color: string | null;
}

/**
 * fetchProgramCoachesGrouped — the program's full staff, grouped by
 * scope, so the Settings Teams panel can render:
 *   - Program-wide head coach (top of the list, always visible)
 *   - Per-team head coaches + assistants
 *   - Org-level coaches (AD, etc.)
 *
 * Returns a flat list with the scope/team_id metadata; the UI groups.
 */
export async function fetchProgramCoachesGrouped(
  programId: string,
): Promise<TeamCoach[]> {
  const supabase = createSupabaseServerClient();
  // Coach can be tied to a program directly, or be org-scoped covering
  // multiple programs in the org. Pull both so the staff list isn't
  // missing the AD.
  const { data: programData } = await supabase
    .from("programs")
    .select("organization_id")
    .eq("id", programId)
    .maybeSingle();
  const orgId = programData?.organization_id ?? null;

  const filters = orgId
    ? `program_id.eq.${programId},and(scope.eq.organization,organization_id.eq.${orgId})`
    : `program_id.eq.${programId}`;

  const { data, error } = await supabase
    .from("coaches")
    .select("id, user_id, full_name, email, role, scope, team_id, organization_id, program_id, color")
    .or(filters)
    .order("scope", { ascending: false })  // 'team' < 'program' < 'organization' alphabetically — see UI ordering
    .order("role", { ascending: true });
  if (error || !data) return [];

  return data.map((r) => ({
    coachId: r.id,
    userId: r.user_id,
    fullName: r.full_name,
    email: r.email,
    role: r.role as TeamCoach["role"],
    scope: r.scope as TeamCoach["scope"],
    teamId: r.team_id,
    organizationId: r.organization_id,
    programId: r.program_id,
    color: r.color,
  }));
}
