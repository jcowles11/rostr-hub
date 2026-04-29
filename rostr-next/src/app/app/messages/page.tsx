import { redirect } from "next/navigation";
import { fetchInbox } from "@/lib/services/messaging";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchRoster } from "@/lib/services/players";
import { CoachInboxView } from "./coach-inbox-view";

/**
 * /app/messages — coach inbox.
 * Server shell loads the inbox + roster (for the compose picker) and
 * passes to the client view.
 */
export default async function CoachMessagesPage() {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/app/setup");

  const [threads, roster] = await Promise.all([
    fetchInbox(),
    fetchRoster(coach.program_id, coach.program_levels),
  ]);

  return (
    <CoachInboxView
      threads={threads}
      roster={roster}
      programName={coach.program_name}
      programLevels={coach.program_levels}
    />
  );
}
