import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface GameDetail {
  id: string;
  name: string;
  opponent: string | null;
  gameDate: string;
  gameTime: string | null;
  location: string | null;
  homeAway: string;
  teamLevel: string | null;
  status: string;
}

export interface GameRosterEntry {
  playerId: string;
  status: string;
}

export interface LineupEntryRecord {
  playerId: string;
  battingOrder: number;
  position: string;
}

export async function fetchGameDetail(gameId: string): Promise<{
  game: GameDetail | null;
  rosterPlayerIds: string[];
  lineup: LineupEntryRecord[];
}> {
  const supabase = createSupabaseServerClient();
  const [gameRes, rosterRes, lineupRes] = await Promise.all([
    supabase
      .from("games")
      .select(
        "id, name, opponent, game_date, game_time, location, home_away, team_level, status",
      )
      .eq("id", gameId)
      .maybeSingle(),
    supabase
      .from("game_rosters")
      .select("player_id, status")
      .eq("game_id", gameId),
    supabase
      .from("lineup_entries")
      .select("player_id, batting_order, position")
      .eq("game_id", gameId)
      .order("batting_order", { ascending: true }),
  ]);

  if (gameRes.error || !gameRes.data) {
    return { game: null, rosterPlayerIds: [], lineup: [] };
  }

  return {
    game: {
      id: gameRes.data.id,
      name: gameRes.data.name,
      opponent: gameRes.data.opponent,
      gameDate: gameRes.data.game_date,
      gameTime: gameRes.data.game_time,
      location: gameRes.data.location,
      homeAway: gameRes.data.home_away ?? "home",
      teamLevel: gameRes.data.team_level,
      status: gameRes.data.status ?? "scheduled",
    },
    rosterPlayerIds: (rosterRes.data ?? []).map((r) => r.player_id),
    lineup: (lineupRes.data ?? []).map((l) => ({
      playerId: l.player_id,
      battingOrder: l.batting_order,
      position: l.position,
    })),
  };
}
