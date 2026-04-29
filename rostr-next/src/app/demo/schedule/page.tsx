import { ScheduleView } from "@/app/app/schedule/schedule-view";
import { getMockScheduleEvents } from "@/lib/mock-data";

/**
 * /demo/schedule — same client view as /app/schedule, dynamic week
 * data anchored on the upcoming Friday Senior Night so a prospect
 * arriving any day sees a coherent "this week" view.
 */
export const metadata = {
  title: "Schedule · Demo · Rostr",
  robots: { index: false, follow: false },
};

// Anchor on the actual current date on every render.
export const dynamic = "force-dynamic";

export default function DemoSchedulePage() {
  return <ScheduleView week={getMockScheduleEvents()} />;
}
