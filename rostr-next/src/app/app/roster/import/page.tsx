import { redirect } from "next/navigation";
import { getCurrentCoach } from "@/lib/services/coach";
import { ImportView } from "./import-view";

/**
 * /app/roster/import — GameChanger CSV roster import.
 *
 * Two-stage UI:
 *   1. Paste CSV → preview parsed rows + duplicate warnings
 *   2. Choose which rows to import → commit
 *
 * Auth: head_coach permission required (enforced server-side in
 * commitImportAction). Page itself just gates on coach context.
 */

export const metadata = {
  title: "Import roster · Rostr",
  robots: { index: false, follow: false },
};

export default async function ImportRosterPage() {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/login?next=/app/roster/import");

  return (
    <ImportView
      programId={coach.program_id}
      programName={coach.program_name}
    />
  );
}
