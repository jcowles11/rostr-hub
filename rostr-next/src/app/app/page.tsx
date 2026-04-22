import { HubView } from "./hub-view";
import { getSessionUser, displayName } from "@/lib/auth";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchRoster } from "@/lib/services/players";
import { fetchUpcomingGames, fetchUpcomingPractices } from "@/lib/services/schedule";
import {
  MOCK_PLAYERS,
  MOCK_TEAM,
  MOCK_WEEK,
  type MockPlayer,
  type MockScheduleItem,
} from "@/lib/mock-data";

/**
 * /app — Coach Hub server shell.
 * Loads coach + program + upcoming schedule from Supabase and passes them
 * to <HubView />. Falls back to mock when the signed-in user has no
 * coach record yet, so fresh accounts still see a populated demo until
 * they run /app/setup.
 */
export default async function HubPage() {
  const [user, coach] = await Promise.all([getSessionUser(), getCurrentCoach()]);

  let players: MockPlayer[] = MOCK_PLAYERS;
  let weekItems: MockScheduleItem[] = MOCK_WEEK;
  let nextGame: {
    id: string;
    opponent: string;
    dateLabel: string;
    timeLabel: string;
    location: string;
  } | null = null;

  if (coach) {
    const [roster, games, practices] = await Promise.all([
      fetchRoster(coach.program_id),
      fetchUpcomingGames(coach.program_id),
      fetchUpcomingPractices(coach.program_id),
    ]);

    if (roster.length > 0) {
      players = roster as unknown as MockPlayer[];
    }

    const realWeek: MockScheduleItem[] = [];
    for (const g of games.slice(0, 5)) {
      realWeek.push({
        date: isoToDateParts(g.date),
        title: `vs ${g.opponent}`,
        sub: g.location ?? "",
        tag: "GAME",
      });
    }
    for (const p of practices.slice(0, 5)) {
      realWeek.push({
        date: isoToDateParts(p.date),
        title: p.title,
        sub: p.level ?? "All levels",
        tag: "PRAC",
      });
    }
    if (realWeek.length > 0) {
      realWeek.sort((a, b) => a.date.day - b.date.day);
      weekItems = realWeek;
    }

    if (games[0]) {
      const parts = isoToDateParts(games[0].date);
      nextGame = {
        id: games[0].id,
        opponent: games[0].opponent,
        dateLabel: `${parts.month} ${parts.day}`,
        timeLabel: "",
        location: games[0].location ?? "—",
      };
    }
  }

  const name = coach?.full_name ?? displayName(user) ?? "Coach";
  const programName = coach?.program_name ?? MOCK_TEAM.name;
  const playerCount = coach?.player_count ?? MOCK_PLAYERS.length;

  return (
    <HubView
      greetingName={name}
      programName={programName}
      nextGame={nextGame}
      weekItems={weekItems}
      availabilityPlayers={players}
      playerCount={playerCount}
    />
  );
}

function isoToDateParts(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return {
    day: d.getDate(),
    month: d.toLocaleString("en-US", { month: "short" }),
    weekday: d.toLocaleString("en-US", { weekday: "short" }),
  };
}
