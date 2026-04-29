"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * createProgramAction — first-run onboarding for a new coach.
 * Inserts organizations + organization_members + programs + coaches
 * in sequence so a signed-in coach goes from "no program record" to
 * "full program" in one form submit.
 *
 * RLS must permit the anon/authenticated user to INSERT into these
 * tables. (The existing Vite app does the same inserts with the anon
 * key, so policies are already in place.)
 */
export interface CreateProgramInput {
  programName: string;
  schoolName: string;
  sport: string;
  fullName: string;
  /** Team/level names. E.g. ["Varsity"], ["Varsity","JV","Freshman"], or ["Heritage JV"]. */
  levels?: string[];
}

export async function createProgramAction(input: CreateProgramInput) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  // 1. Organization
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({ name: input.schoolName, created_by: user.id })
    .select("id")
    .single();
  if (orgErr || !org) {
    return { error: `Couldn't create organization: ${orgErr?.message ?? "unknown"}` };
  }

  // 2. Program
  const { data: program, error: progErr } = await supabase
    .from("programs")
    .insert({
      name: input.programName,
      school_name: input.schoolName,
      created_by: user.id,
      sport: input.sport,
      organization_id: org.id,
      levels:
        input.levels && input.levels.length > 0
          ? input.levels
          : ["Varsity"],
    })
    .select("id")
    .single();
  if (progErr || !program) {
    return { error: `Couldn't create program: ${progErr?.message ?? "unknown"}` };
  }

  // 3. Organization member (links user → org with program scope)
  //
  // organization_members.role uses the `app_role` enum (admin | coach) —
  // a different vocabulary than coaches.role (head_coach | assistant_coach).
  // The creator of the program is treated as an admin of the org.
  const { error: memberErr } = await supabase.from("organization_members").insert({
    user_id: user.id,
    organization_id: org.id,
    program_id: program.id,
    role: "admin",
    full_name: input.fullName,
    email: user.email,
    color: "#c83a3a",
  });
  if (memberErr) {
    return { error: `Couldn't link you to the organization: ${memberErr.message}` };
  }

  // 4. Coach record
  const { error: coachErr } = await supabase.from("coaches").insert({
    user_id: user.id,
    program_id: program.id,
    full_name: input.fullName,
    email: user.email,
    role: "head_coach",
    color: "#c83a3a",
  });
  if (coachErr) {
    return { error: `Couldn't create coach profile: ${coachErr.message}` };
  }

  revalidatePath("/app", "layout");
  redirect("/app");
}
