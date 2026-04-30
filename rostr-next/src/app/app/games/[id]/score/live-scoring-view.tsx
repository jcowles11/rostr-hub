"use client";

import { useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  Play,
  Pause,
  Flag,
  Share2,
  Undo2,
  CheckCircle2,
  ChevronRight,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  AtBatOutcome,
  GameEvent,
  LiveGameState,
} from "@/lib/services/live-scoring";
import {
  startLiveScoringAction,
  logAtBatAction,
  endLiveGameAction,
  undoLastAtBatAction,
  recordRunnerPickoffAction,
  recordMidGameEventAction,
  recordInningChangeAction,
  overrideBasesAction,
  substituteAction,
  markEventErrorAction,
  type PersistedPitch,
} from "./actions";
import {
  applyMidGameEvent,
  type MidGameKind,
} from "./mid-game-events";
import {
  EMPTY_PITCH_STATE,
  loadPitchState,
  loadScoringMode,
  pitchSummary,
  reducePitchState,
  savePitchState,
  saveScoringMode,
  type PitchKind,
  type ScoringMode,
} from "./pitch-state";
import { PitchCount, PitchKeypad } from "./pitch-keypad";
import {
  EMPTY_BASES,
  advanceRunners,
  basesFromPayload,
  basesToOccupiedSet,
  describeBases,
  type Bases,
} from "./runner-state";

/**
 * LiveScoringView — mobile-optimized scorekeeper UX.
 *
 * The page is split into 4 regions:
 *   1. Sticky top banner: score + inning + outs
 *   2. Current batter card (who's up, who's on-deck)
 *   3. 8-button outcome grid (1B/2B/3B/HR/BB/K/GO/FO)
 *   4. Event log (most recent first)
 *
 * Every tap writes an event to game_events via RPC. The fan viewer at
 * /g/[id] subscribes to the same postgres_changes channel.
 */

interface RosterEntry {
  id: string;
  firstName: string;
  lastName: string;
  jersey: number | null;
  positions: string[];
}

interface LineupEntry {
  battingOrder: number;
  position: string;
  playerId: string;
  firstName: string;
  lastName: string;
  jersey: number | null;
}

