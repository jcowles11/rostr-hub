"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";

export interface CreatePlayerInput {
  firstName: string;
  lastName: string;
  grade?: number | null;
  positions: string[];
  bats?: "L" | "R" | "S" | null;
  throws?: "L" | "R" | null;
  playerNumber?: number | null;
}

/**
 * createPlayerAction — inserts a player row on the coach's program.
 * Returns the new player id on success, or an error string.
 */
export async function createPlayerAction(
  input: CreatePlayerInput,
): Promise<{ error: string | null; playerId?: string }> {
  if (!input.firstName.trim() || !input.lastName.trim()) {
    return { error: "First and last name are required." };
  }

  const coach = await getCurrentCoach();
  if (!coach) {
    return { error: "You need to set up your program first." };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .insert({
      program_id: coach.program_id,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      grade: input.grade ?? null,
      positions: input.positions.length > 0 ? input.positions : [],
      bats: input.bats ?? null,
      throws: input.throws ?? null,
      player_number: input.playerNumber ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Couldn't create the player." };
  }

  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null, playerId: data.id };
}

/**
 * deleteAllPlayersAction — wipes every player on the coach's program.
 * Used by the roster footer's "clear" action (future).
 */
export async function deleteAllPlayersAction(): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath("/app/roster");
  return { error: null };
}
