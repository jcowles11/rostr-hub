/**
 * Mid-game runner events that happen BETWEEN at-bats (or during one,
 * with the same batter remaining). These don't end the at-bat — they
 * just move runners and possibly the count of outs.
 *
 * Modeled the same way as runner pickoffs: stored as `at_bat` events
 * in `game_events` with `payload.midGame: true` so they share the
 * existing append-only sequencing. Fan + coach UI filter by the flag
 * to keep the AB-count badge clean.
 *
 * Coverage:
 *   - stolen_base (SB)         — runner advances one base safely
 *   - caught_stealing (CS)     — runner attempting to steal is OUT
 *   - wild_pitch (WP)          — every runner advances one base
 *   - passed_ball (PB)         — every runner advances one base
 *   - balk (BK)                — every runner advances one base
 *
 * For SB / CS the coach picks WHICH base. For WP / PB / BK every
 * runner moves; if a runner on 3rd advances, they score.
 */

import { type Bases, EMPTY_BASES } from "./runner-state";

export type MidGameKind =
  | "stolen_base"
  | "caught_stealing"
  | "wild_pitch"
  | "passed_ball"
  | "balk";

export interface MidGameResult {
  bases: Bases;
  /** Runs scored on the play (when a runner from 3rd advances home). */
  runs: number;
  /** Outs added — only non-zero on caught_stealing. */
  outsAdded: 0 | 1;
  /** Human-readable label for the play feed. */
  description: string;
}

/**
 * Apply a mid-game event to current bases.
 *
 * For SB / CS: caller specifies the originating base (1, 2, 3). On a
 * stolen base from 1, runner moves to 2; from 2 to 3; from 3 to home
 * (scores). On caught stealing, the runner is removed and outs +1.
 *
 * For WP / PB / BK: every runner advances one base. Runner on 3rd
 * scores. No `fromBase` needed.
 */
export function applyMidGameEvent(
  before: Bases,
  kind: MidGameKind,
  fromBase?: 1 | 2 | 3,
): MidGameResult {
  const b: Bases = { 1: before[1], 2: before[2], 3: before[3] };

  switch (kind) {
    case "stolen_base": {
      if (!fromBase) {
        return { bases: b, runs: 0, outsAdded: 0, description: "Stolen base (no base specified)" };
      }
      const runner = b[fromBase];
      if (!runner) {
        return { bases: b, runs: 0, outsAdded: 0, description: `Stolen base attempt with empty ${baseName(fromBase)}` };
      }
      // Clear the originating base.
      b[fromBase] = null;
      if (fromBase === 3) {
        // Steal of home — runner scores.
        return {
          bases: b,
          runs: 1,
          outsAdded: 0,
          description: "Steal of home",
        };
      }
      const target = (fromBase + 1) as 2 | 3;
      // If the target is occupied (impossible in real baseball without
      // a double steal — keep defensive), the existing runner stays.
      if (b[target]) {
        // Defensive: shouldn't happen with the pickoff/SB UI gating it
        // to occupied source + empty target, but if it does, just
        // overwrite. Coach can correct via base editor.
        b[target] = runner;
      } else {
        b[target] = runner;
      }
      return {
        bases: b,
        runs: 0,
        outsAdded: 0,
        description: `Stolen base — to ${baseName(target)}`,
      };
    }

    case "caught_stealing": {
      if (!fromBase) {
        return { bases: b, runs: 0, outsAdded: 0, description: "Caught stealing (no base specified)" };
      }
      if (!b[fromBase]) {
        return { bases: b, runs: 0, outsAdded: 0, description: `Caught stealing — empty ${baseName(fromBase)}` };
      }
      b[fromBase] = null;
      return {
        bases: b,
        runs: 0,
        outsAdded: 1,
        description: `Caught stealing ${baseName(((fromBase % 3) + 1) as 1 | 2 | 3)}`,
      };
    }

    case "wild_pitch":
    case "passed_ball":
    case "balk": {
      // Every runner advances one base. Apply 3rd → home first so we
      // don't double-step.
      let runs = 0;
      if (b[3]) {
        runs += 1;
        b[3] = null;
      }
      if (b[2]) {
        b[3] = b[2];
        b[2] = null;
      }
      if (b[1]) {
        b[2] = b[1];
        b[1] = null;
      }
      const label =
        kind === "wild_pitch"
          ? "Wild pitch"
          : kind === "passed_ball"
            ? "Passed ball"
            : "Balk";
      return {
        bases: b,
        runs,
        outsAdded: 0,
        description: label + (runs > 0 ? ` (${runs} R)` : ""),
      };
    }

    default:
      return { bases: b, runs: 0, outsAdded: 0, description: "Unknown event" };
  }
}

function baseName(b: 1 | 2 | 3): string {
  return b === 1 ? "1st" : b === 2 ? "2nd" : "3rd";
}

/**
 * Display label for the play-by-play feed. Used by the fan view to
 * render `payload.midGame === true` events with a friendly outcome.
 */
export function midGameLabel(kind: string): string {
  const map: Record<string, string> = {
    stolen_base: "Stolen base",
    caught_stealing: "Caught stealing",
    wild_pitch: "Wild pitch",
    passed_ball: "Passed ball",
    balk: "Balk",
  };
  return map[kind] ?? kind;
}

/**
 * Returns true if the event payload should be excluded from at-bat
 * counts. Pickoffs and mid-game events both qualify — they don't
 * represent a plate appearance.
 */
export function isNonAtBat(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  return (
    (payload as { pickoff?: boolean }).pickoff === true ||
    (payload as { midGame?: boolean }).midGame === true ||
    (payload as { substitution?: boolean }).substitution === true
  );
}

/** Convenience type list for UI iteration. */
export const ALL_MID_GAME_KINDS: MidGameKind[] = [
  "stolen_base",
  "caught_stealing",
  "wild_pitch",
  "passed_ball",
  "balk",
];

/** Re-export to keep call sites that reach for EMPTY_BASES self-contained. */
export { EMPTY_BASES };
