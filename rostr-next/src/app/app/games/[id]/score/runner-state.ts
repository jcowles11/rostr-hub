/**
 * Base-runner state model.
 *
 * Design intent:
 *   - State is a 3-slot record: { 1?, 2?, 3? } of player ids.
 *   - "Smart default" advancement based on outcome — accurate for most
 *     plays, intentionally wrong on edge cases (FC, sacrifice fly, errors
 *     with runner movement) where the coach can undo + re-log.
 *   - Stored as `payload.runnersAfter` on the at_bat event. The previous
 *     event's `runnersAfter` IS the next at-bat's `runnersBefore`, so
 *     we don't store before-state explicitly.
 *   - `runs` from a play = count of runners that crossed home this play.
 *     Computed by diffing pre/post bases — no separate field needed.
 *
 * Sprint mandate: "no new UI complexity" — the coach taps an outcome
 * and runners auto-advance. A future sprint can add a per-play runner
 * picker for FC / SAC / steal / pickoff edge cases.
 */

export type Bases = {
  /** Player on 1st (id), or null if base is empty. */
  1: string | null;
  2: string | null;
  3: string | null;
};

export const EMPTY_BASES: Bases = { 1: null, 2: null, 3: null };

/**
 * Result of an outcome being applied to current bases.
 *
 * `runs` = number of runners that scored on this play. The caller
 * (live-scoring-view) adds this to the appropriate side's score.
 *
 * `runScorers` is an EXPLICIT list of player ids that crossed home
 * on this play. Critical for box-score correctness — prior versions
 * inferred this from runner-state diffs which is fragile. The HR
 * batter's own run is included in this list when applicable.
 */
export interface RunnerAdvancementResult {
  bases: Bases;
  runs: number;
  /** True if at least 1 out was recorded on this play (legacy field). */
  isOut: boolean;
  /** Number of outs added on this play. 1 for routine outs, 2 for GIDP,
   *  0 for hits / walks / errors. Caller adds this to currentOuts. */
  outsAdded: number;
  /** Player ids that scored on this play, in advancement order. */
  runScorers: string[];
}

/**
 * Apply an at-bat outcome to the current bases.
 *
 * Heuristic — encodes the most common runner movements:
 *   - 1B: batter→1; 1→2; 2→3; 3→home (1 run if 3 was occupied)
 *   - 2B: batter→2; 1→3; 2→home; 3→home
 *   - 3B: batter→3; 1→home; 2→home; 3→home
 *   - HR: bases clear; runs = 1 + (runners that were on)
 *   - BB / HBP: batter→1; force advances only if behind the batter is full
 *   - E: treat as single (batter→1, others advance one)
 *   - FC: batter→1; the lead runner is forced out (heuristic — coach overrides)
 *   - K / GO / FO: out, no movement (no SAC fly RBI yet — see SAC)
 *   - SAC: out + runner on 3 scores if present (sac-fly / sac-bunt squeeze)
 *
 * Pitch outcome (`in_play`) is NOT a final outcome — it shouldn't reach
 * this function; the caller resolves it to one of the above first.
 */
