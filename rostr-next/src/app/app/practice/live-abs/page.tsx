import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Play,
  Plus,
  Trophy,
  Snowflake,
  Flame,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { getCurrentCoach } from "@/lib/services/coach";
import {
  fetchPracticeSessions,
  fetchHitterSessionStats,
  fetchPitcherSessionStats,
} from "@/lib/services/live-abs";
import { fetchRoster } from "@/lib/services/players";
import { LiveAbsListView } from "./list-view";

/**
 * /app/practice/live-abs — preseason at-bat tracking.
 *
 * Two columns:
 *   - Sessions list (left) — past + open sessions, "+ New session" button
 *   - Roster decision view (right) — aggregated hitter + pitcher stats
 *     across ALL sessions, sorted to highlight standouts
 *
 * Distinct from official game stats — this powers preseason roster
 * decisions and stays out of season-long stat lines.
 */
export default async function LiveAbsPage() {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/app/setup");

  const [sessions, hitters, pitchers, roster] = await Promise.all([
    fetchPracticeSessions(coach.program_id, "live_abs", 30),
    fetchHitterSessionStats(coach.program_id),
    fetchPitcherSessionStats(coach.program_id),
    fetchRoster(coach.program_id),
  ]);

  // Build a player_id → display info map for the leaderboards
  const playerById = new Map<
    string,
    { name: string; jersey: number | null; positions: string[] }
  >();
  for (const p of roster) {
    playerById.set(p.id, {
      name: `${p.firstName} ${p.lastName}`,
      jersey: p.jerseyNumber ?? null,
      positions: p.positions,
    });
  }

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: coach.program_name },
          { label: "Practice", href: "/app/practice" },
          { label: "Live at-bats" },
        ]}
      />
      <LiveAbsListView
        sessions={sessions}
        hitters={hitters}
        pitchers={pitchers}
        playerById={Object.fromEntries(playerById)}
      />
    </>
  );
}
