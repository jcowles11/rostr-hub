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
 * setPlayerLevelAction — upsert a roster_assignments row.
 * Used by the inline level pill on the roster table.
 */
export async function setPlayerLevelAction(
  playerId: string,
  level: "varsity" | "jv" | "freshman" | "cut" | null,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  // null = remove any existing assignment (unassigned)
  if (level === null) {
    const { error } = await supabase
      .from("roster_assignments")
      .delete()
      .eq("player_id", playerId)
      .eq("program_id", coach.program_id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("roster_assignments")
      .upsert(
        {
          player_id: playerId,
          program_id: coach.program_id,
          assignment: level,
        },
        { onConflict: "player_id,program_id" },
      );
    if (error) return { error: error.message };
  }
  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null };
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
