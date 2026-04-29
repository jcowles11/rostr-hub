import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Coach + program context for the signed-in user.
 * Mirrors the Vite app's AuthContext lookup: coaches row joined to programs,
 * filtered by user_id.
 */
export interface CoachContext {
  id: string;
  /** Auth user id — same as supabase.auth.getUser().id. Useful for "is
   *  this me?" checks in UI (e.g. don't let me delete myself). */
  user_id: string;
  program_id: string;
  full_name: string;
  role: "head_coach" | "assistant_coach";
  /** Multi-team scope (added in migration 000029):
   *   - 'organization' → AD-style; can see all programs in the org
   *   - 'program'      → traditional head coach; full program access
   *   - 'team'         → assigned to one team within the program
   *  Existing rows default to 'program' so legacy single-coach setups
   *  keep working unchanged.
   */
  scope: "organization" | "program" | "team";
  /** When scope='team', the team this coach manages. */
  team_id: string | null;
  /** Set for any coach whose program is part of an organization. */
  organization_id: string | null;
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

  // Try the full SELECT including new scope columns. Fall back to the
  // legacy SELECT if migration 000029 hasn't been applied yet, so the
  // service keeps working on pre-migration databases.
  let row: Record<string, unknown> | null = null;
  const tryFull = await supabase
    .from("coaches")
    .select(
      "id, user_id, program_id, full_name, role, scope, team_id, organization_id, programs (name, levels, sport, logo_url)",
    )
    .eq("user_id", user.id)
    .limit(1);
  if (
    tryFull.error &&
    /column .* (scope|team_id|organization_id) .* does not exist/i.test(tryFull.error.message)
  ) {
    const fallback = await supabase
      .from("coaches")
      .select(
        "id, user_id, program_id, full_name, role, programs (name, levels, sport, logo_url)",
      )
      .eq("user_id", user.id)
      .limit(1);
    row = (fallback.data?.[0] ?? null) as Record<string, unknown> | null;
  } else if (!tryFull.error) {
    row = (tryFull.data?.[0] ?? null) as Record<string, unknown> | null;
  }
  if (!row) return null;

  const programs = row.programs as unknown as {
    name: string;
    levels: string[] | null;
    sport: string | null;
    logo_url: string | null;
  } | null;

  const { count: playerCount } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("program_id", row.program_id as string);

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    program_id: row.program_id as string,
    full_name: row.full_name as string,
    role: row.role as CoachContext["role"],
    scope: ((row.scope as string | undefined) ?? "program") as CoachContext["scope"],
    team_id: (row.team_id as string | null | undefined) ?? null,
    organization_id: (row.organization_id as string | null | undefined) ?? null,
    program_name: programs?.name ?? "My Program",
    program_levels: programs?.levels ?? ["Varsity", "JV", "Freshman"],
    program_sport: programs?.sport ?? null,
    program_logo_url: programs?.logo_url ?? null,
    player_count: playerCount ?? 0,
  };
}
