import { GamesView, type Game } from "./games-view";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchUpcomingGames } from "@/lib/services/schedule";

/**
 * /app/games — Games list, server shell.
 * Pulls upcoming games from Supabase when a coach record exists, otherwise
 * falls back to the mock demo schedule.
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
  let games = DEMO_GAMES;
  if (coach) {
    const real = await fetchUpcomingGames(coach.program_id);
    if (real.length > 0) {
      games = real.map((g): Game => {
        const d = new Date(g.date + "T00:00:00");
        return {
          id: g.id,
          date: {
            day: d.getDate(),
            month: d.toLocaleString("en-US", { weekday: "short" }),
          },
          time: "",
          opponent: g.opponent,
          home: g.home,
          location: g.location ?? "",
          status: g.status === "final" ? "final" : "upcoming",
          tag: undefined,
        };
      });
    }
  }
  return <GamesView games={games} />;
}
