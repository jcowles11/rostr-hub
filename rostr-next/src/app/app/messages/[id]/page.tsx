import { notFound, redirect } from "next/navigation";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchThreadDetail } from "@/lib/services/messaging";
import { ThreadDetailView } from "@/components/organisms/thread-detail-view";
import { markThreadReadAction } from "../actions";

/**
 * /app/messages/[id] — coach thread detail.
 * Marks the thread read on load (server-side) then renders the view.
 */
export default async function CoachThreadPage({
  params,
}: {
  params: { id: string };
}) {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/app/setup");

  const detail = await fetchThreadDetail(params.id);
  if (!detail) notFound();

  // Mark read as a side effect — if there are unread messages, clear
  // the badge now that the user is viewing the thread.
  if (detail.thread.unreadCount > 0) {
    await markThreadReadAction(params.id);
  }

  return (
    <ThreadDetailView
      thread={detail.thread}
      initialMessages={detail.messages}
      participants={detail.participants}
      programName={coach.program_name}
      backHref="/app/messages"
      backLabel="Messages"
    />
  );
}
