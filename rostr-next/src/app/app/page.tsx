import { HubView } from "./hub-view";
import { getSessionUser, displayName } from "@/lib/auth";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchRoster } from "@/lib/services/players";
import { fetchUpcomingGames, fetchUpcomingPractices } from "@/lib/services/schedule";
import { fetchProgramRecord, type ProgramRecord } from "@/lib/services/game";
import { fetchRecentActivity, fetchSpotlight, type ActivityEvent, type SpotlightPlayer } from "@/lib/services/activity";
import { fetchInbox, type InboxThread } from "@/lib/services/messaging";
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

  // Data policy:
  //   - Real coach → pull real data. Empty collections render empty
  //     states in the UI, NOT Lincoln HS demo content.
  //   - Anonymous preview (no coach row yet) → show MOCK_* for the
  //     marketing demo.
  const isDemo = !coach;

  let players: MockPlayer[] = isDemo ? MOCK_PLAYERS : [];
  let weekItems: MockScheduleItem[] = isDemo ? MOCK_WEEK : [];
  let nextGame: {
    id: string;
    opponent: string;
    dateLabel: string;
    timeLabel: string;
    location: string;
  } | null = null;

  let activity: ActivityEvent[] = [];
  let spotlight: SpotlightPlayer | null = null;
  let inboxThreads: InboxThread[] = [];
  let record: ProgramRecord | null = null;

  if (coach) {
    const [roster, games, practices, activityData, spotlightData, inboxData, recordData] = await Promise.all([
      fetchRoster(coach.program_id),
      fetchUpcomingGames(coach.program_id),
      fetchUpcomingPractices(coach.program_id),
      fetchRecentActivity(coach.program_id),
      fetchSpotlight(coach.program_id),
      fetchInbox(),
      fetchProgramRecord(coach.program_id),
    ]);
    activity = activityData;
    spotlight = spotlightData;
    inboxThreads = inboxData;
    record = recordData;

    players = roster as unknown as MockPlayer[];

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
    realWeek.sort((a, b) => a.date.day - b.date.day);
    weekItems = realWeek;

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
  const playerCount = coach?.player_count ?? (isDemo ? MOCK_PLAYERS.length : players.length);

  return (
    <HubView
      greetingName={name}
      programName={programName}
      nextGame={nextGame}
      weekItems={weekItems}
      availabilityPlayers={players}
      playerCount={playerCount}
      activity={activity}
      spotlight={spotlight}
      inboxThreads={inboxThreads}
      record={record}
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