export function advanceRunners(
  before: Bases,
  outcome: string,
  batterId: string | null,
): RunnerAdvancementResult {
  // Defensive: copy before so callers can pass live state.
  const b: Bases = { 1: before[1], 2: before[2], 3: before[3] };
  const runScorers: string[] = [];

  // batterToken: what we put on the bag for the batter. Falls back to a
  // sentinel string when batter is unknown (ad-hoc opposing batter, etc.)
  // so the "occupied?" check still works downstream.
  const batterToken = batterId ?? "__batter__";
  const score = (id: string | null) => {
    if (id) runScorers.push(id);
  };

  switch (outcome) {
    case "1B":
    case "E": {
      if (b[3]) { score(b[3]); b[3] = null; }
      if (b[2]) { b[3] = b[2]; b[2] = null; }
      if (b[1]) { b[2] = b[1]; b[1] = null; }
      b[1] = batterToken;
      return { bases: b, runs: runScorers.length, isOut: false, outsAdded: 0, runScorers };
    }

    case "2B": {
      if (b[3]) { score(b[3]); b[3] = null; }
      if (b[2]) { score(b[2]); b[2] = null; }
      if (b[1]) { b[3] = b[1]; b[1] = null; }
      b[2] = batterToken;
      return { bases: b, runs: runScorers.length, isOut: false, outsAdded: 0, runScorers };
    }

    case "3B": {
      if (b[3]) { score(b[3]); b[3] = null; }
      if (b[2]) { score(b[2]); b[2] = null; }
      if (b[1]) { score(b[1]); b[1] = null; }
      b[3] = batterToken;
      return { bases: b, runs: runScorers.length, isOut: false, outsAdded: 0, runScorers };
    }

    case "HR": {
      // Everyone scores, including the batter.
      if (b[3]) score(b[3]);
      if (b[2]) score(b[2]);
      if (b[1]) score(b[1]);
      score(batterToken); // the batter scores last (advancement order)
      return {
        bases: { 1: null, 2: null, 3: null },
        runs: runScorers.length,
        isOut: false,
        outsAdded: 0,
        runScorers,
      };
    }

    case "BB":
    case "HBP":
    case "CI": {
      // BB/HBP/CI: batter awarded 1st. Force advance only when bases
      // behind the batter are full. CI is treated identically for
      // runner movement (batter gets 1st, runners forced if needed),
      // but the box-score derivation excludes it from BB/HBP counts.
      if (b[1] && b[2] && b[3]) {
        score(b[3]);
        b[3] = b[2];
        b[2] = b[1];
        b[1] = batterToken;
      } else if (b[1] && b[2]) {
        b[3] = b[2];
        b[2] = b[1];
        b[1] = batterToken;
      } else if (b[1]) {
        b[2] = b[1];
        b[1] = batterToken;
      } else {
        b[1] = batterToken;
      }
      return { bases: b, runs: runScorers.length, isOut: false, outsAdded: 0, runScorers };
    }

    case "FC": {
      // Heuristic: lead force-out (most common FC). Batter to 1.
      if (b[3]) {
        b[3] = null; // forced out at home
      } else if (b[2]) {
        b[2] = null;
      } else if (b[1]) {
        b[1] = null;
      }
      if (b[2] && !b[3]) { b[3] = b[2]; b[2] = null; }
      if (b[1] && !b[2]) { b[2] = b[1]; b[1] = null; }
      b[1] = batterToken;
      return { bases: b, runs: 0, isOut: true, outsAdded: 1, runScorers: [] };
    }

    case "SAC": {
      // Sac fly / sac bunt — runner on 3rd scores (most common case).
      // Batter is out. Coach can pick sacrificeType in payload.
      if (b[3]) { score(b[3]); b[3] = null; }
      return { bases: b, runs: runScorers.length, isOut: true, outsAdded: 1, runScorers };
    }

    case "GIDP": {
      // Grounded into double play. Requires a runner on 1st to be a
      // proper DP — without one, fall through as a routine ground out.
      if (!b[1]) {
        return { bases: b, runs: 0, isOut: true, outsAdded: 1, runScorers: [] };
      }
      // Standard 6-4-3 / 4-6-3: R1 is forced out at 2nd, batter is out
      // at 1st. R2 stays (6-4-3 doesn't move them; the play is fast).
      // R3 typically stays (most common); MLB rule allows R3 to score
      // if not forced and the DP completes after — coach can override
      // via the bases editor for the rare run-on-DP case.
      b[1] = null;
      return { bases: b, runs: 0, isOut: true, outsAdded: 2, runScorers: [] };
    }

    case "K":
    case "GO":
    case "FO": {
      return { bases: b, runs: 0, isOut: true, outsAdded: 1, runScorers: [] };
    }

    default:
      return { bases: b, runs: 0, isOut: false, outsAdded: 0, runScorers: [] };
  }
}

/**
 * Convert Bases to the Set<Base> the DiamondViz component accepts.
 * (DiamondViz takes Set<1|2|3> for occupancy display.)
 */
export function basesToOccupiedSet(bases: Bases): Set<1 | 2 | 3> {
  const s = new Set<1 | 2 | 3>();
  if (bases[1]) s.add(1);
  if (bases[2]) s.add(2);
  if (bases[3]) s.add(3);
  return s;
}

/**
 * Pretty-print a Bases state. Useful for debugging + the scoreboard
 * "runners" line. Examples:
 *   - "Bases empty"
 *   - "Runner on 1st"
 *   - "Runners on 1st and 3rd"
 *   - "Bases loaded"
 */
export function describeBases(bases: Bases): string {
  const occupied: Array<1 | 2 | 3> = [];
  if (bases[1]) occupied.push(1);
  if (bases[2]) occupied.push(2);
  if (bases[3]) occupied.push(3);
  if (occupied.length === 0) return "Bases empty";
  if (occupied.length === 3) return "Bases loaded";
  const labels = occupied.map((b) => (b === 1 ? "1st" : b === 2 ? "2nd" : "3rd"));
  if (labels.length === 1) return `Runner on ${labels[0]}`;
  return `Runners on ${labels.join(" and ")}`;
}

/**
 * Derive current bases from the most recent at_bat event's payload.
 * Returns EMPTY_BASES when the most recent at-bat doesn't carry runner
 * data (i.e. it was scored before the runner-state update shipped).
 *
 * We accept loose payload shape (Record<string, unknown>) so callers
 * don't have to narrow before calling.
 */
export function basesFromPayload(
  payload: Record<string, unknown> | null | undefined,
): Bases {
  if (!payload) return EMPTY_BASES;
  const r = payload.runnersAfter as
    | { 1?: string | null; 2?: string | null; 3?: string | null }
    | undefined;
  if (!r) return EMPTY_BASES;
  return {
    1: r[1] ?? null,
    2: r[2] ?? null,
    3: r[3] ?? null,
  };
}
