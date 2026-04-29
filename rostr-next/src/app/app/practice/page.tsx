import { redirect } from "next/navigation";
import { getCurrentCoach } from "@/lib/services/coach";
import {
  getPlanById,
  getPlansByDate,
  getRecentAndUpcomingPlans,
  getDrillLibrary,
} from "@/lib/services/practice-plans";
import { PracticeEditor } from "./editor";

/**
 * /app/practice — Practice planner (server shell).
 *
 * Resolves the active plan from `?plan=<id>` or — if missing — auto-loads
 * today's plan if one exists. If neither, the editor renders an empty
 * state inviting the coach to create today's plan.
 *
 * Data fetched server-side (so refresh-after-action lands correct state):
 *   - Active plan (with blocks)
 *   - Recent + upcoming plans (for the picker)
 *   - Drill library (lazy-seeded from migration 000026 defaults)
 */
export default async function PracticePlannerPage({
  searchParams,
}: {
  searchParams: { plan?: string };
}) {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/app/setup");

  const today = new Date().toISOString().slice(0, 10);

  // Determine which plan to load:
  //   1. Explicit ?plan=<id>
  //   2. Today's plan (if any)
  //   3. Most recent plan (so the editor isn't empty for coaches who don't have one today)
  let activePlanId = searchParams.plan ?? null;
  if (!activePlanId) {
    const todays = await getPlansByDate(coach.program_id, today);
    if (todays.length > 0) {
      activePlanId = todays[0].id;
    }
  }

  const [activePlan, recentPlans, drillLibrary] = await Promise.all([
    activePlanId ? getPlanById(activePlanId) : Promise.resolve(null),
    getRecentAndUpcomingPlans(coach.program_id, 30),
    getDrillLibrary(coach.program_id),
  ]);

  // If ?plan= was specified but the plan no longer exists (deleted in
  // another tab), fall back to no active plan instead of throwing.
  const finalActive = activePlan ?? null;

  return (
    <PracticeEditor
      programId={coach.program_id}
      programName={coach.program_name ?? "Your program"}
      programLevels={coach.program_levels ?? []}
      today={today}
      activePlan={finalActive}
      recentPlans={recentPlans}
      drillLibrary={drillLibrary}
    />
  );
}
