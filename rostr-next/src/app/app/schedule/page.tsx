import { ScheduleView, type ScheduleEvent } from "./schedule-view";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchUpcomingGames, fetchUpcomingPractices } from "@/lib/services/schedule";

const DEMO_WEEK: ScheduleEvent[] = [
  { id: "p1", kind: "practice", date: { day: 22, month: "Apr", weekday: "Wed" }, time: "3:30 PM", title: "Full practice · Situational hitting + bullpens", sub: "Main field + Cage 2 · 22 players · Coach Ruiz", href: "/app/practice" },
  { id: "p2", kind: "practice", date: { day: 23, month: "Apr", weekday: "Thu" }, time: "3:30 PM", title: "Light BP + pregame prep", sub: "Main field · 90 min · Coach Ruiz", href: "/app/practice" },
  { id: "g1", kind: "game", date: { day: 24, month: "Apr", weekday: "Fri" }, time: "5:00 PM", title: "vs Central Hawks · Conference", sub: "Home · Bus: none", emphasis: true, href: "/app/games/g1" },
  { id: "g2", kind: "game", date: { day: 25, month: "Apr", weekday: "Sat" }, time: "1:00 PM", title: "@ Westfield Panthers", sub: "Away · Bus 11:15 · Westfield HS", href: "/app/games/g2" },
  { id: "p3", kind: "practice", date: { day: 27, month: "Apr", weekday: "Mon" }, time: "3:30 PM", title: "Full practice · Defense & baserunning", sub: "Main field · 2h · Coach Park", href: "/app/practice" },
  { id: "g3", kind: "game", date: { day: 28, month: "Apr", weekday: "Tue" }, time: "4:30 PM", title: "vs Eastside Eagles", sub: "Home", href: "/app/games/g3" },
  { id: "p4", kind: "practice", date: { day: 29, month: "Apr", weekday: "Wed" }, time: "3:30 PM", title: "Light practice + scouting review", sub: "Main field · Coach Ruiz", href: "/app/practice" },
];

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
  let week = DEMO_WEEK;
  if (coach) {
    const [games, practices] = await Promise.all([
      fetchUpcomingGames(coach.program_id),
      fetchUpcomingPractices(coach.program_id),
    ]);
    const real: ScheduleEvent[] = [
      ...games.map((g): ScheduleEvent => ({
        id: g.id,
        kind: "game",
        date: iso(g.date),
        time: "",
        title: `vs ${g.opponent}`,
        sub: g.location ?? "",
        href: `/app/games/${g.id}`,
      })),
      ...practices.map((p): ScheduleEvent => ({
        id: p.id,
        kind: "practice",
        date: iso(p.date),
        time: "",
        title: p.title,
        sub: p.level ?? "All levels",
        href: `/app/practice`,
      })),
    ].sort((a, b) => a.date.day - b.date.day);
    if (real.length > 0) week = real;
  }
  return <ScheduleView week={week} />;
}
