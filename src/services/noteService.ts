/**
 * Note Service
 *
 * Extracts player note/flag queries from page components.
 * Used by: Dashboard.tsx
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────

export interface PlayerFlag {
  player_id: string;
  flag: string;
}

// ── Queries ────────────────────────────────────────────────────────

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
