import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Upcoming games and practices for a program.
 * Reads from the existing Supabase schema: games + practice_plans.
 */

export interface UpcomingGame {
  id: string;
  date: string; // ISO
  opponent: string;
  home: boolean;
  location: string | null;
  status: string;
  level: string | null;
}

export interface UpcomingPractice {
  id: string;
  date: string;
  title: string;
  level: string | null;
}

export async function fetchUpcomingGames(programId: string): Promise<UpcomingGame[]> {
  const supabase = createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("games")
    .select("id, name, opponent, game_date, game_time, location, status, team_level")
    .eq("program_id", programId)
    .gte("game_date", today)
    .order("game_date", { ascending: true });

  if (error || !data) return [];
  return data.map((g) => ({
    id: g.id,
    date: g.game_date,
    opponent: g.opponent ?? g.name,
    home: true, // schema doesn't track home/away in a dedicated column; leave optimistic
    location: g.location,
    status: g.status ?? "scheduled",
    level: g.team_level,
  }));
}

export async function fetchUpcomingPractices(programId: string): Promise<UpcomingPractice[]> {
  const supabase = createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("practice_plans")
    .select("id, title, practice_date, team_level")
    .eq("program_id", programId)
    .gte("practice_date", today)
    .order("practice_date", { ascending: true });

  if (error || !data) return [];
  return data.map((p) => ({
    id: p.id,
    date: p.practice_date,
    title: p.title,
    level: p.team_level,
  }));
}
