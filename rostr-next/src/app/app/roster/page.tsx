import { RosterView } from "./roster-view";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchRoster } from "@/lib/services/players";
import { MOCK_PLAYERS, type MockPlayer } from "@/lib/mock-data";

/**
 * /app/roster — server shell.
 * Loads the signed-in coach's roster from Supabase when possible;
 * falls back to MOCK_PLAYERS so freshly-signed-up accounts still see
 * a populated UI while they set up their program.
 */
export default async function RosterPage() {
  const coach = await getCurrentCoach();
  let players: MockPlayer[] = MOCK_PLAYERS;
  if (coach) {
    const real = await fetchRoster(coach.program_id);
    if (real.length > 0) {
      // RealPlayer is shape-compatible with MockPlayer — cast directly.
      players = real as unknown as MockPlayer[];
    }
  }
  return <RosterView players={players} />;
}
