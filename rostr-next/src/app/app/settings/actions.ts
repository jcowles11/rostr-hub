"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";
import { seedDemoData } from "@/lib/services/demo-seed";

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

/**
 * seedDemoDataAction — populate the coach's program with a full demo
 * dataset (25 players, schedule, practice plan, tryout + scores,
 * batting/pitching season stats, notes, one completed game w/ events).
 *
 * Idempotent — checks for the marker player before inserting. Calling
 * a second time returns `alreadySeeded: true` with no changes.
 *
 * Caller responsibility: warn the user this adds demo data alongside
 * any real data they already have. (We don't merge by name; duplicates
 * possible if the coach already has a player named "Marcus Johnson".)
 */
export async function seedDemoDataAction(): Promise<{
  error: string | null;
  summary?: {
    alreadySeeded: boolean;
    playersInserted: number;
    gamesInserted: number;
    practicesInserted: number;
    practicePlanBlocksInserted: number;
    tryoutAttendees: number;
    tryoutScoresInserted: number;
    battingRowsInserted: number;
    pitchingRowsInserted: number;
    notesInserted: number;
    completedGameEventsInserted: number;
  };
}> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program. Sign up + complete setup first." };
  const r = await seedDemoData(coach.program_id, coach.id);
  if (r.error) return { error: r.error };

  // Revalidate every coach surface so the new data shows up
  // immediately without a manual refresh.
  revalidatePath("/app", "layout");
  revalidatePath("/app/today");
  revalidatePath("/app/roster");
  revalidatePath("/app/schedule");
  revalidatePath("/app/games");
  revalidatePath("/app/practice");
  revalidatePath("/app/tryouts");
  return { error: null, summary: r.data ?? undefined };
}
