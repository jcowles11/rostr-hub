"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";

/**
 * Coach invite actions — head-coach-only (RLS enforces it).
 * Lifecycle:
 *   createCoachInviteAction → returns { token } → coach shares the URL
 *   fetchCoachInvitesAction → list active + accepted invites
 *   deleteCoachInviteAction → revoke a pending invite
 *   fetchCoachesForProgram  → list current coaches (for the "Coaches"
 *                             section on Settings)
 */

export interface CoachInvite {
  id: string;
  inviteToken: string;
  invitedEmail: string | null;
  invitedName: string | null;
  role: "head_coach" | "assistant_coach";
  createdAt: string;
  acceptedAt: string | null;
  acceptedByUserId: string | null;
}

export interface ProgramCoach {
  id: string;
  userId: string;
  fullName: string;
  email: string | null;
  role: "head_coach" | "assistant_coach";
  color: string | null;
  createdAt: string;
}

export async function createCoachInviteAction(input: {
  name?: string;
  email?: string;
  role?: "head_coach" | "assistant_coach";
}): Promise<{ error: string | null; token?: string }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (coach.role !== "head_coach") return { error: "Only head coaches can invite." };
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("coach_invites")
    .insert({
      program_id: coach.program_id,
      invited_email: input.email?.trim() || null,
      invited_name: input.name?.trim() || null,
      role: input.role ?? "assistant_coach",
      created_by: coach.id,
    })
    .select("invite_token")
    .single();
  if (error || !data) return { error: error?.message ?? "Couldn't create invite." };

  revalidatePath("/app/settings");
  return { error: null, token: data.invite_token };
}

export async function fetchCoachInvitesAction(): Promise<{
  invites: CoachInvite[];
  error: string | null;
}> {
  const coach = await getCurrentCoach();
  if (!coach) return { invites: [], error: null };
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("coach_invites")
    .select("id, invite_token, invited_email, invited_name, role, created_at, accepted_at, accepted_by_user_id")
    .eq("program_id", coach.program_id)
    .order("created_at", { ascending: false });
  if (error) return { invites: [], error: error.message };

  return {
    error: null,
    invites: (data ?? []).map((r) => ({
      id: r.id,
      inviteToken: r.invite_token,
      invitedEmail: r.invited_email,
      invitedName: r.invited_name,
      role: r.role as "head_coach" | "assistant_coach",
      createdAt: r.created_at,
      acceptedAt: r.accepted_at,
      acceptedByUserId: r.accepted_by_user_id,
    })),
  };
}

export async function deleteCoachInviteAction(
  inviteId: string,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (coach.role !== "head_coach") return { error: "Only head coaches can revoke invites." };
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("coach_invites").delete().eq("id", inviteId);
  if (error) return { error: error.message };

  revalidatePath("/app/settings");
  return { error: null };
}

export async function fetchProgramCoaches(): Promise<{
  coaches: ProgramCoach[];
  error: string | null;
}> {
  const coach = await getCurrentCoach();
  if (!coach) return { coaches: [], error: null };
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("coaches")
    .select("id, user_id, full_name, email, role, color, created_at")
    .eq("program_id", coach.program_id)
    .order("created_at", { ascending: true });
  if (error) return { coaches: [], error: error.message };

  return {
    error: null,
    coaches: (data ?? []).map((c) => ({
      id: c.id,
      userId: c.user_id,
      fullName: c.full_name,
      email: c.email,
      role: c.role as "head_coach" | "assistant_coach",
      color: c.color,
      createdAt: c.created_at,
    })),
  };
}

export async function removeCoachAction(
  coachId: string,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (coach.role !== "head_coach") return { error: "Only head coaches can remove coaches." };
  if (coach.id === coachId) return { error: "You can't remove yourself." };
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

// ── Public-facing invite actions (used by /invite/[token]) ────────

export interface InvitePreview {
  programName: string;
  role: string;
  invitedName: string | null;
  invitedEmail: string | null;
  alreadyAccepted: boolean;
}

export async function fetchInvitePreview(
  token: string,
): Promise<InvitePreview | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_invite_preview_by_token", {
    _token: token,
  });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    programName: row.program_name,
    role: row.role,
    invitedName: row.invited_name,
    invitedEmail: row.invited_email,
    alreadyAccepted: Boolean(row.already_accepted),
  };
}

export async function acceptCoachInviteAction(
  token: string,
): Promise<{ error: string | null; programId?: string }> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in before accepting." };

  const { data, error } = await supabase.rpc("accept_coach_invite", {
    _token: token,
  });
  if (error) {
    const m = error.message ?? "";
    if (/invite_not_found/.test(m)) return { error: "This invite link isn't valid." };
    if (/invite_already_accepted/.test(m))
      return { error: "This invite was already accepted by someone else." };
    if (/not_signed_in/.test(m)) return { error: "Sign in before accepting." };
    return { error: m || "Couldn't accept invite." };
  }

  revalidatePath("/app");
  return { error: null, programId: data as string };
}
