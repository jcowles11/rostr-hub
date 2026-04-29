import { RosterView } from "@/app/app/roster/roster-view";
import { MOCK_PLAYERS, MOCK_TEAM } from "@/lib/mock-data";

/**
 * /demo/roster — interactive roster view with mock players.
 * Renders the same RosterView used in /app/roster.
 */
export const metadata = {
  title: "Roster · Demo · Rostr",
  robots: { index: false, follow: false },
};

export default function DemoRosterPage() {
  return (
    <RosterView
      players={MOCK_PLAYERS}
      levels={["Varsity"]}
      programName={MOCK_TEAM.name}
    />
  );
}
