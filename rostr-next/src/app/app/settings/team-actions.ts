"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";
import { isDemoRequest, DEMO_GUARD_MESSAGE } from "@/lib/demo-guard";
import {
  archiveTeam as archiveTeamService,
  createTeam as createTeamService,
  unarchiveTeam as unarchiveTeamService,
  updateTeam as updateTeamService,
} from "@/lib/services/teams";

/**
 * Team CRUD + coach assignment server actions for the Settings → Teams
 * panel. Head-coach-only writes (RLS enforces this; we duplicate the
 * check at action level for a friendlier error message).
 *
 * Note on demo: every mutation short-circuits in demo mode with the
 * standard guard message — demo prospects see "This is a demo — sign
 * up free" instead of a partial write.
 */

function ensureHeadCoach(role: string | null | undefined, scope: string | null | undefined): boolean {
  // Both program-wide and org-wide head coaches can manage teams + assign
  // staff. Team-scoped head coaches can't add OTHER teams (only their own).
  if (role !== "head_coach") return false;
  return scope === "program" || scope === "organization";
}

// ── Team CRUD ────────────────────────────────────────────────────

export async function createTeamAction(input: {
  name: string;
  shortCode?: string;
}): Promise<{ error: string | null; teamId?: string }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (!ensureHeadCoach(coach.role, coach.scope)) {
    return { error: "Only head coaches can add teams." };
  }
  const r = await createTeamService({
    programId: coach.program_id,
    name: input.name,
    shortCode: input.shortCode ?? null,
  });
  if (r.error) return { error: r.error };
  revalidatePath("/app/settings");
  revalidatePath("/app/roster");
  return { error: null, teamId: r.data?.id };
}

export async function updateTeamAction(input: {
  teamId: string;
  name?: string;
  shortCode?: string | null;
  sortOrder?: number;
}): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (!ensureHeadCoach(coach.role, coach.scope)) {
    return { error: "Only head coaches can edit teams." };
  }
  const r = await updateTeamService(input.teamId, {
    name: input.name,
    shortCode: input.shortCode,
    sortOrder: input.sortOrder,
  });
  if (r.error) return r;
  revalidatePath("/app/settings");
  revalidatePath("/app/roster");
  return { error: null };
}

export async function archiveTeamAction(
  teamId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (!ensureHeadCoach(coach.role, coach.scope)) {
    return { error: "Only head coaches can archive teams." };
  }

  // Safety: check whether this team has assigned coaches or active
  // roster assignments. If so, warn the caller — we don't auto-cascade
  // because the head coach probably wants to reassign first.
  const supabase = createSupabaseServerClient();
  const [{ count: coachCount }, { count: rosterCount }] = await Promise.all([
    supabase.from("coaches").select("id", { count: "exact", head: true }).eq("team_id", teamId),
    supabase
      .from("roster_assignments")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId),
  ]);
  if ((coachCount ?? 0) > 0 || (rosterCount ?? 0) > 0) {
    return {
      error:
        "This team has assigned coaches or players. Reassign them first, then archive.",
    };
  }

  const r = await archiveTeamService(teamId);
  if (r.error) return r;
  revalidatePath("/app/settings");
  revalidatePath("/app/roster");
  return { error: null };
}

export async function unarchiveTeamAction(
  teamId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (!ensureHeadCoach(coach.role, coach.scope)) {
    return { error: "Only head coaches can unarchive teams." };
  }
  const r = await unarchiveTeamService(teamId);
  if (r.error) return r;
  revalidatePath("/app/settings");
  return { error: null };
}

// ── Coach assignment ────────────────────────────────────────────

/**
 * assignCoachToTeamAction — change an existing coach's scope/team.
 *
 * Two paths:
 *   - Promote a team-scoped coach to program-wide: pass `teamId: null`.
 *   - Move a coach between teams: pass the new `teamId`.
 *
 * Doesn't change role (head_coach vs assistant_coach) — use
 * updateCoachRoleAction for that. Keeping the operations separate
 * makes the audit trail cleaner.
 */
export async function assignCoachToTeamAction(input: {
  coachId: string;
  teamId: string | null;
}): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (!ensureHeadCoach(coach.role, coach.scope)) {
    return { error: "Only head coaches can change coach assignments." };
  }

  const supabase = createSupabaseServerClient();

  // Verify the target coach is in the same program (RLS would catch a
  // cross-program update too, but the explicit check produces a clearer
  // error and prevents accidentally surfacing 'No coach' as 'No
  // permissions').
  const { data: target } = await supabase
    .from("coaches")
    .select("id, program_id")
    .eq("id", input.coachId)
    .maybeSingle();
  if (!target) return { error: "Coach not found." };
  if (target.program_id !== coach.program_id) {
    return { error: "Coach is in a different program." };
  }

  // Verify team belongs to the program (when teamId provided).
  if (input.teamId) {
    const { data: team } = await supabase
      .from("teams")
      .select("program_id")
      .eq("id", input.teamId)
      .maybeSingle();
    if (!team) return { error: "Team not found." };
    if (team.program_id !== coach.program_id) {
      return { error: "Team is in a different program." };
    }
  }

  const newScope = input.teamId ? "team" : "program";
  const { error } = await supabase
    .from("coaches")
    .update({
      team_id: input.teamId,
      scope: newScope,
    })
    .eq("id", input.coachId);
  if (error) return { error: error.message };

  revalidatePath("/app/settings");
  return { error: null };
}

/**
 * updateCoachRoleAction — promote / demote a coach between
 * head_coach and assistant_coach within their existing scope.
 */
export async function updateCoachRoleAction(input: {
  coachId: string;
  role: "head_coach" | "assistant_coach";
}): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (!ensureHeadCoach(coach.role, coach.scope)) {
    return { error: "Only head coaches can change roles." };
  }

  const supabase = createSupabaseServerClient();
  const { data: target } = await supabase
    .from("coaches")
    .select("id, program_id, user_id")
    .eq("id", input.coachId)
    .maybeSingle();
  if (!target) return { error: "Coach not found." };
  if (target.program_id !== coach.program_id) {
    return { error: "Coach is in a different program." };
  }
  // Don't let a coach demote themselves out of head_coach if they're the
  // last one — would leave the program orphaned.
  if (
    target.user_id === coach.user_id &&
    input.role === "assistant_coach"
  ) {
    const { count: hcCount } = await supabase
      .from("coaches")
      .select("id", { count: "exact", head: true })
      .eq("program_id", coach.program_id)
      .eq("role", "head_coach")
      .eq("scope", "program");
    if ((hcCount ?? 0) <= 1) {
      return {
        error: "You're the only program-wide head coach. Promote someone else first.",
      };
    }
  }

  const { error } = await supabase
    .from("coaches")
    .update({ role: input.role })
    .eq("id", input.coachId);
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return { error: null };
}

/**
 * removeCoachAction — remove a coach from the program. The coach's
 * user account stays intact; only the program-coach link is dropped.
 * Uses RLS-safe DELETE — head coach in the same program only.
 */
export async function removeCoachAction(
  coachId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (!ensureHeadCoach(coach.role, coach.scope)) {
    return { error: "Only head coaches can remove coaches." };
  }
  if (coachId === coach.id) {
    return { error: "You can't remove yourself. Promote another head coach first." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("coaches")
    .delete()
    .eq("id", coachId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return { error: null };
}
