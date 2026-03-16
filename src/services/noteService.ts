/**
 * Note Service
 *
 * Extracts player note/flag queries from page components.
 * Used by: Dashboard.tsx, PlayerDetail.tsx
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────

export interface PlayerFlag {
  player_id: string;
  flag: string;
}

export interface PlayerNote {
  id: string;
  content: string;
  flag: string | null;
  coach_id: string;
  created_at: string;
}

// ── Queries ────────────────────────────────────────────────────────

/** Fetch notes for a specific player (PlayerDetail). */
export async function fetchPlayerNotes(playerId: string): Promise<{ data: PlayerNote[]; error: string | null }> {
  const { data, error } = await supabase
    .from("player_notes")
    .select("id, content, flag, coach_id, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as PlayerNote[], error: null };
}

/** Fetch all player flags (standout, concern, needs_second_look) for a program. */
export async function fetchPlayerFlags(programId: string): Promise<{ data: PlayerFlag[]; error: string | null }> {
  const { data, error } = await supabase
    .from("player_notes")
    .select("player_id, flag")
    .eq("program_id", programId)
    .not("flag", "is", null);

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as PlayerFlag[], error: null };
}

// ── Mutations ──────────────────────────────────────────────────────

/** Create a new player note. */
export async function createNote(input: {
  program_id: string;
  player_id: string;
  coach_id: string;
  content: string;
  flag: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("player_notes").insert({
    program_id: input.program_id,
    player_id: input.player_id,
    coach_id: input.coach_id,
    content: input.content,
    flag: input.flag,
  });
  return { error: error?.message ?? null };
}
