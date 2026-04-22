import { RosterView } from "./roster-view";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchRoster } from "@/lib/services/players";
import { MOCK_PLAYERS, type MockPlayer } from "@/lib/mock-data";

const DEMO_LEVELS = ["Varsity", "JV", "Freshman"];

export default async function RosterPage() {
  const coach = await getCurrentCoach();
  let players: MockPlayer[] = MOCK_PLAYERS;
  const levels = coach?.program_levels ?? DEMO_LEVELS;

  if (coach) {
    const real = await fetchRoster(coach.program_id, levels);
    if (real.length > 0) players = real as unknown as MockPlayer[];
  }

  return <RosterView players={players} levels={levels} />;
}
