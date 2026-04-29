"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";
import { isDemoRequest, DEMO_GUARD_MESSAGE } from "@/lib/demo-guard";

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
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
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
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
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
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
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

/**
 * recordGameResultAction — flip a scheduled game to completed with a
 * final score. Stores recap notes + stamps who / when. The `result`
 * column (W/L/T) is a generated column on games, so no need to pass it.
 */
export interface RecordGameResultInput {
  gameId: string;
  ourScore: number;
  opponentScore: number;
  recapNotes?: string;
}

export async function recordGameResultAction(
  input: RecordGameResultInput,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (!Number.isFinite(input.ourScore) || !Number.isFinite(input.opponentScore)) {
    return { error: "Both scores are required." };
  }
  if (input.ourScore < 0 || input.opponentScore < 0) {
    return { error: "Scores can't be negative." };
  }
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("games")
    .update({
      status: "completed",
      our_score: input.ourScore,
      opponent_score: input.opponentScore,
      recap_notes: input.recapNotes?.trim() || null,
      completed_at: new Date().toISOString(),
      completed_by: coach.id,
    })
    .eq("id", input.gameId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };

  revalidatePath(`/app/games/${input.gameId}`);
  revalidatePath("/app/games");
  revalidatePath("/app/schedule");
  revalidatePath("/app");
  return { error: null };
}

/**
 * clearGameResultAction — un-complete a game. Used if the coach
 * recorded the wrong score or needs to re-record.
 */
export async function clearGameResultAction(
  gameId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("games")
    .update({
      status: "scheduled",
      our_score: null,
      opponent_score: null,
      recap_notes: null,
      completed_at: null,
      completed_by: null,
    })
    .eq("id", gameId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };

  revalidatePath(`/app/games/${gameId}`);
  revalidatePath("/app");
  return { error: null };
}

// ── Game prep ────────────────────────────────────────────────────

export interface UpdateGamePrepInput {
  gameId: string;
  reportTime: string | null; // "HH:MM" or null
  releaseTime: string | null;
  uniform: string | null;
  equipmentNotes: string | null;
  lineupPreview: string | null;
  prepNotes: string | null;
}

/**
 * updateGamePrepAction — save coach-authored prep details for a game.
 * Shown to players on /me + /p/[handle] so they can plan uniforms,
 * arrival, early release from school, etc.
 */
export async function updateGamePrepAction(
  input: UpdateGamePrepInput,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  // Convert "14:30" → "14:30:00" for PostgreSQL time columns
  const normalizeTime = (t: string | null): string | null => {
    if (!t) return null;
    const trimmed = t.trim();
    if (!trimmed) return null;
    return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
  };
  const { error } = await supabase
    .from("games")
    .update({
      report_time: normalizeTime(input.reportTime),
      release_time: normalizeTime(input.releaseTime),
      uniform: input.uniform?.trim() || null,
      equipment_notes: input.equipmentNotes?.trim() || null,
      lineup_preview: input.lineupPreview?.trim() || null,
      prep_notes: input.prepNotes?.trim() || null,
    })
    .eq("id", input.gameId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };

  revalidatePath(`/app/games/${input.gameId}`);
  revalidatePath("/me");
  revalidatePath("/app");
  return { error: null };
}

export async function deleteGameAction(gameId: string): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
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
