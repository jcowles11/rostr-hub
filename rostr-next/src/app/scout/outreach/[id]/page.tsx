import { notFound, redirect } from "next/navigation";
import { getCurrentRecruiter, type RecruiterContext } from "@/lib/services/recruiter";
import { fetchThreadDetail } from "@/lib/services/messaging";
import { ThreadDetailView } from "@/components/organisms/thread-detail-view";
import { markThreadReadAction } from "@/app/app/messages/actions";

export default async function RecruiterOutreachThreadPage({
  params,
}: {
  params: { id: string };
}) {
  const recruiter = await getCurrentRecruiter();
  if (!recruiter) redirect("/scout/setup");

  const detail = await fetchThreadDetail(params.id);
  if (!detail) notFound();

  if (detail.thread.unreadCount > 0) {
    await markThreadReadAction(params.id);
  }

  return (
    <ThreadDetailView
      thread={detail.thread}
      initialMessages={detail.messages}
      participants={detail.participants}
      programName={recruiter.organizationName}
      backHref="/scout/outreach"
      backLabel="Outreach"
    />
  );
}

void ({} as RecruiterContext);
