import { supabase } from "@/integrations/supabase/client";
import {
  createOrganizationSchema,
  createProgramSchema,
  addCoachSchema,
  validate,
} from "@/lib/validation";

// ── Types ──────────────────────────────────────────────────────────

export interface CreateOrganizationParams {
  name: string;
  createdBy: string;
}

export interface AddOrgMemberParams {
  userId: string;
  organizationId: string;
  programId?: string;
  role: string;
  fullName: string;
  email: string;
  color: string;
}

export interface CreateProgramParams {
  name: string;
  schoolName: string;
  createdBy: string;
  sport: string;
  organizationId: string;
}

export interface CreateCoachParams {
  userId: string;
  programId: string;
  fullName: string;
  email: string;
  role: string;
  color: string;
}

export interface CreateDefaultTeamParams {
  programId: string;
  name: string;
}

export interface SeedDefaultMetricsParams {
  programId: string;
  metrics: {
    name: string;
    unit: string;
    category: string;
    metric_type: string;
    sort_order: number;
    min_value?: number;
    max_value?: number;
  }[];
}

// ── Service Functions ──────────────────────────────────────────────

export async function createOrganization(
  params: CreateOrganizationParams
): Promise<{ data: { id: string } | null; error: string | null }> {
  const validation = validate(createOrganizationSchema, params);
  if (!validation.success) {
    return { data: null, error: validation.error };
  }
  const validated = validation.data;

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: validated.name, created_by: validated.createdBy })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: { id: data.id }, error: null };
}

export async function addOrganizationMember(
  params: AddOrgMemberParams
): Promise<{ error: string | null }> {
  const insert: Record<string, unknown> = {
    user_id: params.userId,
    organization_id: params.organizationId,
    role: params.role,
    full_name: params.fullName,
    email: params.email,
    color: params.color,
  };
  if (params.programId) {
    insert.program_id = params.programId;
  }
  const { error } = await supabase
    .from("organization_members")
    .insert(insert);

  if (error) return { error: error.message };
  return { error: null };
}

export async function createProgram(
  params: CreateProgramParams
): Promise<{ data: { id: string } | null; error: string | null }> {
  const validation = validate(createProgramSchema, params);
  if (!validation.success) {
    return { data: null, error: validation.error };
  }
  const validated = validation.data;

  const { data, error } = await supabase
    .from("programs")
    .insert({
      name: validated.name,
      school_name: validated.schoolName,
      created_by: validated.createdBy,
      sport: validated.sport,
      organization_id: validated.organizationId,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: { id: data.id }, error: null };
}

export async function createCoach(
  params: CreateCoachParams
): Promise<{ error: string | null }> {
  const validation = validate(addCoachSchema, {
    programId: params.programId,
    fullName: params.fullName,
    email: params.email,
    color: params.color,
  });
  if (!validation.success) {
    return { error: validation.error };
  }

  const { error } = await supabase.from("coaches").insert({
    user_id: params.userId,
    program_id: params.programId,
    full_name: params.fullName,
    email: params.email,
    role: params.role,
    color: params.color,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function createDefaultTeam(
  params: CreateDefaultTeamParams
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("teams").insert({
    program_id: params.programId,
    name: params.name,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function seedDefaultMetrics(
  params: SeedDefaultMetricsParams
): Promise<{ error: string | null }> {
  const metricsToInsert = params.metrics.map((m) => ({
    ...m,
    program_id: params.programId,
    is_default: true,
  }));
  const { error } = await supabase
    .from("metrics")
    .insert(metricsToInsert as any);

  if (error) return { error: error.message };
  return { error: null };
}

// ── Settings / Registration ─────────────────────────────────────────

/** Fetch the registration code for a program. */
export async function fetchRegistrationCode(
  programId: string
): Promise<{ code: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("programs")
    .select("registration_code")
    .eq("id", programId)
    .single();

  if (error) return { code: null, error: error.message };
  return { code: data?.registration_code ?? null, error: null };
}

/** Update the registration code for a program. */
export async function updateRegistrationCode(
  programId: string,
  code: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("programs")
    .update({ registration_code: code })
    .eq("id", programId);

  if (error) {
    if (error.message.includes("duplicate")) {
      return { error: "That code is already taken" };
    }
    return { error: "Failed to update code" };
  }
  return { error: null };
}

/** Update the program name. */
export async function updateProgramName(
  programId: string,
  name: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("programs")
    .update({ name })
    .eq("id", programId);

  return { error: error ? "Failed to update program name" : null };
}

/** Update the program's team levels. */
export async function updateProgramLevels(
  programId: string,
  levels: string[]
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("programs")
    .update({ levels })
    .eq("id", programId);

  return { error: error?.message ?? null };
}

/** Update the program's results_public flag. */
export async function updateProgramResultsPublic(
  programId: string,
  resultsPublic: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("programs")
    .update({ results_public: resultsPublic })
    .eq("id", programId);

  return { error: error?.message ?? null };
}

/** Fetch program visibility settings (results_public). */
export async function fetchProgramVisibility(
  programId: string
): Promise<{ data: { results_public: boolean } | null; error: string | null }> {
  const { data, error } = await supabase
    .from("programs")
    .select("results_public")
    .eq("id", programId)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as { results_public: boolean }, error: null };
}

// ── Join Requests ───────────────────────────────────────────────────

/** Fetch pending join requests for a program. */
export async function fetchPendingJoinRequests(
  programId: string
): Promise<{ data: any[]; error: string | null }> {
  const { data, error } = await supabase
    .from("program_join_requests")
    .select("*")
    .eq("program_id", programId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

/** Approve a join request: create (or update) a player record and mark the request approved. */
export async function approveJoinRequest(
  requestId: string,
  programId: string,
  userId: string,
  playerName: string
): Promise<{ error: string | null }> {
  const parts = playerName.split(" ");
  const firstName = parts[0] || "Player";
  const lastName = parts.slice(1).join(" ") || "";

  const { error: insertErr } = await supabase.from("players").insert({
    program_id: programId,
    user_id: userId,
    first_name: firstName,
    last_name: lastName,
  });

  if (insertErr) {
    const { error: updateErr } = await supabase
      .from("players")
      .update({ program_id: programId })
      .eq("user_id", userId);
    if (updateErr) {
      return { error: "Failed to add player" };
    }
  }

  const { error } = await supabase
    .from("program_join_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString() } as any)
    .eq("id", requestId);

  return { error: error ? error.message : null };
}

/** Deny a join request. */
export async function denyJoinRequest(
  requestId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("program_join_requests")
    .update({ status: "denied", reviewed_at: new Date().toISOString() } as any)
    .eq("id", requestId);

  return { error: error ? error.message : null };
}
