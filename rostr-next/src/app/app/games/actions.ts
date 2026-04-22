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

/**
 * setGameRosterAction — set the full roster for a game.
 * Deletes rows for players not in the new list, then upserts the rest.
 */
export async function setGameRosterAction(
  gameId: string,
  playerIds: string[],
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  // Delete existing rows not in the new list
  if (playerIds.length > 0) {
    const { error: delErr } = await supabase
      .from("game_rosters")
      .delete()
      .eq("game_id", gameId)
      .not("player_id", "in", `(${playerIds.map((p) => `"${p}"`).join(",")})`);
    if (delErr) return { error: delErr.message };
  } else {
    const { error: delErr } = await supabase
      .from("game_rosters")
      .delete()
      .eq("game_id", gameId);
    if (delErr) return { error: delErr.message };
  }

  if (playerIds.length === 0) {
    revalidatePath(`/app/games/${gameId}`);
    return { error: null };
  }

  const rows = playerIds.map((pid) => ({
    game_id: gameId,
    player_id: pid,
    status: "active",
  }));
  const { error } = await supabase
    .from("game_rosters")
    .upsert(rows, { onConflict: "game_id,player_id" });
  if (error) return { error: error.message };

  revalidatePath(`/app/games/${gameId}`);
  revalidatePath("/app");
  return { error: null };
}

export interface LineupEntry {
  playerId: string;
  battingOrder: number; // 1..N
  position: string; // "P", "C", "SS", ...
}

/**
 * setLineupAction — replace the lineup_entries for a game.
 */
export async function setLineupAction(
  gameId: string,
  entries: LineupEntry[],
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  const { error: delErr } = await supabase
    .from("lineup_entries")
    .delete()
    .eq("game_id", gameId);
  if (delErr) return { error: delErr.message };

  if (entries.length === 0) {
    revalidatePath(`/app/games/${gameId}`);
    return { error: null };
  }

  const { error } = await supabase.from("lineup_entries").insert(
    entries.map((e) => ({
      game_id: gameId,
      player_id: e.playerId,
      batting_order: e.battingOrder,
      position: e.position,
    })),
  );
  if (error) return { error: error.message };

  revalidatePath(`/app/games/${gameId}`);
  return { error: null };
}

export async function deleteGameAction(gameId: string): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("games")
    .delete()
    .eq("id", gameId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/games");
  revalidatePath("/app/schedule");
  return { error: null };
}
