import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/organisms/top-bar";
import { getCurrentCoach } from "@/lib/services/coach";
import {
  fetchPracticeSession,
  fetchSessionAtBats,
} from "@/lib/services/live-abs";
import { fetchRoster } from "@/lib/services/players";
import { SessionRecordView } from "./record-view";

export default async function LiveAbsSessionPage({
  params,
}: {
  params: { id: string };
}) {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/app/setup");

  const [session, atBats, roster] = await Promise.all([
    fetchPracticeSession(params.id),
    fetchSessionAtBats(params.id),
    fetchRoster(coach.program_id),
  ]);
  if (!session) notFound();

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: coach.program_name },
          { label: "Practice", href: "/app/practice" },
          { label: "Live at-bats", href: "/app/practice/live-abs" },
          { label: session.name },
        ]}
      />
      <SessionRecordView
        session={session}
        initialAtBats={atBats}
        roster={roster.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          jersey: p.jerseyNumber ?? null,
          positions: p.positions,
        }))}
      />
    </>
  );
}
