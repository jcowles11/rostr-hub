import { MOCK_PLAYERS, MOCK_TEAM } from "@/lib/mock-data";
import {
  IntrasquadView,
  type IntrasquadPlayer,
} from "@/app/app/practice/intrasquad/intrasquad-view";

/**
 * /demo/practice/intrasquad — same builder as the real /app version,
 * driven by MOCK_PLAYERS. Lets a prospect split squads, set a pitching
 * rotation, tweak rules, and print a sample scrimmage plan — all
 * without any auth or persistence.
 */
export const metadata = {
  title: "Intrasquad · Demo · Rostr",
  robots: { index: false, follow: false },
};

export default function DemoIntrasquadPage() {
  const intrasquadRoster: IntrasquadPlayer[] = MOCK_PLAYERS.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    jerseyNumber: p.jerseyNumber,
    positions: p.positions,
    classYearShort: p.classYearShort,
    ba: p.ba,
    era: p.era,
    availabilityStatus: p.availabilityStatus,
  }));

  return (
    <IntrasquadView
      roster={intrasquadRoster}
      programName={MOCK_TEAM.name}
      basePathPrefix="/demo"
    />
  );
}
