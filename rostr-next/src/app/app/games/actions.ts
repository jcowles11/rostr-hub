"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";

export interface CreateGameInput {
  opponent: string;
  name?: string;
  gameDate: string; // YYYY-MM-DD
  gameTime?: string; // HH:MM
  location?: string;
  homeAway: "home" | "away" | "neutral";
  teamLevel?: string;
}

export async function createGameAction(
  input: CreateGameInput,
): Promise<{ error: string | null; gameId?: string }> {
  if (!input.opponent.trim() || !input.gameDate) {
    return { error: "Opponent and game date are required." };
  }
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("games")
    .insert({
      program_id: coach.program_id,
      name: input.name?.trim() || `vs ${input.opponent.trim()}`,
      opponent: input.opponent.trim(),
      game_date: input.gameDate,
      game_time: input.gameTime || null,
      location: input.location?.trim() || null,
      home_away: input.homeAway,
      team_level: input.teamLevel || null,
      status: "scheduled",
      created_by: coach.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Couldn't create game." };

  revalidatePath("/app");
  revalidatePath("/app/games");
  revalidatePath("/app/schedule");
  return { error: null, gameId: data.id };
}
