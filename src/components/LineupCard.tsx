/**
 * LineupCard — Reusable lineup card renderer.
 *
 * Renders a single lineup card suitable for printing. The parent
 * decides layout (2×2 grid, full-page dugout board, etc.).
 *
 * No data fetching — receives all data as props.
 */

export interface LineupCardPlayer {
  battingOrder: number;
  name: string;
  jerseyNumber: string | number | null;
  position: string;
}

export interface LineupCardProps {
  /** Team / program name */
  teamName: string;
  /** Opponent name (optional) */
  opponent?: string | null;
  /** Game date formatted for display */
  date: string;
  /** Team level badge (e.g. "Varsity") */
  teamLevel?: string | null;
  /** Location or "Home" / "Away" */
  location?: string | null;
  /** Ordered lineup entries */
  players: LineupCardPlayer[];
  /** Visual variant — "card" is compact 4-per-page, "board" is future full-page */
  variant?: "card" | "board";
}

/** Position abbreviation ↔ number mapping (standard baseball). */
const POS_NUMBER: Record<string, string> = {
  P: "1", C: "2", "1B": "3", "2B": "4", "3B": "5",
  SS: "6", LF: "7", CF: "8", RF: "9", DH: "DH", EH: "EH",
};
const NUMBER_POS: Record<string, string> = Object.fromEntries(
  Object.entries(POS_NUMBER).map(([k, v]) => [v, k])
);

/** Convert a position to its number form. */
export function positionToNumber(pos: string): string {
  return POS_NUMBER[pos.toUpperCase()] || pos;
}

/** Convert a position to its abbreviation form. */
export function positionToAbbrev(pos: string): string {
  const upper = pos.toUpperCase();
  return NUMBER_POS[upper] || upper;
}

export default function LineupCard({
  teamName,
  opponent,
  date,
  teamLevel,
  location,
  players,
  variant = "card",
}: LineupCardProps) {
  const isBoard = variant === "board";
  const maxRows = isBoard ? 15 : 11; // card fits ~11 rows comfortably
  const displayPlayers = players.slice(0, maxRows);
  const emptyRows = Math.max(0, (isBoard ? 15 : 9) - displayPlayers.length);

  return (
    <div
      className={
        isBoard
          ? "lineup-card lineup-card--board"
          : "lineup-card lineup-card--card"
      }
    >
      {/* ── Header ────────────────────────────────── */}
      <div className="lineup-card__header">
        <div className="lineup-card__team">
          <span className="lineup-card__team-name">{teamName}</span>
          {teamLevel && (
            <span className="lineup-card__level">{teamLevel}</span>
          )}
        </div>
        {opponent && (
          <div className="lineup-card__opponent">
            vs {opponent}
          </div>
        )}
        <div className="lineup-card__meta">
          <span>{date}</span>
          {location && <span> · {location}</span>}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────── */}
      <table className="lineup-card__table">
        <thead>
          <tr>
            <th className="lineup-card__th lineup-card__th--order">#</th>
            <th className="lineup-card__th lineup-card__th--name">Player</th>
            <th className="lineup-card__th lineup-card__th--number">No.</th>
            <th className="lineup-card__th lineup-card__th--pos">Pos</th>
          </tr>
        </thead>
        <tbody>
          {displayPlayers.map((p, i) => (
            <tr key={i} className="lineup-card__row">
              <td className="lineup-card__td lineup-card__td--order">
                {p.battingOrder}
              </td>
              <td className="lineup-card__td lineup-card__td--name">
                {p.name}
              </td>
              <td className="lineup-card__td lineup-card__td--number">
                {p.jerseyNumber ?? "—"}
              </td>
              <td className="lineup-card__td lineup-card__td--pos">
                {p.position || "—"}
              </td>
            </tr>
          ))}
          {/* Empty rows for hand-writing subs */}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <tr key={`empty-${i}`} className="lineup-card__row lineup-card__row--empty">
              <td className="lineup-card__td lineup-card__td--order">
                {displayPlayers.length + i + 1}
              </td>
              <td className="lineup-card__td lineup-card__td--name">&nbsp;</td>
              <td className="lineup-card__td lineup-card__td--number">&nbsp;</td>
              <td className="lineup-card__td lineup-card__td--pos">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
