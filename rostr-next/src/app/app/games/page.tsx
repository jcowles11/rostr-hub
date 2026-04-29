import { GamesView, type Game } from "./games-view";
import { getCurrentCoach } from "@/lib/services/coach";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * /app/games — Games list, server shell.
 *
 * For the unauthenticated demo, falls back to a mock schedule with
 * placeholder IDs (the demo route at /demo/games has its own renderer
 * that uses these same shapes via getMockGames()).
 *
 * For a signed-in coach: fetches their full game list (past + future)
 * directly. Critically, does NOT fall back to DEMO_GAMES when the list
 * is empty — those rows have fake IDs like "g1" that 404 when clicked.
 * Empty list → GamesView renders its empty state with a "schedule
 * your first game" CTA.
 */
const DEMO_GAMES: Game[] = [
  { id: "g1", date: { day: 24, month: "Fri" }, time: "5:00 PM", opponent: "Central Hawks", home: true, location: "Lincoln HS · Main", status: "upcoming", tag: "conference" },
  { id: "g2", date: { day: 25, month: "Sat" }, time: "1:00 PM", opponent: "Westfield Panthers", home: false, location: "Westfield HS", status: "upcoming", tag: "conference" },
  { id: "g3", date: { day: 28, month: "Tue" }, time: "4:30 PM", opponent: "Eastside Eagles", home: true, location: "Lincoln HS · Main", status: "upcoming" },
  { id: "g4", date: { day: 2, month: "Fri" }, time: "5:00 PM", opponent: "Ridgewood Prep", home: false, location: "Ridgewood", status: "upcoming", tag: "conference" },
  { id: "g5", date: { day: 20, month: "Mon" }, time: "", opponent: "Oakridge", home: true, location: "Lincoln HS · Main", status: "final", result: { us: 7, them: 4 } },
  { id: "g6", date: { day: 17, month: "Fri" }, time: "", opponent: "Meridian", home: false, location: "Meridian HS", status: "final", result: { us: 6, them: 3 }, tag: "conference" },
  { id: "g7", date: { day: 14, month: "Tue" }, time: "", opponent: "Sun Valley", home: true, location: "Lincoln HS · Main", status: "final", result: { us: 3, them: 5 }, tag: "conference" },
];

export default async function GamesPage() {
  const coach = await getCurrentCoach();
  if (!coach) {
    // Unauthenticated landing → demo placeholders. Their fake IDs only
    // live inside this list; clicking one is fine because /app/games/[id]
    // renders a demo fallback when no coach exists.
    return <GamesView games={DEMO_GAMES} />;
  }

  // Real coach: fetch their full slate (past + future) so they see
  // everything they've scheduled. No fake-ID fallback.
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, name, opponent, game_date, game_time, location, home_away, team_level, status, our_score, opponent_score, result")
    .eq("program_id", coach.program_id)
    .order("game_date", { ascending: false });

  const rows = error || !data ? [] : data;
  const games: Game[] = rows.map((g): Game => {
    const d = new Date((g.game_date as string) + "T00:00:00");
    const isFinal = (g.status ?? "scheduled") === "completed" || g.our_score !== null;
    const us = (g.our_score as number | null) ?? null;
    const them = (g.opponent_score as number | null) ?? null;
    return {
      id: g.id as string,
      date: {
        day: d.getDate(),
        month: d.toLocaleString("en-US", { weekday: "short" }),
      },
      time: g.game_time ? (g.game_time as string).slice(0, 5) : "",
      opponent: (g.opponent as string | null) ?? (g.name as string | null) ?? "Opponent TBD",
      home: ((g.home_away as string | null) ?? "home") === "home",
      location: (g.location as string | null) ?? "",
      status: isFinal ? "final" : "upcoming",
      result: isFinal && us !== null && them !== null ? { us, them } : undefined,
      tag: undefined,
    };
  });

  return <GamesView games={games} />;
}
