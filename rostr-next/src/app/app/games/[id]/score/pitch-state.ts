/**
 * Pitch state model for the pitch-by-pitch scoring mode.
 *
 * Design intent:
 *   - State lives client-side during an at-bat. The server only learns
 *     about the pitch sequence when the at-bat RESOLVES (BB, K, or
 *     coach-picked outcome on "in play"). At that point the array is
 *     attached to the at-bat event's JSONB payload via a follow-up
 *     UPDATE — no schema migration required.
 *   - localStorage write-through means a tab refresh / browser crash
 *     during a 7-pitch at-bat doesn't drop the count. Hydrates on
 *     mount; cleared on resolution.
 *   - Reducer-style mutations so undo/redo at pitch level is trivial
 *     (just a state pop). No async, no race conditions.
 *
 * Forward-compatibility note:
 *   The pitch shape includes `kind` ("ball"|"strike"|"foul"|"in_play")
 *   and a 1-based `n`. Future fields (location, velocity, type) can
 *   be added without breaking existing rows — readers should ignore
 *   unknown fields.
 */

export type PitchKind = "ball" | "strike" | "foul" | "in_play";

export interface Pitch {
  /** 1-based index within the at-bat. */
  n: number;
  kind: PitchKind;
  /** ISO timestamp of when the pitch was logged on the device. */
  loggedAt: string;
}

export interface PitchState {
  pitches: Pitch[];
  balls: number;
  strikes: number;
  /**
   * Resolution status:
   *   - in_progress: at-bat ongoing, more pitches expected
   *   - walk: 4 balls — auto-resolves to BB
   *   - strikeout: 3 strikes — auto-resolves to K
   *   - in_play: last pitch was put in play; coach picks the outcome
   *   - resolved: outcome chosen, this state is closed (UI advances)
   */
  status: "in_progress" | "walk" | "strikeout" | "in_play" | "resolved";
}

export const EMPTY_PITCH_STATE: PitchState = {
  pitches: [],
  balls: 0,
  strikes: 0,
  status: "in_progress",
};

export type PitchAction =
  | { kind: "pitch"; pitch: PitchKind }
  | { kind: "undo" }
  | { kind: "reset" }
  | { kind: "resolve" };

/**
 * Pure reducer. Encodes baseball pitch rules:
 *   - 4 balls → walk (status flips to 'walk', further pitches ignored)
 *   - 3 strikes → strikeout
 *   - foul on 0 or 1 strike → +1 strike
 *   - foul on 2 strikes → no change (foul rule)
 *   - in_play → status 'in_play', coach picks outcome
 *
 * Any pitch when status !== 'in_progress' is a no-op (defensive).
 */
export function reducePitchState(state: PitchState, action: PitchAction): PitchState {
  switch (action.kind) {
    case "reset":
      return EMPTY_PITCH_STATE;

    case "undo": {
      if (state.pitches.length === 0) return state;
      const remaining = state.pitches.slice(0, -1);
      // Recompute count from scratch — cheap, avoids drift bugs.
      let balls = 0;
      let strikes = 0;
      for (const p of remaining) {
        if (p.kind === "ball") balls++;
        else if (p.kind === "strike") strikes++;
        else if (p.kind === "foul") strikes = Math.min(2, strikes + 1);
        // in_play doesn't increment count
      }
      return {
        pitches: remaining,
        balls,
        strikes,
        // Undoing a resolution-triggering pitch returns us to in_progress.
        status: "in_progress",
      };
    }

    case "pitch": {
      if (state.status !== "in_progress") return state;
      const n = state.pitches.length + 1;
      const next: Pitch = {
        n,
        kind: action.pitch,
        loggedAt: new Date().toISOString(),
      };
      let balls = state.balls;
      let strikes = state.strikes;
      let status: PitchState["status"] = "in_progress";

      if (action.pitch === "ball") {
        balls += 1;
        if (balls >= 4) status = "walk";
      } else if (action.pitch === "strike") {
        strikes += 1;
        if (strikes >= 3) status = "strikeout";
      } else if (action.pitch === "foul") {
        // Foul on 0 or 1 strike → strike. On 2 strikes → no change.
        if (strikes < 2) strikes += 1;
      } else if (action.pitch === "in_play") {
        status = "in_play";
      }

      return {
        pitches: [...state.pitches, next],
        balls,
        strikes,
        status,
      };
    }

    case "resolve":
      return { ...state, status: "resolved" };

    default:
      return state;
  }
}

// ── localStorage persistence ─────────────────────────────────

/**
 * Per-(game, batter) storage key. Scoping by batter means a refresh
 * during one at-bat doesn't bleed pitches into the next batter; if
 * the batter changes (lineup index advances), the new key starts
 * empty.
 */
export function pitchStateKey(gameId: string, batterId: string | null): string {
  return `rostr.pitches.${gameId}.${batterId ?? "anon"}`;
}

export function loadPitchState(gameId: string, batterId: string | null): PitchState {
  if (typeof window === "undefined") return EMPTY_PITCH_STATE;
  try {
    const raw = window.localStorage.getItem(pitchStateKey(gameId, batterId));
    if (!raw) return EMPTY_PITCH_STATE;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Array.isArray(parsed.pitches) &&
      typeof parsed.balls === "number" &&
      typeof parsed.strikes === "number" &&
      typeof parsed.status === "string"
    ) {
      // Defensive — in_play / walk / strikeout that survived a refresh
      // are valid; resolved we never persist (cleared on log).
      return parsed as PitchState;
    }
    return EMPTY_PITCH_STATE;
  } catch {
    return EMPTY_PITCH_STATE;
  }
}

export function savePitchState(
  gameId: string,
  batterId: string | null,
  state: PitchState,
): void {
  if (typeof window === "undefined") return;
  try {
    if (state.pitches.length === 0 || state.status === "resolved") {
      window.localStorage.removeItem(pitchStateKey(gameId, batterId));
    } else {
      window.localStorage.setItem(
        pitchStateKey(gameId, batterId),
        JSON.stringify(state),
      );
    }
  } catch {
    // Quota / disabled — fail silently; in-memory state is still source of truth.
  }
}

// ── Display helpers ─────────────────────────────────────────

export function pitchSummary(pitches: Pitch[]): string {
  if (pitches.length === 0) return "";
  return pitches
    .map((p) =>
      p.kind === "ball" ? "B" : p.kind === "strike" ? "S" : p.kind === "foul" ? "F" : "·",
    )
    .join("-");
}

export function countLabel(state: Pick<PitchState, "balls" | "strikes">): string {
  return `${state.balls}-${state.strikes}`;
}

// ── Mode persistence (per-game) ──────────────────────────────

export type ScoringMode = "simple" | "pitch_by_pitch";

export function scoringModeKey(gameId: string): string {
  return `rostr.scoring.mode.${gameId}`;
}

export function loadScoringMode(gameId: string): ScoringMode {
  if (typeof window === "undefined") return "simple";
  try {
    const raw = window.localStorage.getItem(scoringModeKey(gameId));
    return raw === "pitch_by_pitch" ? "pitch_by_pitch" : "simple";
  } catch {
    return "simple";
  }
}

export function saveScoringMode(gameId: string, mode: ScoringMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scoringModeKey(gameId), mode);
  } catch {
    // Best-effort.
  }
}
