"use client";

import { cn } from "@/lib/utils";

/**
 * DiamondViz — minimal SVG baseball diamond.
 *
 * Honest design constraints:
 *   - We do NOT track base-runner state across plays (no scoring engine
 *     yet). What we CAN show is "where the last batter ended up" based
 *     on the most recent at-bat outcome — a useful glance signal even
 *     without runner tracking.
 *   - When real base-runner state ships (separate sprint), this
 *     component already accepts a `bases` prop (Set<1|2|3>) so the
 *     scoreboard can drop in actual runner data without UI changes.
 *
 * Sizing:
 *   - Renders to a fixed 140×140 SVG, scales via parent CSS.
 *   - Designed to sit inline in the scoreboard — see usage in
 *     fan-game-view.tsx GameScoreboard.
 */

export type Base = 1 | 2 | 3;

/**
 * Map an at-bat outcome to the base the BATTER reaches. Returns null if
 * the play put the batter out (no base highlight). Honest about what we
 * know: HR is shown as "home" → all bases lit briefly.
 */
export function batterTerminalBase(outcome: string | undefined | null): Base | "home" | null {
  if (!outcome) return null;
  if (outcome === "1B" || outcome === "BB" || outcome === "HBP" || outcome === "E" || outcome === "FC") return 1;
  if (outcome === "2B") return 2;
  if (outcome === "3B") return 3;
  if (outcome === "HR") return "home";
  // K, GO, FO, SAC → batter is out, no base
  return null;
}

export function DiamondViz({
  /** Bases occupied — actual runner state. Empty Set when unknown. */
  bases = new Set<Base>(),
  /** Where the most recent batter ended up. Used for a brief highlight. */
  highlight = null,
  size = 140,
  className,
}: {
  bases?: Set<Base>;
  highlight?: Base | "home" | null;
  size?: number;
  className?: string;
}) {
  // Diamond geometry — home plate at bottom, 2nd at top, 1st right, 3rd left.
  const center = size / 2;
  const radius = size * 0.36; // distance from center to each base
  const positions = {
    1: { x: center + radius, y: center },
    2: { x: center, y: center - radius },
    3: { x: center - radius, y: center },
    home: { x: center, y: center + radius },
  };

  // Highlight state — drawn underneath the base dots so the dot still pops.
  const isHighlighted = (b: Base | "home"): boolean => {
    if (highlight === "home") return true; // HR — light all bases including home
    return highlight === b;
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Baseball diamond visualization"
    >
      {/* Diamond outline */}
      <polygon
        points={`${positions[2].x},${positions[2].y} ${positions[1].x},${positions[1].y} ${positions.home.x},${positions.home.y} ${positions[3].x},${positions[3].y}`}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={1.5}
      />
      {/* Pitcher's mound */}
      <circle
        cx={center}
        cy={center}
        r={size * 0.04}
        fill="currentColor"
        opacity={0.12}
      />

      {/* Bases — render highlight ring first, then dot on top */}
      {(["home", 1, 2, 3] as const).map((b) => {
        const pos = positions[b];
        const occupied = b === "home" ? false : bases.has(b);
        const lit = isHighlighted(b);
        return (
          <g key={b}>
            {lit && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={size * 0.085}
                className="fill-red"
                opacity={0.25}
              >
                <animate
                  attributeName="opacity"
                  values="0.4;0.15;0.4"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            <rect
              x={pos.x - size * 0.05}
              y={pos.y - size * 0.05}
              width={size * 0.1}
              height={size * 0.1}
              transform={`rotate(45 ${pos.x} ${pos.y})`}
              className={
                occupied
                  ? "fill-red"
                  : lit
                    ? "fill-red"
                    : "fill-current opacity-30"
              }
            />
          </g>
        );
      })}
    </svg>
  );
}
