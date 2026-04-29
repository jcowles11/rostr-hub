import { RosterView } from "./roster-view";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchRoster } from "@/lib/services/players";
import { fetchRosterBattingStats, type RosterBattingMap } from "@/lib/services/batting-stats";
import { MOCK_PLAYERS, type MockPlayer } from "@/lib/mock-data";

const DEMO_LEVELS = ["Varsity", "JV", "Freshman"];

/**
 * /app/roster — the coach's live roster.
 *
 * Data policy:
 *   - If the signed-in user has a coach record → show their REAL roster.
 *     If the roster is empty, we pass an empty array — NOT mock data.
 *     Real coaches should never see Lincoln HS demo players on their
 *     own program (that was an early-prototype shortcut and has been
 *     removed).
 *   - If no coach record exists yet (unauthenticated preview), we fall
 *     back to MOCK_PLAYERS so the marketing demo still looks alive.
 */
export default async function RosterPage() {
  const coach = await getCurrentCoach();
  let players: MockPlayer[] = [];
  const levels = coach?.program_levels ?? DEMO_LEVELS;
  let battingByPlayer: RosterBattingMap = {};

  if (coach) {
    const [real, batting] = await Promise.all([
      fetchRoster(coach.program_id, levels),
      fetchRosterBattingStats(coach.program_id),
    ]);
    players = real as unknown as MockPlayer[];
    battingByPlayer = batting;
  } else {
    // Not a coach — marketing/demo fallback
    players = MOCK_PLAYERS;
  }

  return (
    <RosterView
      players={players}
      levels={levels}
      battingByPlayer={battingByPlayer}
      programName={coach?.program_name ?? "Rostr"}
    />
  );
}
