import { ScheduleView, type ScheduleEvent } from "./schedule-view";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchUpcomingGames, fetchUpcomingPractices } from "@/lib/services/schedule";

/**
 * /app/schedule — coach's week view of real games + practices.
 *
 * PHASE 2.2 — removed the DEMO_WEEK fallback (Lincoln HS / Central
 * Hawks / Westfield Panthers fictional rows). Real coaches were seeing
 * those rows when their schedule was empty, then assuming the games
 * were real and trying to score them. Now: empty real schedule →
 * empty array → ScheduleView renders an empty state with an "Add"
 * CTA. Demo prospects still see a populated mock via /demo/schedule
 * (separate route, separate data source).
 */
function iso(d: string) {
  const date = new Date(d + "T00:00:00");
  return {
    day: date.getDate(),
    month: date.toLocaleString("en-US", { month: "short" }),
    weekday: date.toLocaleString("en-US", { weekday: "short" }),
  };
}

export default async function SchedulePage() {
  const coach = await getCurrentCoach();
  let week: ScheduleEvent[] = [];
  if (coach) {
    const [games, practices] = await Promise.all([
      fetchUpcomingGames(coach.program_id),
      fetchUpcomingPractices(coach.program_id),
    ]);
    week = [
      ...games.map((g): ScheduleEvent => ({
        id: g.id,
        kind: "game",
        date: iso(g.date),
        isoDate: g.date,
        isoTime: null,
        time: "",
        title: `vs ${g.opponent}`,
        sub: g.location ?? "",
        opponent: g.opponent,
        location: g.location,
        href: `/app/games/${g.id}`,
      })),
      ...practices.map((p): ScheduleEvent => ({
        id: p.id,
        kind: "practice",
        date: iso(p.date),
        isoDate: p.date,
        isoTime: null,
        time: "",
        title: p.title,
        sub: p.level ?? "All levels",
        opponent: null,
        location: null,
        href: `/app/practice`,
      })),
    ].sort((a, b) => a.date.day - b.date.day);
  }
  return <ScheduleView week={week} />;
}
