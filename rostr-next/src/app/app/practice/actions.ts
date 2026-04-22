"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";

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

  revalidatePath("/app");
  revalidatePath("/app/practice");
  revalidatePath("/app/schedule");
  return { error: null, practiceId: data.id };
}
