import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Coach + program context for the signed-in user.
 * Mirrors the Vite app's AuthContext lookup: coaches row joined to programs,
 * filtered by user_id.
 */
export interface CoachContext {
  id: string;
  program_id: string;
  full_name: string;
  role: "head_coach" | "assistant_coach";
  program_name: string;
  program_levels: string[];
  program_sport: string | null;
  program_logo_url: string | null;
  player_count: number;
}

/**
 * Returns the coach record (if any) for the currently-signed-in user.
 * Returns null if no auth user, or if the user has no coach record yet
 * (e.g. fresh signup who hasn't set up a program).
 */
export async function getCurrentCoach(): Promise<CoachContext | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: coaches } = await supabase
    .from("coaches")
    .select(
      "id, program_id, full_name, role, programs (name, levels, sport, logo_url)",
    )
    .eq("user_id", user.id)
    .limit(1);

  const coach = coaches?.[0];
  if (!coach) return null;

  const programs = coach.programs as unknown as {
    name: string;
    levels: string[] | null;
    sport: string | null;
    logo_url: string | null;
  } | null;

  const { count: playerCount } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("program_id", coach.program_id);

  return {
    id: coach.id,
    program_id: coach.program_id,
    full_name: coach.full_name,
    role: coach.role,
    program_name: programs?.name ?? "My Program",
    program_levels: programs?.levels ?? ["Varsity", "JV", "Freshman"],
    program_sport: programs?.sport ?? null,
    program_logo_url: programs?.logo_url ?? null,
    player_count: playerCount ?? 0,
  };
}
