import { notFound } from "next/navigation";
import { TryoutView } from "./tryout-view";
import { MigrationPending } from "./migration-pending";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchTryoutDetail } from "@/lib/services/tryouts";
import { fetchRoster } from "@/lib/services/players";

/**
 * /app/tryouts/[id] — server shell.
 * Loads tryout + stations + attendees + scores + eligible roster.
 * Delegates rendering to the client <TryoutView />.
 * Shows a clear "migration pending" screen when the tryouts tables are
 * missing (migration 20260315000008 not yet applied).
 */
export default async function TryoutDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const coach = await getCurrentCoach();
  const detail = await fetchTryoutDetail(params.id);

  if (detail.migrationMissing) return <MigrationPending />;
  if (!detail.tryout) notFound();

  // Roster pool = all program players (coaches pick attendees from here).
  const roster = coach ? await fetchRoster(coach.program_id, coach.program_levels) : [];

  return (
    <TryoutView
      programName={coach?.program_name ?? "My Program"}
      programLevels={coach?.program_levels ?? ["Varsity", "JV", "Freshman"]}
      tryout={detail.tryout}
      stations={detail.stations}
      attendees={detail.attendees}
      scores={detail.scores}
      roster={roster}
    />
  );
}
