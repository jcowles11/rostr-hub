import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchThreadDetail } from "@/lib/services/messaging";
import { ThreadDetailView } from "@/components/organisms/thread-detail-view";
import { markThreadReadAction } from "@/app/app/messages/actions";

export default async function AthleteThreadPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/me/messages/${params.id}`);

  const detail = await fetchThreadDetail(params.id);
  if (!detail) notFound();

  if (detail.thread.unreadCount > 0) {
    await markThreadReadAction(params.id);
  }

  return (
    <div className="bg-paper min-h-screen">
      <ThreadDetailView
        thread={detail.thread}
        initialMessages={detail.messages}
        participants={detail.participants}
        programName="My profile"
        backHref="/me/messages"
        backLabel="Messages"
      />
    </div>
  );
}
