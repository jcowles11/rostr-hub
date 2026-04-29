import { redirect } from "next/navigation";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchRoster } from "@/lib/services/players";
import { IntrasquadView, type IntrasquadPlayer } from "./intrasquad-view";

/**
 * /app/practice/intrasquad — coach-facing intrasquad scrimmage builder.
 *
 * Loads the active roster + program context, then hands off to the
 * client view. Plan is local-state for now (no persistence) — coaches
 * build, print, run; saved scrimmage plans are a follow-on once the
 * pattern is validated in the field.
 */
export default async function IntrasquadPage() {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/app/setup");

  const roster = await fetchRoster(coach.program_id, coach.program_levels);

  // Adapt RealPlayer → IntrasquadPlayer (the view doesn't need the full
  // shape — just the fields the squad builder + rotation pickers use).
  const intrasquadRoster: IntrasquadPlayer[] = roster.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    jerseyNumber: p.jerseyNumber,
    positions: p.positions,
    classYearShort: p.classYearShort,
    ba: p.ba,
    era: p.era,
    availabilityStatus: p.availabilityStatus,
  }));

  return (
    <IntrasquadView
      roster={intrasquadRoster}
      programName={coach.program_name}
      basePathPrefix="/app"
    />
  );
}
