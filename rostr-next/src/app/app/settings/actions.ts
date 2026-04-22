"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";

export interface UpdateProgramInput {
  name?: string;
  levels?: string[];
  sport?: string;
}

export async function updateProgramAction(
  input: UpdateProgramInput,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program to update." };

  const supabase = createSupabaseServerClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.levels !== undefined) patch.levels = input.levels;
  if (input.sport !== undefined) patch.sport = input.sport;
  if (Object.keys(patch).length === 0) return { error: null };

  const { error } = await supabase
    .from("programs")
    .update(patch)
    .eq("id", coach.program_id);
  if (error) return { error: error.message };

  revalidatePath("/app", "layout");
  return { error: null };
}

export async function updateCoachNameAction(fullName: string): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No coach record." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("coaches")
    .update({ full_name: fullName })
    .eq("id", coach.id);
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  return { error: null };
}
