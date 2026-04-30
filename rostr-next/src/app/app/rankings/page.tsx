import { redirect } from "next/navigation";
import { getCurrentCoach } from "@/lib/services/coach";
import {
  getPlayerRankings,
  type ScoringMode,
  type RankingsFilters,
} from "@/lib/services/rankings";
import { RankingsView } from "./rankings-view";

/**
 * /app/rankings — coach-facing player rankings.
 *
 * Server component that drives the rankings engine off URL state so
 * filter changes are shareable + back-button friendly. The client view
 * pushes new query strings; the server re-runs the engine on each
 * request with fresh filters.
 *
 * Data flow:
 *   URL → searchParams → RankingsFilters
 *   getCurrentCoach() → programId
 *   getPlayerRankings(programId, mode, filters) → response
 *   <RankingsView response={...} />
 *
 * No nav link is added in this iteration — coaches reach this page by
 * direct URL until the surface has been validated. That keeps the
 * pilot's existing flows undisturbed.
 *
 * Auth gate: coach context required. /me/profile-style redirect to
 * /login when missing, or /app/setup if signed in but no program.
 */

export const metadata = {
  title: "Rankings · Rostr",
  robots: { index: false, follow: false },
};

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: {
    mode?: string;
    tryout?: string;
    metrics?: string; // comma-separated short_codes
    class?: string; // comma-separated grad years
    pos?: string; // comma-separated positions
    level?: string; // comma-separated team levels
  };
}) {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/login?next=/app/rankings");

  const scoringMode: ScoringMode =
    searchParams.mode === "benchmark" ? "benchmark" : "percentile";

  const filters: RankingsFilters = {
    tryoutId: searchParams.tryout || null,
    metricShortCodes: parseCSV(searchParams.metrics),
    gradYears: parseCSV(searchParams.class)
      ?.map((s) => Number(s))
      .filter((n) => !Number.isNaN(n)),
    positions: parseCSV(searchParams.pos),
    teamLevels: parseCSV(searchParams.level),
  };

  const response = await getPlayerRankings({
    programId: coach.program_id,
    scoringMode,
    filters,
  });

  return (
    <RankingsView
      response={response}
      initialFilters={{
        scoringMode,
        tryoutId: filters.tryoutId ?? null,
        metricShortCodes: filters.metricShortCodes ?? [],
        gradYears: parseCSV(searchParams.class) ?? [],
        positions: filters.positions ?? [],
        teamLevels: filters.teamLevels ?? [],
      }}
      programName={coach.program_name}
    />
  );
}

function parseCSV(s: string | undefined): string[] | undefined {
  if (!s) return undefined;
  const arr = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return arr.length === 0 ? undefined : arr;
}