export function LiveScoringView({
  gameId,
  programName,
  game,
  initialState,
  initialEvents,
  ourRoster,
  ourLineup,
  opposingRoster,
}: {
  gameId: string;
  programName: string;
  game: {
    opponent: string;
    dateLabel: string;
    level: string | null;
    home: boolean;
  };
  initialState: LiveGameState;
  initialEvents: GameEvent[];
  ourRoster: RosterEntry[];
  ourLineup: LineupEntry[];
  opposingRoster: Array<{
    id: string;
    firstName: string;
    lastName: string;
    jersey: number | null;
    positions: string[];
    teamLevel: string | null;
  }>;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<GameEvent[]>(initialEvents);
  const [state, setState] = useState<LiveGameState>(initialState);
  const [isPending, startTransition] = useTransition();

  // Derive current scoring state from the most recent event.
  const lastEvent = events[events.length - 1] ?? null;
  const currentInning = lastEvent?.inning ?? 1;
  const currentHalf = (lastEvent?.topBottom ?? (game.home ? "top" : "bottom")) as "top" | "bottom";
  const currentOuts = lastEvent?.outsAfter ?? 0;
  const currentHomeScore = lastEvent?.homeScore ?? 0;
  const currentAwayScore = lastEvent?.awayScore ?? 0;

  // Whether WE bat this half (depends on home/away)
  const weAreBatting =
    (game.home && currentHalf === "bottom") || (!game.home && currentHalf === "top");

  // PHASE 2 FIX — derive batter index from the event log instead of
  // local useState, so a refresh in the middle of an inning resumes
  // the correct batter. We bat in either the top half (if we're away)
  // or the bottom half (if we're home); count true plate-appearance
  // events (excluding pickoff / mid-game / substitution sub-events
  // that ride on the at_bat row) on our side, modulo the lineup length.
  //
  // Their batting index uses the opposing side count by symmetry.
  const ourBattingHalf: "top" | "bottom" = game.home ? "bottom" : "top";
  const theirBattingHalf: "top" | "bottom" = game.home ? "top" : "bottom";
  const isPlateAppearance = (e: GameEvent): boolean => {
    if (e.eventType !== "at_bat") return false;
    const p = e.payload as
      | { pickoff?: boolean; midGame?: boolean; substitution?: boolean }
      | null;
    if (!p) return true;
    return !p.pickoff && !p.midGame && !p.substitution;
  };
  const ourBattingIndex =
    events.filter((e) => isPlateAppearance(e) && e.topBottom === ourBattingHalf).length %
    (ourLineup.length || 1);
  const theirBattingIndex =
    opposingRoster.length > 0
      ? events.filter((e) => isPlateAppearance(e) && e.topBottom === theirBattingHalf).length %
        opposingRoster.length
      : 0;

  const currentBatter = weAreBatting
    ? ourLineup[ourBattingIndex % (ourLineup.length || 1)] ?? null
    : null;
  const onDeck = weAreBatting
    ? ourLineup[(ourBattingIndex + 1) % (ourLineup.length || 1)] ?? null
    : null;

  const currentOpposingBatter = !weAreBatting && opposingRoster.length > 0
    ? opposingRoster[theirBattingIndex % opposingRoster.length] ?? null
    : null;

  // ── Pitch-by-pitch mode ──────────────────────────────────
  // Mode is per-game in localStorage. Default 'simple' so existing
  // coaches see no behavior change.
  const [mode, setMode] = useState<ScoringMode>("simple");
  // Stable batter id for localStorage scoping — keeps pitches per batter.
  const currentBatterId: string | null = weAreBatting
    ? currentBatter?.playerId ?? null
    : currentOpposingBatter?.id ?? null;
  const [pitchState, dispatchPitch] = useReducer(reducePitchState, EMPTY_PITCH_STATE);
  // Track which batter the current pitchState was loaded for so we can
  // hydrate fresh state when the batter changes.
  const loadedBatterRef = useRef<string | null>(null);

  // On mount: hydrate mode + pitches for the initial batter.
  useEffect(() => {
    setMode(loadScoringMode(gameId));
  }, [gameId]);

  // On batter change: hydrate that batter's persisted state. Uses a ref
  // to avoid re-hydrating on every state change.
  useEffect(() => {
    if (loadedBatterRef.current === currentBatterId) return;
    loadedBatterRef.current = currentBatterId;
    const persisted = loadPitchState(gameId, currentBatterId);
    // useReducer doesn't expose a 'replace' — encode it as reset+replay.
    dispatchPitch({ kind: "reset" });
    for (const p of persisted.pitches) {
      dispatchPitch({ kind: "pitch", pitch: p.kind });
    }
  }, [gameId, currentBatterId]);

  // Write-through pitch state on every change. Cheap — single setItem
  // per pitch tap.
  useEffect(() => {
    savePitchState(gameId, currentBatterId, pitchState);
  }, [gameId, currentBatterId, pitchState]);

  /**
   * Auto-resolve walks (4 balls) and strikeouts (3 strikes).
   *
   * `lastResolvedKey` ref prevents the effect from re-firing for the
   * same (batter, status, pitchCount) combination. Without it, the
   * dispatchPitch({reset}) inside logOutcome would briefly leave the
   * status at walk/strikeout for one render before flipping to
   * in_progress — and React's effect deps would re-trigger the call.
   */
  const lastResolvedKey = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== "pitch_by_pitch") return;
    if (pitchState.status !== "walk" && pitchState.status !== "strikeout") return;
    if (isPending) return;
    const key = `${currentBatterId}-${pitchState.status}-${pitchState.pitches.length}`;
    if (lastResolvedKey.current === key) return;
    lastResolvedKey.current = key;
    const outcome: AtBatOutcome = pitchState.status === "walk" ? "BB" : "K";
    const pitches: PersistedPitch[] = pitchState.pitches.map((p) => ({
      n: p.n,
      kind: p.kind,
      loggedAt: p.loggedAt,
    }));
    // Use the existing log path so all the inning/outs/score side-
    // effects flow through one place.
    logOutcome(outcome, pitches);
    // logOutcome is intentionally outside the dep array — it's a stable
    // function in this component's scope and including it would cause
    // re-runs on every render via React's strict-mode dep checks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitchState.status, pitchState.pitches.length, currentBatterId, mode, isPending]);

  // ── Pitcher tracking ─────────────────────────────────────
  // Active pitcher is per-game in localStorage. The "current pitcher"
  // displayed elsewhere is derived from the most recent at_bat's
  // payload.pitcherId — but we keep a separate state for the UI's
  // pitcher selector so the coach can swap pitchers BEFORE the next
  // at-bat is logged.
  const [activePitcherId, setActivePitcherId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`rostr.scoring.pitcher.${gameId}`);
      if (raw) setActivePitcherId(raw);
    } catch {
      // ignore — falls back to null until coach picks
    }
  }, [gameId]);
  const changePitcher = (pitcherId: string | null) => {
    setActivePitcherId(pitcherId);
    if (typeof window === "undefined") return;
    try {
      const key = `rostr.scoring.pitcher.${gameId}`;
      if (pitcherId) window.localStorage.setItem(key, pitcherId);
      else window.localStorage.removeItem(key);
    } catch {
      // best-effort
    }
  };
  // Pitchers in our roster (anyone with "P" in their positions). When
  // we're at bat, the opposing pitcher is unknown; we still let the
  // coach assign their own pitcher for the half-inning they pitch.
  const ourPitchers = ourRoster.filter((r) => r.positions.includes("P"));
  const activePitcher = ourPitchers.find((p) => p.id === activePitcherId) ?? null;
  // Derive current pitcher from event log too — useful for displaying
  // "previous pitcher" if the coach hasn't picked a current one yet.
  const lastAtBatPitcherId = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.eventType === "at_bat") {
        const id = (e.payload as { pitcherId?: string | null })?.pitcherId;
        if (id) return id;
      }
    }
    return null;
  }, [events]);
  // If no active pitcher chosen yet but we know the last one, hydrate.
  useEffect(() => {
    if (activePitcherId == null && lastAtBatPitcherId) {
      setActivePitcherId(lastAtBatPitcherId);
    }
    // Only run when lastAtBatPitcherId changes (e.g. on initial load).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAtBatPitcherId]);

  // ── Substitution modal state ─────────────────────────────
  const [subModalOpen, setSubModalOpen] = useState(false);

  // (Sticky "error armed" toggle removed in Scoring UX Sprint —
  // errors are now marked retroactively via a per-row chip in the
  // play feed so the score-fast path never pauses.)

  // ── Opposing pitcher (free-text, when WE'RE batting) ─────
  // Stored per-game in localStorage. Sent on every at-bat we log
  // while batting so fans see the pitcher name on the public viewer.
  const [opposingPitcherName, setOpposingPitcherName] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(
        `rostr.scoring.oppPitcher.${gameId}`,
      );
      if (raw) setOpposingPitcherName(raw);
    } catch {
      // ignore
    }
  }, [gameId]);
  const updateOpposingPitcher = (name: string) => {
    setOpposingPitcherName(name);
    if (typeof window === "undefined") return;
    try {
      const key = `rostr.scoring.oppPitcher.${gameId}`;
      if (name.trim()) window.localStorage.setItem(key, name.trim());
      else window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  };

  // PHASE 6 — SB/CS base picker state. When the runner population
  // is ambiguous (>1 on base), we open this picker instead of the
  // native window.prompt that the previous helper used. Mobile
  // coaches got prompts that fought iOS Safari's keyboard; the
  // dialog gives them three big base-buttons in a sheet.
  const [sbCsPicker, setSbCsPicker] = useState<{
    kind: "stolen_base" | "caught_stealing";
    occupied: Array<1 | 2 | 3>;
    defensiveIndifference: boolean;
  } | null>(null);

  // ── Base runner state ────────────────────────────────────
  // PHASE 1.1 FIX — derive bases ONLY from the most recent at_bat
  // event's payload.runnersAfter. The previous code short-circuited
  // to EMPTY_BASES whenever currentOuts === 0, which incorrectly
  // erased runners after a leadoff hit (outs still 0, but a runner
  // is on first). The 3rd-out reset case is already handled inside
  // the AB itself: when nextOuts >= 3 the client writes
  // runnersAfter = EMPTY_BASES into the payload before insert, so
  // reading from the AB's payload gives empty runners after a half
  // flip without needing the outs-based guard.
  //
  // Inning_change events don't carry runnersAfter; they're skipped
  // by the eventType filter so we always reach back to the last
  // at_bat (which IS the 3rd-out AB after a half flip → empty).
  const currentBases = useMemo<Bases>(() => {
    const lastAtBat = [...events]
      .reverse()
      .find((e) => e.eventType === "at_bat");
    return basesFromPayload(lastAtBat?.payload ?? null);
  }, [events]);

  const toggleMode = () => {
    const next: ScoringMode = mode === "simple" ? "pitch_by_pitch" : "simple";
    setMode(next);
    saveScoringMode(gameId, next);
    if (next === "simple") {
      // Switching to simple mid-at-bat: discard pitches; coach can
      // still log the outcome directly.
      dispatchPitch({ kind: "reset" });
    }
    toast.info(
      next === "pitch_by_pitch" ? "Pitch-by-pitch mode" : "Simple mode",
      {
        description:
          next === "pitch_by_pitch"
            ? "Tap pitches; at-bat resolves automatically."
            : "Tap an outcome directly.",
      },
    );
  };

  // Realtime subscription — in case another coach on this game is
  // also scoring, their events appear here live.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`game-events:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_events",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          // Only accept home-side events into this view; our own inserts
          // also come through here, de-dupe by id.
          if (row.logged_by_side !== "home") return;
          setEvents((prev) => {
            if (prev.some((e) => e.id === row.id)) return prev;
            const next: GameEvent = {
              id: row.id as string,
              gameId: row.game_id as string,
              sequence: row.sequence as number,
              eventType: row.event_type as GameEvent["eventType"],
              inning: (row.inning as number | null) ?? null,
              topBottom: (row.top_bottom as "top" | "bottom" | null) ?? null,
              outsAfter: (row.outs_after as number | null) ?? null,
              homeScore: (row.home_score as number | null) ?? null,
              awayScore: (row.away_score as number | null) ?? null,
              playerName: null,
              playerJersey: null,
              playerId: (row.player_id as string | null) ?? null,
              payload: (row.payload as Record<string, unknown>) ?? {},
              createdAt: row.created_at as string,
              loggedBySide: "home",
            };
            return [...prev, next].sort((a, b) => a.sequence - b.sequence);
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const startGame = () => {
    startTransition(async () => {
      const r = await startLiveScoringAction(gameId);
      if (r.error) toast.error("Couldn't start", { description: r.error });
      else {
        toast.success("Live scoring started");
        setState({ ...state, liveStatus: "in_progress" });
        router.refresh();
      }
    });
  };

  const endGame = () => {
    if (!confirm("End the game? Final score will be recorded.")) return;
    startTransition(async () => {
      const r = await endLiveGameAction(gameId);
      if (r.error) toast.error("Couldn't end", { description: r.error });
      else {
        toast.success("Game finalized");
        router.push(`/app/games/${gameId}`);
      }
    });
  };

  /**
   * Log an at-bat outcome.
   *
   * `pitchesOverride` is supplied by the auto-resolve effect (4B / 3K)
   * so the persisted at-bat carries the pitch sequence. When omitted,
   * we attach whatever pitches the coach has accumulated so far —
   * nothing in simple mode, the full sequence in pitch mode.
   */
  const logOutcome = (
    outcome: AtBatOutcome,
    pitchesOverride?: PersistedPitch[],
    /**
     * Pre-resolved sacrifice sub-type — passed by the SF / SAC buttons
     * in the outcome grid. Removes the legacy prompt() flow.
     */
    sacTypeOverride?: "fly" | "bunt",
  ) => {
    // Who are we logging? (Need this BEFORE runner advancement so the
    // batter can be put on a base correctly.)
    const playerId = weAreBatting
      ? currentBatter?.playerId ?? null
      : currentOpposingBatter?.id ?? null;
    const adHocName = !weAreBatting && !currentOpposingBatter
      ? prompt("Opposing batter name?") ?? null
      : null;
    if (!playerId && !adHocName) {
      toast.error("No batter to log against");
      return;
    }

    // SAC sub-type now comes directly from which button the coach
    // tapped (SF = fly, SAC = bunt) — no prompt, no typing, 1 tap.
    const sacType: "fly" | "bunt" | null =
      outcome === "SAC" ? sacTypeOverride ?? "bunt" : null;

    // Apply runner advancement using the smart-default model. This
    // replaces the v1 "HR=1, everything else=0" run logic with proper
    // base-aware accounting (single with bases loaded scores 1, etc.).
    const adv = advanceRunners(currentBases, outcome, playerId);
    const runs = adv.runs;
    // Use outsAdded (handles GIDP=2 outs correctly) instead of isOut.
    const outsThisPlay = adv.outsAdded;
    // Explicit list of scorers from the runner-advancement model —
    // attached to the at-bat payload so box-score derivation doesn't
    // have to reverse-engineer from runner-state diffs.
    const scorers: string[] = adv.runScorers;
    let nextOuts = currentOuts + outsThisPlay;
    let nextInning = currentInning;
    let nextHalf: "top" | "bottom" = currentHalf;
    let homeScore = currentHomeScore;
    let awayScore = currentAwayScore;

    if (weAreBatting && game.home) {
      homeScore += runs;
    } else if (weAreBatting && !game.home) {
      awayScore += runs;
    } else if (!weAreBatting && game.home) {
      awayScore += runs;
    } else {
      homeScore += runs;
    }

    // Inning flip on 3 outs — bases also clear (real baseball).
    let runnersAfter = adv.bases;
    if (nextOuts >= 3) {
      nextOuts = 0;
      runnersAfter = EMPTY_BASES;
      if (currentHalf === "top") {
        nextHalf = "bottom";
      } else {
        nextHalf = "top";
        nextInning = currentInning + 1;
      }
    }

    // Compute pitches to persist. Override (auto-resolve) wins; else
    // pull from current reducer state. Empty array → omit so the action
    // skips the payload UPDATE entirely.
    const pitchesToSend: PersistedPitch[] | undefined = pitchesOverride
      ?? (pitchState.pitches.length > 0
        ? pitchState.pitches.map((p) => ({
          n: p.n,
          kind: p.kind,
          loggedAt: p.loggedAt,
        }))
        : undefined);
    const finalCount =
      pitchesToSend && pitchesToSend.length > 0
        ? { balls: pitchState.balls, strikes: pitchState.strikes }
        : undefined;

    startTransition(async () => {
      const r = await logAtBatAction({
        gameId,
        playerId,
        adHocName,
        outcome,
        rbi: 0, // v1 skips RBI tracking
        inning: currentInning,
        topBottom: currentHalf,
        outsAfter: nextOuts,
        homeScore,
        awayScore,
        pitches: pitchesToSend,
        finalCount,
        // Runner-state + pitcher land in the at-bat's payload via the
        // action's two-phase write. Together with pitches, this is the
        // full per-AB context — diamond + scoreboard + pitching stats
        // can derive everything from `payload.*`.
        pitcherId: activePitcherId,
        runnersAfter: {
          1: runnersAfter[1],
          2: runnersAfter[2],
          3: runnersAfter[3],
        },
        // Only carry the opposing-pitcher name when WE'RE batting —
        // the scoreboard reads this for the pitcher line during our
        // half-innings.
        opposingPitcherName:
          weAreBatting && opposingPitcherName.trim()
            ? opposingPitcherName.trim()
            : undefined,
        // ── Phase 2 correctness fields ──
        sacrificeType: outcome === "SAC" ? sacType : undefined,
        // Outcome E implies an error reaching the batter; otherwise
        // errors are marked retroactively via the per-row chip in the
        // play feed so the score-fast path never pauses for a toggle.
        errorOnPlay: outcome === "E" ? true : undefined,
        runScorers: scorers,
        runsOnPlay: scorers.length,
      });
      if (r.error) {
        toast.error("Couldn't log", { description: r.error });
        return;
      }
      // Batter index is now derived from the event log (Phase 2),
      // so it auto-advances when the new at_bat event lands via
      // realtime. No local setState needed.
      // Clear pitch state for the just-resolved at-bat. Hydration on
      // the NEW batter happens via the batter-change effect.
      dispatchPitch({ kind: "reset" });
      // Optimistically append (realtime will de-dupe via id match)
      // We also optimistically update the inning + outs state via the
      // event render.
      // No setState here — events list updates via realtime subscription.
      // Toast keeps the flow feeling responsive.
      const pitchSuffix =
        pitchesToSend && pitchesToSend.length > 0
          ? ` · ${pitchesToSend.length} pitch${pitchesToSend.length === 1 ? "" : "es"}`
          : "";
      toast.success(outcomeLabel(outcome), {
        description: `${currentHalf === "top" ? "Top" : "Bot"} ${currentInning} · ${nextOuts} out${pitchSuffix}`,
        duration: 1500,
      });
      if (r.pitchPersistError) {
        // Pitch sequence didn't save server-side, but the at-bat did.
        // Surface as a warning so the coach knows the count history
        // for that AB might be missing on the fan view.
        toast.warning("Pitches not saved", { description: r.pitchPersistError });
      }

      // PHASE 1 FIX — persist the inning/half advancement when the AB
      // produced the 3rd out. Without this event, lastEvent stays
      // pinned to the current half and the next at-bat would log into
      // the wrong half (runs to wrong team). Best-effort: warn but
      // don't roll back the at-bat if the inning_change insert fails.
      const halfChanged =
        nextOuts === 0 &&
        outsThisPlay > 0 &&
        (nextHalf !== currentHalf || nextInning !== currentInning);
      if (halfChanged) {
        const ic = await recordInningChangeAction({
          gameId,
          newInning: nextInning,
          newHalf: nextHalf,
          homeScore,
          awayScore,
        });
        if (ic.error) {
          toast.warning("Half didn't advance", { description: ic.error });
        } else {
          toast.message(
            `End of ${currentHalf === "top" ? "top" : "bottom"} ${currentInning}`,
            {
              description: `${nextHalf === "top" ? "Top" : "Bot"} ${nextInning} up`,
              duration: 1800,
            },
          );
        }
      }
    });
  };

  /**
   * Record a pickoff at a base. Removes the runner from that base,
   * increments outs, and (if 3rd out) flips the inning.
   *
   * Doesn't advance the batter or touch the count — pickoffs happen
   * between pitches and the SAME batter remains at the plate.
   */
  const recordPickoff = (base: 1 | 2 | 3) => {
    const runnerId = currentBases[base];
    if (!runnerId) {
      toast.error(`No runner on ${base === 1 ? "1st" : base === 2 ? "2nd" : "3rd"}`);
      return;
    }
    let nextOuts = currentOuts + 1;
    let nextInning = currentInning;
    let nextHalf: "top" | "bottom" = currentHalf;
    let runnersAfter: Bases = { ...currentBases, [base]: null };

    if (nextOuts >= 3) {
      nextOuts = 0;
      runnersAfter = EMPTY_BASES;
      if (currentHalf === "top") nextHalf = "bottom";
      else {
        nextHalf = "top";
        nextInning = currentInning + 1;
      }
    }

    startTransition(async () => {
      const r = await recordRunnerPickoffAction({
        gameId,
        runnerId,
        base,
        inning: currentInning,
        topBottom: currentHalf,
        outsAfter: nextOuts,
        homeScore: currentHomeScore,
        awayScore: currentAwayScore,
        pitcherId: activePitcherId,
        runnersAfter: {
          1: runnersAfter[1],
          2: runnersAfter[2],
          3: runnersAfter[3],
        },
      });
      if (r.error) {
        toast.error("Couldn't record pickoff", { description: r.error });
        return;
      }
      toast.success(
        `Picked off ${base === 1 ? "1st" : base === 2 ? "2nd" : "3rd"}`,
        { duration: 1500 },
      );
      // PHASE 1 FIX — persist half/inning advancement when the pickoff
      // produced the 3rd out. Same pattern as the at-bat path; without
      // this the next event would log into the wrong half.
      const halfChanged =
        nextOuts === 0 &&
        (nextHalf !== currentHalf || nextInning !== currentInning);
      if (halfChanged) {
        const ic = await recordInningChangeAction({
          gameId,
          newInning: nextInning,
          newHalf: nextHalf,
          homeScore: currentHomeScore,
          awayScore: currentAwayScore,
        });
        if (ic.error) {
          toast.warning("Half didn't advance", { description: ic.error });
        } else {
          toast.message(
            `End of ${currentHalf === "top" ? "top" : "bottom"} ${currentInning}`,
            { description: `${nextHalf === "top" ? "Top" : "Bot"} ${nextInning} up`, duration: 1800 },
          );
        }
      }
    });
  };

  /**
   * Record a mid-game event (SB, CS, WP, PB, BK).
   *
   * Computes the new bases + outs + score from the pure logic in
   * mid-game-events, then persists. Inning flip on 3rd-out (CS only)
   * mirrors the at-bat path.
   */
  const recordMidGame = (
    kind: MidGameKind,
    fromBase?: 1 | 2 | 3,
    /** When true, the stolen_base event records as defensive
     *  indifference (no SB stat credited to the runner). Wired by
     *  the dedicated "DI" button. */
    defensiveIndifference?: boolean,
  ) => {
    // Validate fromBase for SB/CS.
    if ((kind === "stolen_base" || kind === "caught_stealing") && !fromBase) {
      toast.error("Pick which base the runner came from");
      return;
    }
    if (
      (kind === "stolen_base" || kind === "caught_stealing") &&
      fromBase &&
      !currentBases[fromBase]
    ) {
      toast.error(`No runner on ${fromBase === 1 ? "1st" : fromBase === 2 ? "2nd" : "3rd"}`);
      return;
    }

    const result = applyMidGameEvent(currentBases, kind, fromBase);
    let nextOuts = currentOuts + result.outsAdded;
    let nextHalf: "top" | "bottom" = currentHalf;
    let nextInning = currentInning;
    let runnersAfter = result.bases;

    let homeScore = currentHomeScore;
    let awayScore = currentAwayScore;
    if (weAreBatting && game.home) homeScore += result.runs;
    else if (weAreBatting && !game.home) awayScore += result.runs;
    else if (!weAreBatting && game.home) awayScore += result.runs;
    else homeScore += result.runs;

    if (nextOuts >= 3) {
      nextOuts = 0;
      runnersAfter = EMPTY_BASES;
      if (currentHalf === "top") nextHalf = "bottom";
      else {
        nextHalf = "top";
        nextInning = currentInning + 1;
      }
    }

    const runnerId = fromBase ? currentBases[fromBase] : null;

    startTransition(async () => {
      const r = await recordMidGameEventAction({
        gameId,
        kind,
        fromBase: fromBase ?? null,
        runnerId: runnerId ?? null,
        inning: currentInning,
        topBottom: currentHalf,
        outsAfter: nextOuts,
        homeScore,
        awayScore,
        pitcherId: activePitcherId,
        runnersAfter: {
          1: runnersAfter[1],
          2: runnersAfter[2],
          3: runnersAfter[3],
        },
        defensiveIndifference: defensiveIndifference || undefined,
      });
      if (r.error) {
        toast.error("Couldn't record event", { description: r.error });
        return;
      }
      toast.success(result.description, { duration: 1500 });
      // PHASE 1 FIX — persist half/inning advancement when this
      // mid-game event (CS only, since SB/WP/PB/BK don't add outs)
      // produced the 3rd out. Same pattern as the at-bat path.
      const halfChanged =
        nextOuts === 0 &&
        result.outsAdded > 0 &&
        (nextHalf !== currentHalf || nextInning !== currentInning);
      if (halfChanged) {
        const ic = await recordInningChangeAction({
          gameId,
          newInning: nextInning,
          newHalf: nextHalf,
          homeScore,
          awayScore,
        });
        if (ic.error) {
          toast.warning("Half didn't advance", { description: ic.error });
        } else {
          toast.message(
            `End of ${currentHalf === "top" ? "top" : "bottom"} ${currentInning}`,
            { description: `${nextHalf === "top" ? "Top" : "Bot"} ${nextInning} up`, duration: 1800 },
          );
        }
      }
    });
  };

  /**
   * Manual base override — coach corrects who's on each base after the
   * smart-default got it wrong (FC where a different runner was tagged,
   * E with multiple advances, etc.). Doesn't change score or outs;
   * use mid-game events for those.
   */
  const overrideBases = (newBases: Bases) => {
    startTransition(async () => {
      const r = await overrideBasesAction({
        gameId,
        inning: currentInning,
        topBottom: currentHalf,
        outsAfter: currentOuts,
        homeScore: currentHomeScore,
        awayScore: currentAwayScore,
        pitcherId: activePitcherId,
        runnersAfter: {
          1: newBases[1],
          2: newBases[2],
          3: newBases[3],
        },
      });
      if (r.error) {
        toast.error("Couldn't update bases", { description: r.error });
        return;
      }
      toast.success("Bases updated", { duration: 1200 });
    });
  };

  /**
   * Substitute a player into the lineup (pinch hit / pinch run /
   * defensive). For pinch_run, also updates the runner state so the
   * new player is the one on the base.
   */
  const substitute = (input: {
    battingOrder: number;
    outPlayerId: string;
    inPlayerId: string;
    kind: "pinch_hit" | "pinch_run" | "defensive";
    position?: string;
    /** For pinch_run: which base the substitution is happening at. */
    runOnBase?: 1 | 2 | 3;
  }) => {
    // PH count inheritance — when a pinch hitter takes over mid-AB,
    // they inherit the count (MLB rule). We copy the outgoing player's
    // pitch-state localStorage entry to the incoming player so the next
    // batter-change effect picks it up automatically.
    if (input.kind === "pinch_hit" && typeof window !== "undefined") {
      try {
        const outKey = `rostr.pitches.${gameId}.${input.outPlayerId}`;
        const inKey = `rostr.pitches.${gameId}.${input.inPlayerId}`;
        const raw = window.localStorage.getItem(outKey);
        if (raw) {
          window.localStorage.setItem(inKey, raw);
          window.localStorage.removeItem(outKey);
        }
      } catch {
        // best-effort — failure means the new batter starts a fresh count
      }
    }
    let runnersAfter = currentBases;
    if (input.kind === "pinch_run" && input.runOnBase) {
      runnersAfter = { ...currentBases, [input.runOnBase]: input.inPlayerId };
    }
    startTransition(async () => {
      const r = await substituteAction({
        gameId,
        battingOrder: input.battingOrder,
        outPlayerId: input.outPlayerId,
        inPlayerId: input.inPlayerId,
        kind: input.kind,
        position: input.position,
        inning: currentInning,
        topBottom: currentHalf,
        outsAfter: currentOuts,
        homeScore: currentHomeScore,
        awayScore: currentAwayScore,
        pitcherId: activePitcherId,
        runnersAfter:
          input.kind === "pinch_run"
            ? {
                1: runnersAfter[1],
                2: runnersAfter[2],
                3: runnersAfter[3],
              }
            : undefined,
      });
      if (r.error) {
        toast.error("Couldn't substitute", { description: r.error });
        return;
      }
      const label =
        input.kind === "pinch_hit"
          ? "Pinch hitter in"
          : input.kind === "pinch_run"
            ? "Pinch runner in"
            : "Defensive sub";
      toast.success(label, { duration: 1500 });
      // Lineup state on the page comes from server props; nudge a refresh
      // so the next batter card reflects the swap.
      router.refresh();
    });
  };

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/g/${gameId}`
    : `/g/${gameId}`;

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Fan link copied", { description: shareUrl });
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const notStarted = state.liveStatus === "not_started";
  const finalized = state.liveStatus === "final";

  // Score display: our vs. their regardless of home/away
  const ourDisplayScore = game.home ? currentHomeScore : currentAwayScore;
  const theirDisplayScore = game.home ? currentAwayScore : currentHomeScore;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Top bar */}
      <div className="bg-ink text-white px-3 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link
          href={`/app/games/${gameId}`}
          className="w-9 h-9 inline-flex items-center justify-center rounded-sm hover:bg-white/10"
          aria-label="Back"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-white/60 truncate">
            {programName}
            {game.level ? ` · ${game.level}` : ""}
          </div>
          <div className="font-display text-[15px] font-semibold truncate flex items-center gap-1.5">
            {game.home ? "vs" : "@"} {game.opponent}
            {state.liveStatus === "in_progress" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red rounded-xs text-[9px] font-bold tracking-[0.08em] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-live" />
                Live
              </span>
            )}
          </div>
        </div>
        {/* Mode toggle — pitch-by-pitch is opt-in per game. Persisted
            to localStorage so a coach who prefers pitches keeps the
            mode across page loads. */}
        <button
          type="button"
          onClick={toggleMode}
          className={cn(
            "min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-sm",
            mode === "pitch_by_pitch" ? "bg-red text-white" : "hover:bg-white/10",
          )}
          aria-label={`Scoring mode: ${mode === "pitch_by_pitch" ? "pitch-by-pitch" : "simple"}. Tap to toggle.`}
          title={
            mode === "pitch_by_pitch"
              ? "Pitch-by-pitch mode (tap for simple)"
              : "Simple mode (tap for pitch-by-pitch)"
          }
        >
          <Zap className="w-4 h-4" />
        </button>
        <button
          onClick={copyShare}
          className="w-9 h-9 inline-flex items-center justify-center rounded-sm hover:bg-white/10"
          aria-label="Share fan link"
          title="Share fan link"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Score + inning banner */}
      <div className="bg-card border-b border-hair px-4 py-4">
        <div className="grid grid-cols-[1fr_80px_1fr] items-center gap-3">
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-3">
              {game.home ? "Us" : "Away"}
            </div>
            <div className="font-mono text-[48px] font-bold leading-none tracking-[-0.03em] mt-1">
              {ourDisplayScore}
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-[11px] text-ink-3 font-bold">
              {currentHalf === "top" ? "TOP" : "BOT"}
            </div>
            <div className="font-mono text-[24px] font-bold leading-none mt-1">
              {currentInning}
            </div>
            <div className="font-mono text-[10px] text-ink-3 mt-1">
              {currentOuts} OUT
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-3">
              {game.opponent.slice(0, 12)}
            </div>
            <div className="font-mono text-[48px] font-bold leading-none tracking-[-0.03em] mt-1 text-ink-3">
              {theirDisplayScore}
            </div>
          </div>
        </div>
      </div>

      {/* Not started → start button */}
      {notStarted && (
        <div className="p-6 text-center">
          <div className="font-display text-[18px] font-semibold tracking-tight">
            Ready to start scoring?
          </div>
          <p className="text-[12.5px] text-ink-3 mt-1 max-w-[320px] mx-auto">
            Tap below to kick off live scoring. Fans watching at the share
            link will see every event as it happens.
          </p>
          <button
            onClick={startGame}
            disabled={isPending}
            className="mt-4 inline-flex items-center gap-1.5 px-5 py-3 bg-red hover:bg-red/90 text-white rounded-sm text-[14px] font-bold disabled:opacity-60"
          >
            <Play className="w-4 h-4" />
            {isPending ? "Starting…" : "Start game"}
          </button>
        </div>
      )}

      {/* Finalized → done state */}
      {finalized && (
        <div className="p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-grass mx-auto" />
          <div className="font-display text-[22px] font-semibold tracking-tight mt-3">
            Game final
          </div>
          <Link
            href={`/app/games/${gameId}`}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-ink hover:bg-red text-white rounded-sm text-[13px] font-semibold"
          >
            View recap →
          </Link>
        </div>
      )}

      {/* Active scoring UI */}
      {state.liveStatus === "in_progress" && (
        <>
          {/* Current batter */}
          <div className="px-4 py-3 bg-paper border-b border-hair-2">
            <div className="type-label mb-1">
              {weAreBatting ? "At bat (us)" : "At bat (opp)"}
            </div>
            {weAreBatting && currentBatter ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-red text-white flex items-center justify-center font-mono text-[15px] font-bold">
                  {currentBatter.jersey ?? "—"}
                </div>
                <div className="flex-1">
                  <div className="font-display text-[16px] font-semibold leading-tight">
                    {currentBatter.firstName} {currentBatter.lastName}
                  </div>
                  <div className="font-mono text-[10.5px] text-ink-3 mt-0.5">
                    Batting {currentBatter.battingOrder} · {currentBatter.position}
                    {onDeck && ` · On deck: ${onDeck.firstName[0]}. ${onDeck.lastName}`}
                  </div>
                </div>
              </div>
            ) : !weAreBatting && currentOpposingBatter ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-ink-3 text-white flex items-center justify-center font-mono text-[15px] font-bold">
                  {currentOpposingBatter.jersey ?? "—"}
                </div>
                <div className="flex-1">
                  <div className="font-display text-[16px] font-semibold leading-tight">
                    {currentOpposingBatter.firstName} {currentOpposingBatter.lastName}
                  </div>
                  <div className="font-mono text-[10.5px] text-ink-3 mt-0.5">
                    {currentOpposingBatter.positions.join("/") || "—"} · linked opponent roster
                  </div>
                </div>
              </div>
            ) : !weAreBatting ? (
              <div className="px-3 py-2 bg-card rounded-sm border border-dashed border-hair text-[12px] text-ink-3">
                Opposing team not linked — outcomes will prompt for a name.{" "}
                <Link href={`/app/games/${gameId}`} className="text-red font-semibold">
                  Link their program?
                </Link>
              </div>
            ) : ourLineup.length === 0 ? (
              <div className="px-3 py-2 bg-card rounded-sm border border-dashed border-hair text-[12px] text-ink-3">
                No lineup set.{" "}
                <Link href={`/app/games/${gameId}`} className="text-red font-semibold">
                  Build one →
                </Link>
              </div>
            ) : null}
          </div>

          {/* Pitcher + bases strip — completes the game-state context. */}
          <div className="px-3 pt-4 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Pitcher card */}
            <div className="bg-paper border border-hair rounded-md px-3 py-2.5">
              <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1">
                {weAreBatting ? "Opposing pitcher" : "Pitching"}
              </div>
              {weAreBatting ? (
                // Free-text input — the opposing pitcher isn't in our
                // roster, so we just store a name. Persists per-game in
                // localStorage and rides with each at-bat we log.
                <input
                  type="text"
                  value={opposingPitcherName}
                  onChange={(e) => updateOpposingPitcher(e.target.value)}
                  placeholder="e.g. #14 J. Walker"
                  className="w-full bg-card border border-hair rounded-sm px-2 py-1.5 text-[13px] font-semibold outline-none focus:border-red"
                  aria-label="Opposing pitcher name"
                />
              ) : ourPitchers.length > 0 ? (
                <select
                  value={activePitcherId ?? ""}
                  onChange={(e) => changePitcher(e.target.value || null)}
                  className="w-full bg-card border border-hair rounded-sm px-2 py-1.5 text-[13px] font-semibold outline-none focus:border-red"
                  aria-label="Active pitcher"
                >
                  <option value="">— Pick pitcher —</option>
                  {ourPitchers.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.jersey ?? "?"} {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-[12px] text-ink-3">
                  No P-eligible roster
                </div>
              )}
              {!weAreBatting && activePitcher && (
                <div className="mt-1 font-mono text-[10px] text-ink-3">
                  Throwing now ·{" "}
                  {events.filter(
                    (e) =>
                      e.eventType === "at_bat" &&
                      (e.payload as { pitcherId?: string })?.pitcherId ===
                        activePitcher.id,
                  ).length}{" "}
                  AB faced
                </div>
              )}
            </div>

            {/* Bases card — editable per-base + pickoff buttons */}
            <div className="bg-paper border border-hair rounded-md px-3 py-2.5">
              <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1 flex items-center justify-between">
                <span>Bases · {describeBases(currentBases)}</span>
                <button
                  type="button"
                  onClick={() => setSubModalOpen(true)}
                  className="font-bold text-red hover:underline"
                  title="Pinch hit / pinch run / defensive sub"
                >
                  Sub
                </button>
              </div>
              {/* Per-base editor: dropdown lets coach assign any roster
                  player (or none) to each base. Smart-default got it
                  wrong? Override here without undoing the at-bat. */}
              <BasesEditor
                bases={currentBases}
                roster={ourRoster}
                disabled={isPending}
                onChange={overrideBases}
              />
              {/* Pickoff row — one button per base */}
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {([1, 2, 3] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => recordPickoff(b)}
                    disabled={!currentBases[b] || isPending}
                    className={cn(
                      "min-h-[40px] rounded-sm text-[11px] font-bold uppercase tracking-[0.06em] border transition-colors",
                      currentBases[b]
                        ? "bg-red text-white border-red hover:bg-red/90 active:bg-red/80"
                        : "bg-card text-ink-4 border-hair cursor-default",
                    )}
                    title={
                      currentBases[b]
                        ? `Pickoff at ${b === 1 ? "1st" : b === 2 ? "2nd" : "3rd"}`
                        : `${b === 1 ? "1st" : b === 2 ? "2nd" : "3rd"} empty`
                    }
                  >
                    {currentBases[b] ? `PO ${b}` : `${b === 1 ? "1st" : b === 2 ? "2nd" : "3rd"}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mid-game events row — SB / DI / CS / WP / PB / BK.
              DI is a dedicated button (no confirm dialog) so coaches
              record defensive indifference in one tap. Layout: 3-col
              on phones, 6-col on tablets+. */}
          <div className="px-3 pb-2">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1">
              Mid-AB events
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              <MidGameButton
                label="SB"
                title="Stolen base — pick base"
                disabled={
                  isPending ||
                  (!currentBases[1] && !currentBases[2] && !currentBases[3])
                }
                onTap={() =>
                  resolveSBOrCS(
                    "stolen_base",
                    currentBases,
                    recordMidGame,
                    (kind, occupied) =>
                      setSbCsPicker({ kind, occupied, defensiveIndifference: false }),
                  )
                }
              />
              <MidGameButton
                label="DI"
                title="Defensive indifference — runner advances, no SB credit"
                disabled={
                  isPending ||
                  (!currentBases[1] && !currentBases[2] && !currentBases[3])
                }
                onTap={() =>
                  resolveSBOrCS(
                    "stolen_base",
                    currentBases,
                    (kind, base) => recordMidGame(kind, base, true),
                    (kind, occupied) =>
                      setSbCsPicker({ kind, occupied, defensiveIndifference: true }),
                  )
                }
              />
              <MidGameButton
                label="CS"
                title="Caught stealing — pick base, +1 out"
                disabled={
                  isPending ||
                  (!currentBases[1] && !currentBases[2] && !currentBases[3])
                }
                onTap={() =>
                  resolveSBOrCS(
                    "caught_stealing",
                    currentBases,
                    recordMidGame,
                    (kind, occupied) =>
                      setSbCsPicker({ kind, occupied, defensiveIndifference: false }),
                  )
                }
              />
              <MidGameButton
                label="WP"
                title="Wild pitch — all runners advance"
                disabled={
                  isPending ||
                  (!currentBases[1] && !currentBases[2] && !currentBases[3])
                }
                onTap={() => recordMidGame("wild_pitch")}
              />
              <MidGameButton
                label="PB"
                title="Passed ball — all runners advance"
                disabled={
                  isPending ||
                  (!currentBases[1] && !currentBases[2] && !currentBases[3])
                }
                onTap={() => recordMidGame("passed_ball")}
              />
              <MidGameButton
                label="BK"
                title="Balk — all runners advance"
                disabled={
                  isPending ||
                  (!currentBases[1] && !currentBases[2] && !currentBases[3])
                }
                onTap={() => recordMidGame("balk")}
              />
            </div>
          </div>

          {/* Pitch-by-pitch UI (when mode === pitch_by_pitch) */}
          {mode === "pitch_by_pitch" && (
            <div className="px-3 pt-4 pb-2 space-y-3">
              <PitchCount
                state={pitchState}
                pitchSequence={pitchSummary(pitchState.pitches)}
              />
              {pitchState.status === "in_progress" && (
                <PitchKeypad
                  onPitch={(p: PitchKind) => dispatchPitch({ kind: "pitch", pitch: p })}
                  onUndo={() => dispatchPitch({ kind: "undo" })}
                  disabled={isPending}
                  hasPitches={pitchState.pitches.length > 0}
                />
              )}
              {pitchState.status === "in_play" && (
                <div className="px-3 py-2.5 bg-grass-dim text-grass rounded-md text-[12.5px] font-semibold text-center">
                  Ball in play — pick the result below
                </div>
              )}
              {(pitchState.status === "walk" ||
                pitchState.status === "strikeout") && (
                <div className="px-3 py-2.5 bg-paper rounded-md text-[12.5px] font-semibold text-center text-ink-3 inline-flex items-center justify-center gap-2 w-full">
                  Resolving{" "}
                  <span className="font-mono text-ink">
                    {pitchState.status === "walk" ? "BB" : "K"}
                  </span>
                  …
                </div>
              )}
            </div>
          )}

          {/* Outcome buttons.
              Always available in simple mode. In pitch-by-pitch mode,
              hidden until the at-bat is "in_play" (a non-walk/K result)
              so the coach picks the actual outcome (1B, HR, GO, etc.). */}
          {(mode === "simple" || pitchState.status === "in_play") && (
            <div className="px-3 py-4 grid grid-cols-4 gap-2">
              {/* Hits (top row) */}
              <OutcomeButton outcome="1B" label="1B" sublabel="Single" onTap={logOutcome} disabled={isPending} />
              <OutcomeButton outcome="2B" label="2B" sublabel="Double" onTap={logOutcome} disabled={isPending} />
              <OutcomeButton outcome="3B" label="3B" sublabel="Triple" onTap={logOutcome} disabled={isPending} />
              <OutcomeButton outcome="HR" label="HR" sublabel="Home run" onTap={logOutcome} disabled={isPending} accent />
              {/* Reach-on-non-hit row */}
              <OutcomeButton outcome="BB" label="BB" sublabel="Walk" onTap={logOutcome} disabled={isPending} />
              <OutcomeButton outcome="HBP" label="HBP" sublabel="Hit by pitch" onTap={logOutcome} disabled={isPending} />
              <OutcomeButton outcome="E" label="E" sublabel="Error" onTap={logOutcome} disabled={isPending} />
              <OutcomeButton outcome="FC" label="FC" sublabel="Fielder's choice" onTap={logOutcome} disabled={isPending} />
              {/* Outs row */}
              <OutcomeButton outcome="K" label="K" sublabel="Strikeout" onTap={logOutcome} disabled={isPending} out />
              <OutcomeButton outcome="GO" label="GO" sublabel="Ground out" onTap={logOutcome} disabled={isPending} out />
              <OutcomeButton outcome="FO" label="FO" sublabel="Fly / pop out" onTap={logOutcome} disabled={isPending} out />
              <OutcomeButton outcome="GIDP" label="GIDP" sublabel="Double play (2 outs)" onTap={logOutcome} disabled={isPending} out />
              {/* Sacrifices + special — split SAC into SF and SAC so a
                  coach picks the type with one tap (no prompt). */}
              <OutcomeButton
                outcome="SAC"
                label="SF"
                sublabel="Sac fly (RBI)"
                onTap={(o) => logOutcome(o, undefined, "fly")}
                disabled={isPending}
              />
              <OutcomeButton
                outcome="SAC"
                label="SAC"
                sublabel="Sac bunt (no RBI)"
                onTap={(o) => logOutcome(o, undefined, "bunt")}
                disabled={isPending}
              />
              <OutcomeButton outcome="CI" label="CI" sublabel="Catcher's interference" onTap={logOutcome} disabled={isPending} />
              {/* Empty slot for visual balance — fills the 4-col grid
                  without making any one button feel orphaned. */}
              <div aria-hidden />
            </div>
          )}

          {/* Event log */}
          <div className="flex-1 overflow-auto px-3 pb-4">
            <div className="flex items-center gap-2 mb-2 pt-2">
              <div className="type-label">Play-by-play</div>
              <span className="font-mono text-[11px] text-ink-3">
                {events.length} event{events.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-1">
              {events
                .slice()
                .reverse()
                .slice(0, 25)
                .map((e) => (
                  <EventRow
                    key={e.id}
                    event={e}
                    onCycleError={(eventId, currentErrors) => {
                      // Cycle: 0 → 1 → 2 → 0
                      const next = (currentErrors + 1) % 3;
                      startTransition(async () => {
                        const r = await markEventErrorAction(eventId, next);
                        if (r.error) {
                          toast.error("Couldn't mark error", { description: r.error });
                          return;
                        }
                        toast.success(
                          next === 0
                            ? "Error cleared"
                            : `${next} error${next === 1 ? "" : "s"} on play`,
                          { duration: 1200 },
                        );
                        router.refresh();
                      });
                    }}
                  />
                ))}
              {events.length === 0 && (
                <div className="text-[12px] text-ink-3 px-2 py-1">
                  No events yet — tap an outcome above.
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="border-t border-hair bg-card px-3 py-3 flex gap-2 sticky bottom-0">
            <button
              type="button"
              onClick={() => {
                // Don't no-op silently if there's nothing to undo.
                const lastAtBat = events
                  .slice()
                  .reverse()
                  .find((e) => e.eventType === "at_bat");
                if (!lastAtBat) {
                  toast.error("Nothing to undo yet");
                  return;
                }
                if (
                  !window.confirm(
                    `Undo last at-bat${lastAtBat.playerName ? ` (${lastAtBat.playerName})` : ""}? This deletes the play and rolls back the score.`,
                  )
                )
                  return;
                startTransition(async () => {
                  const r = await undoLastAtBatAction(gameId);
                  if (r.error) {
                    toast.error("Couldn't undo", { description: r.error });
                    return;
                  }
                  // Optimistically remove the event so the coach sees
                  // the rollback before realtime catches up. Realtime
                  // doesn't broadcast DELETEs on this channel, so this
                  // also patches the long-term display until refresh.
                  // PHASE 1.2 — also remove any inning_change events
                  // sequenced after the undone AB (paired half-flip).
                  // The server action deletes them too; we mirror that
                  // here so the client view reverts to the correct
                  // (inning, half, outs, bases) without a refresh.
                  setEvents((prev) =>
                    prev.filter((e) => {
                      if (
                        e.eventType === "at_bat" &&
                        e.sequence === lastAtBat.sequence
                      ) {
                        return false;
                      }
                      if (
                        e.eventType === "inning_change" &&
                        e.sequence > lastAtBat.sequence
                      ) {
                        return false;
                      }
                      return true;
                    }),
                  );
                  // Batter index auto-rolls back: derived from the
                  // event log, and we just removed the last at-bat
                  // optimistically (next render shows the previous batter).
                  toast.success("Undone", {
                    description: r.undone?.playerName
                      ? `${r.undone.playerName} · ${r.undone.outcome}`
                      : r.undone?.outcome,
                  });
                });
              }}
              disabled={isPending}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-paper hover:bg-paper-deep text-ink-2 rounded-sm text-[12.5px] font-semibold disabled:opacity-50"
            >
              <Undo2 className="w-3.5 h-3.5" /> Undo last
            </button>
            <button
              type="button"
              onClick={endGame}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-ink hover:bg-red text-white rounded-sm text-[12.5px] font-semibold"
            >
              <Flag className="w-3.5 h-3.5" /> End game
            </button>
          </div>
        </>
      )}

      <SubstitutionModal
        open={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        lineup={ourLineup}
        roster={ourRoster}
        bases={currentBases}
        disabled={isPending}
        onSubmit={(input) => {
          substitute(input);
          setSubModalOpen(false);
        }}
      />
      {/* PHASE 6 — SB/CS picker dialog. Replaces the legacy
          window.prompt with three big tap targets in a Radix Dialog
          that respects safe-area-insets and stays out of iOS Safari's
          way. Only renders when the coach taps SB / DI / CS with
          multiple runners on base. */}
      <SbCsPicker
        state={sbCsPicker}
        onClose={() => setSbCsPicker(null)}
        onPick={(kind, base, di) => {
          setSbCsPicker(null);
          recordMidGame(kind, base, di);
        }}
      />
    </div>
  );
}

/**
 * SbCsPicker — small dialog asking which base the runner came from.
 * Shows one big tap-target per occupied base (1B / 2B / 3B). Tapping
 * fires `onPick` with the base + the picker's kind (SB or CS) +
 * defensiveIndifference flag (set when the SB button was tapped via DI).
 */
function SbCsPicker({
  state,
  onClose,
  onPick,
}: {
  state: {
    kind: "stolen_base" | "caught_stealing";
    occupied: Array<1 | 2 | 3>;
    defensiveIndifference: boolean;
  } | null;
  onClose: () => void;
  onPick: (
    kind: "stolen_base" | "caught_stealing",
    base: 1 | 2 | 3,
    defensiveIndifference: boolean,
  ) => void;
}) {
  const verb = state?.kind === "stolen_base" ? "stolen" : "caught";
  const title = state?.defensiveIndifference
    ? "Defensive indifference"
    : state?.kind === "stolen_base"
      ? "Stolen base"
      : "Caught stealing";
  return (
    <Dialog.Root open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[95] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[96]",
            "w-[88vw] max-w-[360px] bg-card rounded-2xl shadow-modal border border-hair p-5",
          )}
        >
          <Dialog.Title className="font-display text-[17px] font-bold tracking-tight text-ink">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-[12.5px] text-ink-3 mt-1">
            Which base is the runner {verb} from?
          </Dialog.Description>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {([1, 2, 3] as const).map((b) => {
              const enabled = state?.occupied.includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  disabled={!enabled}
                  onClick={() =>
                    state &&
                    onPick(state.kind, b, state.defensiveIndifference)
                  }
                  className={cn(
                    "h-16 rounded-xl font-display text-[20px] font-bold tracking-tight",
                    "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.94]",
                    enabled
                      ? "bg-ink text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.4)]"
                      : "bg-paper-deep text-ink-4 opacity-50",
                  )}
                >
                  {b === 1 ? "1B" : b === 2 ? "2B" : "3B"}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full h-10 rounded-full bg-paper-deep text-ink-2 text-[13px] font-semibold active:scale-[0.97] transition-transform"
          >
            Cancel
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function OutcomeButton({
  outcome: _outcome,
  label,
  sublabel,
  onTap,
  disabled,
  accent,
  out,
}: {
  outcome: AtBatOutcome;
  label: string;
  sublabel: string;
  onTap: (o: AtBatOutcome) => void;
  disabled?: boolean;
  accent?: boolean;
  out?: boolean;
}) {
  return (
    <button
      onClick={() => onTap(_outcome)}
      disabled={disabled}
      className={cn(
        "aspect-square flex flex-col items-center justify-center rounded-md text-center transition-all active:scale-95",
        accent
          ? "bg-red text-white"
          : out
            ? "bg-paper-deep text-ink-2 border border-ink-3"
            : "bg-card border border-hair text-ink",
        !disabled && !accent && "hover:border-ink hover:bg-paper",
        disabled && "opacity-50",
      )}
    >
      <span className="font-display text-[22px] font-bold leading-none">{label}</span>
      <span className="text-[9.5px] text-ink-3 mt-1 font-semibold uppercase tracking-[0.04em]">
        {sublabel}
      </span>
    </button>
  );
}

function EventRow({
  event,
  onCycleError,
}: {
  event: GameEvent;
  onCycleError?: (eventId: string, currentErrors: number) => void;
}) {
  if (event.eventType !== "at_bat") {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-paper rounded-sm text-[11.5px] text-ink-3 italic">
        <ChevronRight className="w-3 h-3 shrink-0" />
        {formatSystemEvent(event)}
      </div>
    );
  }
  const outcome = (event.payload.outcome as AtBatOutcome) ?? "—";
  // Pull current error state from payload so the chip shows accurate
  // count (and skips clutter when no error).
  const errorsOnPlay =
    ((event.payload as { errorsOnPlay?: number }).errorsOnPlay ?? 0) |
    ((event.payload as { errorOnPlay?: boolean }).errorOnPlay ? 1 : 0);
  // midGame / pickoff / substitution events shouldn't get the error
  // chip (they're not at-bats from a stat perspective).
  const isAB = !(
    (event.payload as { pickoff?: boolean; midGame?: boolean; substitution?: boolean }).pickoff ||
    (event.payload as { midGame?: boolean }).midGame ||
    (event.payload as { substitution?: boolean }).substitution
  );
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-card border border-hair-2 rounded-sm">
      <span className="font-mono text-[10.5px] font-bold text-ink-3 w-10 shrink-0">
        {event.topBottom === "top" ? "T" : "B"}
        {event.inning ?? "?"} · {event.outsAfter ?? 0}o
      </span>
      <span className={cn(
        "font-mono font-bold text-[12px] min-w-[28px] text-center rounded-xs px-1.5 py-0.5",
        outcomeColor(outcome),
      )}>
        {outcome}
      </span>
      <span className="flex-1 text-[12px] truncate font-semibold">
        {event.playerName ?? "Unknown"}
      </span>
      {/* Error chip — tap to cycle 0 → 1 → 2 → 0. Drives unearned-run
          accounting in the box score without the legacy sticky toggle. */}
      {isAB && onCycleError && (
        <button
          type="button"
          onClick={() => onCycleError(event.id, errorsOnPlay)}
          className={cn(
            "min-w-[36px] min-h-[32px] inline-flex items-center justify-center rounded-xs border font-mono text-[10.5px] font-bold transition-colors",
            errorsOnPlay > 0
              ? "bg-amber text-white border-amber"
              : "bg-paper border-hair text-ink-3 hover:border-amber",
          )}
          title={
            errorsOnPlay === 0
              ? "Mark this play as having an error"
              : `${errorsOnPlay} error${errorsOnPlay === 1 ? "" : "s"} — tap to cycle`
          }
          aria-label={`Error count for this play: ${errorsOnPlay}. Tap to cycle.`}
        >
          {errorsOnPlay === 0 ? "⚠" : `⚠${errorsOnPlay}`}
        </button>
      )}
      <span className="font-mono text-[10.5px] text-ink-3 ml-1">
        {event.homeScore}-{event.awayScore}
      </span>
    </div>
  );
}

function formatSystemEvent(e: GameEvent): string {
  if (e.eventType === "game_start") return "Game started";
  if (e.eventType === "game_end")
    return `Game final — ${e.homeScore}-${e.awayScore}`;
  if (e.eventType === "inning_change") return `Inning ${e.inning ?? "?"}`;
  if (e.eventType === "substitution") return "Substitution";
  return e.eventType;
}

function outcomeLabel(o: AtBatOutcome): string {
  const map: Record<AtBatOutcome, string> = {
    "1B": "Single",
    "2B": "Double",
    "3B": "Triple",
    HR: "Home run",
    BB: "Walk",
    HBP: "HBP",
    K: "Strikeout",
    GO: "Ground out",
    FO: "Fly out",
    E: "Reached on error",
    FC: "Fielder's choice",
    GIDP: "Double play",
    CI: "Catcher's interference",
    SAC: "Sacrifice",
  };
  return map[o];
}

function outcomeColor(o: AtBatOutcome): string {
  if (o === "1B" || o === "2B" || o === "3B" || o === "HR") return "bg-grass-dim text-grass";
  if (o === "BB" || o === "HBP") return "bg-sky-soft text-sky";
  if (o === "K" || o === "GO" || o === "FO") return "bg-red-soft text-red";
  return "bg-paper-deep text-ink-2";
}

// Silence unused import warnings if scaffolded references don't land
void Pause;
void Users;

// ─────────────────────────────────────────────────────────────
// Mid-game support components
// ─────────────────────────────────────────────────────────────

/**
 * MidGameButton — compact button used in the SB/CS/WP/PB/BK row.
 * 40px tap target, monospaced two-letter label.
 */
function MidGameButton({
  label,
  title,
  disabled,
  onTap,
}: {
  label: string;
  title: string;
  disabled?: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      title={title}
      className={cn(
        "min-h-[40px] rounded-sm font-mono text-[12px] font-bold uppercase tracking-[0.06em] border transition-colors",
        disabled
          ? "bg-card text-ink-4 border-hair cursor-default"
          : "bg-paper text-ink border-hair hover:border-ink hover:bg-card active:bg-paper-deep",
      )}
    >
      {label}
    </button>
  );
}

/**
 * PHASE 6 — promptSBOrCS now resolves a base choice WITHOUT calling
 * the native browser prompt (terrible UX on mobile, especially when
 * the keyboard pops to type a digit). If ≤1 runner is on, fires
 * immediately. If multiple, the caller is expected to open a picker
 * UI and call `onPick` from there. We keep the helper so the existing
 * call sites stay terse — but multi-runner cases now open the
 * SbCsPicker dialog rendered at the bottom of the view.
 */
function resolveSBOrCS(
  kind: "stolen_base" | "caught_stealing",
  bases: Bases,
  onPick: (kind: "stolen_base" | "caught_stealing", from: 1 | 2 | 3) => void,
  onNeedPicker: (
    kind: "stolen_base" | "caught_stealing",
    occupied: Array<1 | 2 | 3>,
  ) => void,
) {
  const occupied: Array<1 | 2 | 3> = [];
  if (bases[1]) occupied.push(1);
  if (bases[2]) occupied.push(2);
  if (bases[3]) occupied.push(3);
  if (occupied.length === 0) return;
  if (occupied.length === 1) {
    onPick(kind, occupied[0]);
    return;
  }
  onNeedPicker(kind, occupied);
}

/**
 * BasesEditor — three small dropdowns, one per base, letting the coach
 * override who's currently on each base. Used to fix smart-default
 * mistakes (FC where the trailing runner was tagged, etc.) without
 * having to undo the full at-bat.
 *
 * Empty + every roster player are the choices. Selecting "(empty)"
 * removes whoever's there. Doesn't touch score or outs — those go
 * through mid-game events.
 */
function BasesEditor({
  bases,
  roster,
  disabled,
  onChange,
}: {
  bases: Bases;
  roster: RosterEntry[];
  disabled?: boolean;
  onChange: (next: Bases) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {([1, 2, 3] as const).map((b) => (
        <select
          key={b}
          value={bases[b] ?? ""}
          disabled={disabled}
          onChange={(e) => {
            const next: Bases = { ...bases, [b]: e.target.value || null };
            onChange(next);
          }}
          className="min-h-[36px] bg-card border border-hair rounded-sm px-1.5 py-1 text-[11.5px] outline-none focus:border-red"
          aria-label={`Runner on ${b === 1 ? "1st" : b === 2 ? "2nd" : "3rd"}`}
        >
          <option value="">— {b === 1 ? "1st" : b === 2 ? "2nd" : "3rd"} —</option>
          {roster.map((r) => (
            <option key={r.id} value={r.id}>
              #{r.jersey ?? "?"} {r.firstName} {r.lastName.slice(0, 6)}.
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}

/**
 * SubstitutionModal — pick a player to swap into the lineup.
 *
 * Modes:
 *   - pinch_hit: replaces the current batter for this AB onward
 *   - pinch_run: replaces a runner currently on base
 *   - defensive: replaces a fielder (no AB impact)
 */
export function SubstitutionModal({
  open,
  onClose,
  lineup,
  roster,
  bases,
  onSubmit,
  disabled,
}: {
  open: boolean;
  onClose: () => void;
  lineup: LineupEntry[];
  roster: RosterEntry[];
  bases: Bases;
  onSubmit: (input: {
    battingOrder: number;
    outPlayerId: string;
    inPlayerId: string;
    kind: "pinch_hit" | "pinch_run" | "defensive";
    position?: string;
    runOnBase?: 1 | 2 | 3;
  }) => void;
  disabled?: boolean;
}) {
  const [kind, setKind] = useState<"pinch_hit" | "pinch_run" | "defensive">(
    "pinch_hit",
  );
  const [outPlayerId, setOutPlayerId] = useState<string>("");
  const [inPlayerId, setInPlayerId] = useState<string>("");
  const [runOnBase, setRunOnBase] = useState<1 | 2 | 3 | "">("");

  // Players ALREADY in the lineup — the only valid "out" candidates.
  const lineupSlots = useMemo(() => lineup, [lineup]);
  const outSlot = lineupSlots.find((s) => s.playerId === outPlayerId) ?? null;

  // Roster minus those already starting (so coach can't sub a player
  // in for themselves; ALSO exclude the just-picked outPlayer).
  const inCandidates = useMemo(
    () =>
      roster.filter(
        (r) =>
          r.id !== outPlayerId &&
          !lineupSlots.some((s) => s.playerId === r.id),
      ),
    [roster, outPlayerId, lineupSlots],
  );

  if (!open) return null;

  const submit = () => {
    if (!outPlayerId || !inPlayerId || !outSlot) return;
    onSubmit({
      battingOrder: outSlot.battingOrder,
      outPlayerId,
      inPlayerId,
      kind,
      position: kind === "defensive" ? outSlot.position : undefined,
      runOnBase: kind === "pinch_run" && runOnBase ? (runOnBase as 1 | 2 | 3) : undefined,
    });
    setOutPlayerId("");
    setInPlayerId("");
    setRunOnBase("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-card rounded-lg shadow-xl border border-hair">
        <div className="px-4 py-3 border-b border-hair flex items-center justify-between">
          <div className="font-display text-[16px] font-semibold tracking-tight">
            Substitution
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-sm text-ink-3 hover:text-ink hover:bg-paper"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1.5">
              Type
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(["pinch_hit", "pinch_run", "defensive"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn(
                    "min-h-[40px] rounded-sm text-[11.5px] font-bold uppercase tracking-[0.04em] border",
                    kind === k
                      ? "bg-red text-white border-red"
                      : "bg-paper text-ink-2 border-hair hover:border-ink",
                  )}
                >
                  {k === "pinch_hit"
                    ? "PH"
                    : k === "pinch_run"
                      ? "PR"
                      : "Def"}
                </button>
              ))}
            </div>
          </div>

          {kind === "pinch_run" && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1.5">
                On which base?
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {([1, 2, 3] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setRunOnBase(b);
                      // Auto-pick the runner at that base as outPlayerId.
                      if (bases[b]) setOutPlayerId(bases[b] as string);
                    }}
                    disabled={!bases[b]}
                    className={cn(
                      "min-h-[40px] rounded-sm text-[11.5px] font-bold border",
                      runOnBase === b
                        ? "bg-red text-white border-red"
                        : bases[b]
                          ? "bg-paper text-ink-2 border-hair hover:border-ink"
                          : "bg-card text-ink-4 border-hair cursor-default",
                    )}
                  >
                    {b === 1 ? "1st" : b === 2 ? "2nd" : "3rd"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1.5">
              Player out
            </div>
            <select
              value={outPlayerId}
              onChange={(e) => setOutPlayerId(e.target.value)}
              className="w-full bg-paper border border-hair rounded-sm px-2 py-2 text-[13px] outline-none focus:border-red"
            >
              <option value="">— Pick player to sub out —</option>
              {lineupSlots.map((s) => (
                <option key={s.playerId} value={s.playerId}>
                  #{s.battingOrder} #{s.jersey ?? "?"} {s.firstName} {s.lastName} ({s.position})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1.5">
              Player in
            </div>
            <select
              value={inPlayerId}
              onChange={(e) => setInPlayerId(e.target.value)}
              className="w-full bg-paper border border-hair rounded-sm px-2 py-2 text-[13px] outline-none focus:border-red"
            >
              <option value="">— Pick player to sub in —</option>
              {inCandidates.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.jersey ?? "?"} {r.firstName} {r.lastName} ({r.positions.join("/") || "—"})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-hair flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-3 rounded-sm text-[12.5px] font-semibold text-ink-3 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={
              disabled ||
              !outPlayerId ||
              !inPlayerId ||
              (kind === "pinch_run" && !runOnBase)
            }
            className="min-h-[40px] px-4 rounded-sm bg-red text-white text-[12.5px] font-bold disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
