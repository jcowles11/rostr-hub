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

export interface UpdatePlayerInput {
  id: string;
  firstName: string;
  lastName: string;
  grade?: number | null;
  positions: string[];
  bats?: "L" | "R" | "S" | null;
  throws?: "L" | "R" | null;
  playerNumber?: number | null;
}

export async function updatePlayerAction(
  input: UpdatePlayerInput,
): Promise<{ error: string | null }> {
  if (!input.firstName.trim() || !input.lastName.trim()) {
    return { error: "First and last name are required." };
  }
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("players")
    .update({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      grade: input.grade ?? null,
      positions: input.positions.length > 0 ? input.positions : [],
      bats: input.bats ?? null,
      throws: input.throws ?? null,
      player_number: input.playerNumber ?? null,
    })
    .eq("id", input.id)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null };
}

export async function deletePlayerAction(playerId: string): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", playerId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null };
}

/**
 * bulkSetPlayerLevelAction — apply a level to many players at once.
 * Used by the Roster bulk toolbar.
 */
export async function bulkSetPlayerLevelAction(
  playerIds: string[],
  level: "varsity" | "jv" | "freshman" | "cut" | null,
): Promise<{ error: string | null; updated: number }> {
  if (playerIds.length === 0) return { error: null, updated: 0 };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program.", updated: 0 };
  const supabase = createSupabaseServerClient();

  if (level === null) {
    const { error } = await supabase
      .from("roster_assignments")
      .delete()
      .in("player_id", playerIds)
      .eq("program_id", coach.program_id);
    if (error) return { error: error.message, updated: 0 };
  } else {
    const rows = playerIds.map((pid) => ({
      player_id: pid,
      program_id: coach.program_id,
      assignment: level,
    }));
    const { error } = await supabase
      .from("roster_assignments")
      .upsert(rows, { onConflict: "player_id,program_id" });
    if (error) return { error: error.message, updated: 0 };
  }
  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null, updated: playerIds.length };
}

/**
 * setPlayerLevelAction — upsert a single roster_assignments row.
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

export interface BulkPlayer {
  firstName: string;
  lastName: string;
  grade?: number | null;
  positions?: string[];
  bats?: "L" | "R" | "S" | null;
  throws?: "L" | "R" | null;
  playerNumber?: number | null;
}

/**
 * bulkCreatePlayersAction — insert many player rows at once.
 * Returns inserted + skipped counts. Skips rows with duplicate
 * (firstName + lastName) against the existing roster, case-insensitive.
 */
export async function bulkCreatePlayersAction(
  rows: BulkPlayer[],
): Promise<{ error: string | null; inserted: number; skipped: number }> {
  if (rows.length === 0) return { error: "No rows to import.", inserted: 0, skipped: 0 };

  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program.", inserted: 0, skipped: 0 };

  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("players")
    .select("first_name, last_name")
    .eq("program_id", coach.program_id);
  const seen = new Set(
    (existing ?? []).map(
      (p: { first_name: string; last_name: string }) =>
        `${p.first_name.trim().toLowerCase()}|${p.last_name.trim().toLowerCase()}`,
    ),
  );

  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const r of rows) {
    if (!r.firstName?.trim() || !r.lastName?.trim()) {
      skipped++;
      continue;
    }
    const key = `${r.firstName.trim().toLowerCase()}|${r.lastName.trim().toLowerCase()}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    toInsert.push({
      program_id: coach.program_id,
      first_name: r.firstName.trim(),
      last_name: r.lastName.trim(),
      grade: r.grade ?? null,
      positions: r.positions && r.positions.length > 0 ? r.positions : [],
      bats: r.bats ?? null,
      throws: r.throws ?? null,
      player_number: r.playerNumber ?? null,
    });
  }

  if (toInsert.length === 0) {
    revalidatePath("/app/roster");
    return { error: null, inserted: 0, skipped };
  }

  const { error } = await supabase.from("players").insert(toInsert);
  if (error) return { error: error.message, inserted: 0, skipped };

  revalidatePath("/app/roster");
  revalidatePath("/app");
  return { error: null, inserted: toInsert.length, skipped };
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
