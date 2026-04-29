import { RosterView } from "@/app/app/roster/roster-view";
import {
  MOCK_PLAYERS,
  MOCK_TEAM,
  MOCK_BATTING_BY_PLAYER,
  MOCK_MEASURABLES_BY_PLAYER,
  MOCK_PITCHING_BY_PLAYER,
} from "@/lib/mock-data";

/**
 * /demo/roster — interactive roster view with mock players.
 *
 * Wires three pre-computed maps into RosterView so the player
 * slideover (the panel that opens when you click a player) shows:
 *   - Season batting stats (AVG / OBP / SLG / OPS / HR / RBI)
 *   - Verified measurables (60-yard, EV, FB velo, etc.)
 *   - Pitching line for two-way / pitcher-only players
 *
 * Numbers come from the same MOCK_BATTING_BY_PLAYER /
 * MOCK_MEASURABLES_BY_PLAYER / MOCK_PITCHING_BY_PLAYER maps the
 * /p/[handle] public profile uses, so the preview and the full
 * profile show identical data.
 */
export const metadata = {
  title: "Roster · Demo · Rostr",
  robots: { index: false, follow: false },
};

export default function DemoRosterPage() {
  // Project the full MockBattingLine down to the flatter shape the
  // RosterView's battingByPlayer prop expects.
  const battingByPlayer: Record<
    string,
    { games: number; ba: number; obp: number; slg: number; ops: number; hr: number; rbi: number }
  > = {};
  for (const [playerId, line] of Object.entries(MOCK_BATTING_BY_PLAYER)) {
    battingByPlayer[playerId] = {
      games: line.games,
      ba: line.ba,
      obp: line.obp,
      slg: line.slg,
      ops: line.ops,
      hr: line.hr,
      rbi: line.rbi,
    };
  }

  // Pitching needs the same flattening.
  const pitchingByPlayer: Record<
    string,
    { games: number; era: number; whip: number; ip: number; k: number; bb: number }
  > = {};
  for (const [playerId, line] of Object.entries(MOCK_PITCHING_BY_PLAYER)) {
    pitchingByPlayer[playerId] = {
      games: line.games,
      era: line.era,
      whip: line.whip,
      ip: line.ip,
      k: line.k,
      bb: line.bb,
    };
  }

  return (
    <RosterView
      players={MOCK_PLAYERS}
      levels={["Varsity"]}
      programName={MOCK_TEAM.name}
      battingByPlayer={battingByPlayer}
      measurablesByPlayer={MOCK_MEASURABLES_BY_PLAYER}
      pitchingByPlayer={pitchingByPlayer}
    />
  );
}
