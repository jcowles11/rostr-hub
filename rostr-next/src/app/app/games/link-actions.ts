"use server";

import { getCurrentCoach } from "@/lib/services/coach";
import {
  searchProgramsByName,
  type ProgramLookupResult,
} from "@/lib/services/live-scoring";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * searchProgramsAction — for the Link Opponent modal.
 * Server action wrapping searchProgramsByName, scoped to exclude the
 * current coach's own program.
 */
export async function searchProgramsAction(
  query: string,
  gameId: string,
): Promise<ProgramLookupResult[]> {
  const coach = await getCurrentCoach();
  if (!coach) return [];
  // We need the game's program_id to exclude self — but we can also
  // just use the coach's program_id since games are per-program.
  const supabase = createSupabaseServerClient();
  const { data: game } = await supabase
    .from("games")
    .select("program_id")
    .eq("id", gameId)
    .maybeSingle();
  const excludeId = game?.program_id ?? coach.program_id;
  return searchProgramsByName(query, excludeId, 10);
}
