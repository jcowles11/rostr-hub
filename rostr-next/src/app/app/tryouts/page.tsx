import { TryoutsListView } from "./tryouts-list-view";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchTryouts } from "@/lib/services/tryouts";

/**
 * /app/tryouts — server shell.
 * Loads the coach's tryouts. Empty state encourages creating a first
 * tryout; list feeds the client view which owns the create modal.
 */
export default async function TryoutsListPage() {
  const coach = await getCurrentCoach();
  const tryouts = coach ? await fetchTryouts(coach.program_id) : [];
  return <TryoutsListView tryouts={tryouts} programName={coach?.program_name ?? "Demo · Lincoln HS"} />;
}
