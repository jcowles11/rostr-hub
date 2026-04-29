import { redirect } from "next/navigation";
import { getCurrentCoach } from "@/lib/services/coach";
import {
  fetchHitterStatsByKind,
  fetchPitcherStatsByKind,
  type StatsKindFilter,
} from "@/lib/services/live-abs";
import { LiveAbsStatsView } from "./stats-view";

/**
 * /app/practice/live-abs/stats — coach stats dashboard for at-bat
 * tracking sessions. Combines Live ABs + Intrasquad data with a
 * client-side filter pill so coaches can:
 *   - See team performance across both contexts (default)
 *   - Drill into preseason cage work alone (Live ABs only)
 *   - Drill into scrimmage performance alone (Intrasquad only)
 *
 * Pre-fetches all three slices server-side so flipping the filter is
 * instant. Volumes are HS-varsity small (<2k ABs / season) so this is
 * comfortably within a single SSR pass.
 */

const VALID_FILTERS: StatsKindFilter[] = ["all", "live_abs", "intrasquad"];

export default async function LiveAbsStatsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/app/setup");

  const initialFilter: StatsKindFilter = VALID_FILTERS.includes(
    searchParams.filter as StatsKindFilter,
  )
    ? (searchParams.filter as StatsKindFilter)
    : "all";

  // Fetch all three views in parallel so the client can flip the
  // filter pill without any further round-trips.
  const [hittersAll, hittersLiveAbs, hittersIntrasquad, pitchersAll, pitchersLiveAbs, pitchersIntrasquad] =
    await Promise.all([
      fetchHitterStatsByKind(coach.program_id, "all"),
      fetchHitterStatsByKind(coach.program_id, "live_abs"),
      fetchHitterStatsByKind(coach.program_id, "intrasquad"),
      fetchPitcherStatsByKind(coach.program_id, "all"),
      fetchPitcherStatsByKind(coach.program_id, "live_abs"),
      fetchPitcherStatsByKind(coach.program_id, "intrasquad"),
    ]);

  return (
    <LiveAbsStatsView
      programName={coach.program_name}
      initialFilter={initialFilter}
      hittersAll={hittersAll}
      hittersLiveAbs={hittersLiveAbs}
      hittersIntrasquad={hittersIntrasquad}
      pitchersAll={pitchersAll}
      pitchersLiveAbs={pitchersLiveAbs}
      pitchersIntrasquad={pitchersIntrasquad}
    />
  );
}
