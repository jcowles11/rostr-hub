"use client";

import { useEffect, useMemo, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Lock,
  Unlock,
  Undo2,
  Search,
  Trash2,
  ChevronRight,
  Settings,
  Check,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  recordAtBatAction,
  deleteAtBatAction,
  endSessionAction,
  reopenSessionAction,
} from "../actions";
import {
  ALL_OUTCOMES,
  type AtBatOutcome,
  type PitchResult,
  type PracticePitch,
  type PracticeSession,
  type PracticeAtBat,
} from "@/lib/services/live-abs";

interface RosterPlayer {
  id: string;
  firstName: string;
  lastName: string;
  jersey: number | null;
  positions: string[];
}

const OUTCOME_LABEL: Record<AtBatOutcome, string> = {
  HR: "HR",
  "3B": "3B",
  "2B": "2B",
  "1B": "1B",
  BB: "BB",
  HBP: "HBP",
  K: "K",        // swinging — rendered as normal K
  "K-L": "K-L",  // looking — rendered with backwards-K visual via CSS
  GO: "GO",
  FO: "FO",
  FC: "FC",
  E: "E",
  SAC: "SAC",
};

// Outcome colors — distinct enough that each one is recognizable at a glance,
// even from across a cage. HR/3B/2B/1B form a hot→cool hit ladder; BB/HBP
// stay in cool tones (free passes); K is the ink black "out"; ground/fly/FC
// are neutral gray; E and SAC use lighter amber/gray.
const OUTCOME_TONE: Record<AtBatOutcome, string> = {
  HR: "bg-red text-white",                              // brightest red — biggest outcome
  "3B": "bg-amber text-white",                          // saturated orange — distinct from HR
  "2B": "bg-gold text-white",                           // gold — middle of the hit ladder
  "1B": "bg-grass text-white",                          // green — solid base hit
  BB: "bg-sky text-white",                              // blue — free pass
  HBP: "bg-dirt text-white",                            // brown — "got hit", clearly distinct from BB
  K: "bg-ink text-white",                               // black — strikeout swinging
  "K-L": "bg-ink text-white",                           // black — strikeout looking (backwards-K rendered visually)
  GO: "bg-paper-deep text-ink border border-hair",      // neutral — out
  FO: "bg-paper-deep text-ink border border-hair",
  FC: "bg-paper-deep text-ink border border-hair",
  E: "bg-amber-soft text-amber border border-amber/40", // lighter — error
  SAC: "bg-paper-deep text-ink border border-hair",
};

// Helpful shortcut: the outcome grid in the order coaches scan it.
// Hits across the top row, walks/HBP/Ks on the second, outs on the third+,
// edge cases on the last row. K and K-L sit side-by-side so coaches can
// distinguish swinging vs looking strikeouts at the AB level.
const OUTCOME_LAYOUT: AtBatOutcome[][] = [
  ["1B", "2B", "3B", "HR"],
  ["BB", "HBP", "K", "K-L"],
  ["GO", "FO", "FC", "E", "SAC"],
];

// LocalStorage key — keeps the cage setup (pitcher + group) across reloads
// so a coach reloading mid-session doesn't have to re-pick. Per session.
const cageKey = (sessionId: string) => `rostr.live-abs.cage.${sessionId}`;

interface CageState {
  pitcherId: string | null;
  hitterIds: string[];
  cursor: number; // index into hitterIds for the on-deck hitter
  // Pitch type stays sticky between pitches/ABs — pitchers throw runs of
  // the same pitch type, so re-selecting every time is friction.
  selectedPitchType: PitchType;
}

type PitchType = "FB" | "CB" | "SL" | "CH" | "CT" | "SP" | "OS";

const PITCH_TYPES: { value: PitchType; label: string; long: string }[] = [
  { value: "FB", label: "FB", long: "Fastball" },
  { value: "CB", label: "CB", long: "Curveball" },
  { value: "SL", label: "SL", long: "Slider" },
  { value: "CH", label: "CH", long: "Changeup" },
  { value: "CT", label: "CT", long: "Cutter" },
  { value: "SP", label: "SP", long: "Splitter" },
  { value: "OS", label: "OS", long: "Other" },
];

export function SessionRecordView({
  session,
  initialAtBats,
  roster,
}: {
  session: PracticeSession;
  initialAtBats: PracticeAtBat[];
  roster: RosterPlayer[];
}) {
  const router = useRouter();
  const [atBats, setAtBats] = useState<PracticeAtBat[]>(initialAtBats);
  const [cage, setCage] = useState<CageState>({
    pitcherId: null,
    hitterIds: [],
    cursor: 0,
    selectedPitchType: "FB",
  });
  // In-progress pitch sequence for the active AB
  const [pitches, setPitches] = useState<PracticePitch[]>([]);
  const [setupOpen, setSetupOpen] = useState(true);
  const [pitchVelo, setPitchVelo] = useState("");
  const [exitVelo, setExitVelo] = useState("");
  const [showFeed, setShowFeed] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [closing, setClosing] = useState(false);
  const veloInputRef = useRef<HTMLInputElement>(null);

  const isOpen = !session.endedAt;

  // Restore cage state from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(cageKey(session.id));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CageState> & { trackingMode?: string };
        if (parsed.pitcherId || (parsed.hitterIds?.length ?? 0) > 0) {
          setCage({
            pitcherId: parsed.pitcherId ?? null,
            hitterIds: parsed.hitterIds ?? [],
            cursor: parsed.cursor ?? 0,
            selectedPitchType: parsed.selectedPitchType ?? "FB",
          });
          setSetupOpen(false);
        }
      }
    } catch {
      // ignore
    }
  }, [session.id]);

  // Persist cage state on change
  useEffect(() => {
    try {
      localStorage.setItem(cageKey(session.id), JSON.stringify(cage));
    } catch {
      // ignore
    }
  }, [cage, session.id]);

  const pitcher = roster.find((r) => r.id === cage.pitcherId) ?? null;
  const hitters = cage.hitterIds
    .map((id) => roster.find((r) => r.id === id))
    .filter((p): p is RosterPlayer => Boolean(p));
  const onDeck = hitters[cage.cursor] ?? null;

  // Per-hitter session line (live updates as ABs are recorded)
  const sessionStats = useMemo(() => buildHitterStats(atBats), [atBats]);

  const recordAt = (outcome: AtBatOutcome) => {
    if (!cage.pitcherId || !onDeck) {
      toast.error("Pick a pitcher and at least one hitter first");
      setSetupOpen(true);
      return;
    }
    const pitcherId = cage.pitcherId;
    const hitterId = onDeck.id;
    const evNum = exitVelo ? parseFloat(exitVelo) : null;
    const pvNum = pitchVelo ? parseFloat(pitchVelo) : null;
    // If the coach was tracking pitches and the outcome is a "ball in play"
    // (1B/2B/3B/HR/GO/FO/FC/E/SAC) — auto-append an in_play pitch with the
    // current velo + selected type so the sequence is complete.
    // For HBP outcome with pitches logged, append an hbp pitch.
    // For BB/K with pitches: the auto-end logic already added the terminating
    // pitch; if coach manually overrode, leave the sequence as-is.
    const isInPlay = !["BB", "K", "HBP"].includes(outcome);
    const isHBP = outcome === "HBP";
    const pitchesForAB = [...pitches];
    if (pitches.length > 0 && isInPlay) {
      pitchesForAB.push({
        sequence: pitches.length + 1,
        result: "in_play",
        pitchVelocity: pvNum,
        pitchType: cage.selectedPitchType,
      });
    } else if (pitches.length > 0 && isHBP) {
      // Only add hbp pitch if last pitch wasn't already hbp (auto-end could have)
      const last = pitches[pitches.length - 1];
      if (!last || last.result !== "hbp") {
        pitchesForAB.push({
          sequence: pitches.length + 1,
          result: "hbp",
          pitchVelocity: pvNum,
          pitchType: cage.selectedPitchType,
        });
      }
    }
    const pitchSnapshot = pitchesForAB.map((p, i) => ({ ...p, sequence: i + 1 }));
    startTransition(async () => {
      const r = await recordAtBatAction({
        sessionId: session.id,
        pitcherId,
        hitterId,
        outcome,
        exitVelocity: evNum,
        pitchVelocity: pvNum,
        pitchType: cage.selectedPitchType,
        pitches: pitchSnapshot.length > 0 ? pitchSnapshot : undefined,
      });
      if (r.error) {
        toast.error("Couldn't record", { description: r.error });
        return;
      }
      // Optimistic add
      const newAB: PracticeAtBat = {
        id: r.id ?? `tmp-${Date.now()}`,
        sessionId: session.id,
        sequence: (atBats[0]?.sequence ?? 0) + 1,
        pitcherId,
        pitcherName: pitcher ? `${pitcher.firstName} ${pitcher.lastName}` : "",
        hitterId,
        hitterName: onDeck ? `${onDeck.firstName} ${onDeck.lastName}` : "",
        outcome,
        rbi: 0,
        exitVelocity: evNum,
        pitchVelocity: pvNum,
        pitchType: null,
        notes: null,
        createdAt: new Date().toISOString(),
      };
      setAtBats((prev) => [newAB, ...prev]);
      // Rotate to next hitter (round-robin)
      setCage((prev) => ({
        ...prev,
        cursor: prev.hitterIds.length > 0 ? (prev.cursor + 1) % prev.hitterIds.length : 0,
      }));
      // Clear per-AB inputs
      setExitVelo("");
      setPitches([]);
      // Light feedback
      toast.success(`${outcome} · ${onDeck.lastName}`, {
        description: pitcher ? `vs ${pitcher.lastName}` : undefined,
      });
    });
  };

  // Pitch-by-pitch helpers ─────────────────────────────────

  const ballCount = pitches.filter((p) => p.result === "ball").length;
  const strikeCount = pitches.filter(
    (p) => p.result === "strike_called" || p.result === "strike_swinging",
  ).length;
  // Foul on 0/1 strikes counts as a strike; foul on 2 strikes does not.
  // Compute "effective strike count" using the actual baseball rule.
  const effectiveStrikes = pitches.reduce((s, p) => {
    if (p.result === "strike_called" || p.result === "strike_swinging") return s + 1;
    if (p.result === "foul" || p.result === "foul_tip") return Math.min(2, s + 1);
    return s;
  }, 0);

  const addPitch = (result: PitchResult) => {
    if (!cage.pitcherId || !onDeck) {
      toast.error("Pick a pitcher and at least one hitter first");
      setSetupOpen(true);
      return;
    }
    const pvNum = pitchVelo ? parseFloat(pitchVelo) : null;
    const newPitch: PracticePitch = {
      sequence: pitches.length + 1,
      result,
      pitchVelocity: pvNum,
      pitchType: cage.selectedPitchType,
    };
    const nextPitches = [...pitches, newPitch];

    // Auto-end the AB based on baseball rules. HBP and in_play are no
    // longer added via pitch buttons (they live in the outcome row), so
    // we only handle ball / strike / foul here.
    // Compute counts AFTER adding this pitch
    const newBalls = nextPitches.filter((p) => p.result === "ball").length;
    const newStrikes = nextPitches.reduce((s, p) => {
      if (p.result === "strike_called" || p.result === "strike_swinging") return s + 1;
      if (p.result === "foul" || p.result === "foul_tip") return Math.min(2, s + 1);
      return s;
    }, 0);

    if (newBalls >= 4) {
      setPitches(nextPitches);
      setTimeout(() => recordAt("BB"), 0);
      return;
    }
    if (newStrikes >= 3) {
      // Determine K vs K-L by the type of the LAST strike-causing pitch.
      // Foul/foul-tip don't decide it (a 0-2 foul stays at 2 strikes), so
      // we walk back to the last called/swinging strike.
      const lastK = [...nextPitches].reverse().find(
        (p) => p.result === "strike_called" || p.result === "strike_swinging",
      );
      const kOutcome: AtBatOutcome =
        lastK?.result === "strike_called" ? "K-L" : "K";
      setPitches(nextPitches);
      setTimeout(() => recordAt(kOutcome), 0);
      return;
    }
    setPitches(nextPitches);
  };

  const undoLastPitch = () => {
    if (pitches.length === 0) return;
    setPitches((prev) => prev.slice(0, -1));
  };

  const setPitchType = (t: PitchType) => {
    setCage((prev) => ({ ...prev, selectedPitchType: t }));
  };


  const undoLast = () => {
    const last = atBats[0];
    if (!last) return;
    // PHASE 5 — removed confirm. The success toast names the undone
    // AB; coach can re-log if it was a misclick.
    startTransition(async () => {
      const r = await deleteAtBatAction(last.id, session.id);
      if (r.error) {
        toast.error("Couldn't undo", { description: r.error });
        return;
      }
      setAtBats((prev) => prev.slice(1));
      // Rewind cursor so the same hitter is back on deck
      setCage((prev) => ({
        ...prev,
        cursor:
          prev.hitterIds.length > 0
            ? (prev.cursor - 1 + prev.hitterIds.length) % prev.hitterIds.length
            : 0,
      }));
      toast.success("Undone");
    });
  };

  const removeAtBat = (id: string) => {
    if (!confirm("Delete this at-bat?")) return;
    startTransition(async () => {
      const r = await deleteAtBatAction(id, session.id);
      if (r.error) {
        toast.error("Couldn't delete", { description: r.error });
        return;
      }
      setAtBats((prev) => prev.filter((ab) => ab.id !== id));
    });
  };

  // Keyboard shortcut: ⌘Z / Ctrl+Z to undo the last at-bat. Skipped when
  // the user is typing in an input (so velo entry isn't disrupted) or
  // when there's nothing to undo. Behaviour matches the on-screen Undo
  // button — same confirmation dialog + same toast.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        return;
      }
      if (atBats.length === 0 || isPending) return;
      e.preventDefault();
      undoLast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [atBats, isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeSession = async () => {
    if (!confirm("Close this session? You can reopen it later if needed.")) return;
    setClosing(true);
    const r = await endSessionAction(session.id);
    setClosing(false);
    if (r.error) toast.error("Couldn't close", { description: r.error });
    else {
      toast.success("Session closed");
      router.refresh();
    }
  };

  const reopenSession = async () => {
    setClosing(true);
    const r = await reopenSessionAction(session.id);
    setClosing(false);
    if (r.error) toast.error("Couldn't reopen", { description: r.error });
    else {
      toast.success("Session reopened");
      router.refresh();
    }
  };

  const jumpToHitter = (id: string) => {
    const idx = cage.hitterIds.indexOf(id);
    if (idx >= 0) setCage((prev) => ({ ...prev, cursor: idx }));
  };

  // Derived: 3 next hitters in rotation (skip current)
  const upNext = useMemo(() => {
    if (hitters.length <= 1) return [];
    const out: RosterPlayer[] = [];
    for (let i = 1; i <= Math.min(3, hitters.length - 1); i++) {
      out.push(hitters[(cage.cursor + i) % hitters.length]);
    }
    return out;
  }, [hitters, cage.cursor]);

  return (
    <div className="flex-1 overflow-auto pb-12 bg-paper">
      <div className="max-w-layout-app mx-auto px-3 sm:px-6 lg:px-8 pt-4">
        {/* Compact header — keeps the action above the fold */}
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/app/practice/live-abs"
            className="inline-flex items-center justify-center w-8 h-8 text-ink-3 hover:text-ink"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-display text-[15px] sm:text-[17px] font-semibold tracking-tight truncate">
              {session.name}
            </div>
            <div className="text-[10.5px] text-ink-3 mt-0.5 truncate">
              {new Date(`${session.sessionDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {session.location ? ` · ${session.location}` : ""}
              {" · "}
              <span className="font-mono font-semibold text-ink">{atBats.length} AB</span>
            </div>
          </div>
          {!isOpen && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-paper-deep text-ink-2 rounded-xs text-[9px] font-bold tracking-[0.08em] uppercase">
              <Lock className="w-2.5 h-2.5" /> Closed
            </span>
          )}
          <button
            onClick={isOpen ? closeSession : reopenSession}
            disabled={closing}
            className="text-[11px] text-ink-3 hover:text-ink font-semibold"
          >
            {isOpen ? "Close" : "Reopen"}
          </button>
        </div>

        {/* Cage setup — collapsible */}
        <CageSetup
          open={setupOpen}
          onToggle={() => setSetupOpen((v) => !v)}
          roster={roster}
          cage={cage}
          onChange={(next) => setCage(next)}
          isOpen={isOpen}
        />

        {/* The hot path — recording */}
        {!setupOpen && cage.pitcherId && hitters.length > 0 && (
          <RecordSurface
            pitcher={pitcher}
            onDeck={onDeck}
            upNext={upNext}
            hitters={hitters}
            sessionStats={sessionStats}
            cursor={cage.cursor}
            pitchVelo={pitchVelo}
            setPitchVelo={setPitchVelo}
            exitVelo={exitVelo}
            setExitVelo={setExitVelo}
            onRecord={recordAt}
            onJump={jumpToHitter}
            onUndo={atBats.length > 0 ? undoLast : null}
            lastAB={atBats[0] ?? null}
            disabled={!isOpen || isPending}
            veloInputRef={veloInputRef}
            onSwapPitcher={() => setSetupOpen(true)}
            selectedPitchType={cage.selectedPitchType}
            onSetPitchType={setPitchType}
            pitches={pitches}
            ballCount={ballCount}
            strikeCount={effectiveStrikes}
            onAddPitch={addPitch}
            onUndoPitch={undoLastPitch}
          />
        )}

        {/* Recent at-bats */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
              Recent at-bats
            </h3>
            <span className="font-mono text-[10.5px] text-ink-3">{atBats.length}</span>
            <button
              onClick={() => setShowFeed((v) => !v)}
              className="ml-auto text-[10.5px] text-ink-3 hover:text-ink font-semibold inline-flex items-center gap-1"
            >
              {showFeed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showFeed ? "Hide" : "Show"}
            </button>
          </div>
          {showFeed && (
            <div className="bg-card border border-hair rounded-lg overflow-hidden">
              {atBats.length === 0 ? (
                <div className="p-5 text-center text-[12px] text-ink-3">
                  No at-bats yet. Tap an outcome above to record the first.
                </div>
              ) : (
                <div className="divide-y divide-hair-2 max-h-[360px] overflow-auto">
                  {atBats.slice(0, 50).map((ab) => (
                    <div
                      key={ab.id}
                      className="px-3 py-2 flex items-center gap-2 group"
                    >
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-xs text-[11px] font-bold w-10 text-center inline-flex items-center justify-center",
                          OUTCOME_TONE[ab.outcome],
                        )}
                      >
                        <OutcomeText outcome={ab.outcome as AtBatOutcome} />
                      </span>
                      <div className="flex-1 min-w-0 text-[12.5px]">
                        <div className="font-semibold truncate">{ab.hitterName}</div>
                        <div className="text-[10.5px] text-ink-3 truncate">
                          vs {ab.pitcherName}
                          {ab.exitVelocity ? ` · ${ab.exitVelocity} EV` : ""}
                          {ab.pitchVelocity ? ` · ${ab.pitchVelocity} pitch` : ""}
                        </div>
                      </div>
                      {isOpen && (
                        <button
                          onClick={() => removeAtBat(ab.id)}
                          className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-red"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pitch result labels + colors ─────────────────────
// Used by the inline count display + pitch buttons in RecordSurface.

const PITCH_LABEL: Record<PitchResult, string> = {
  ball: "Ball",
  strike_called: "K — looking",
  strike_swinging: "K — swinging",
  foul: "Foul",
  foul_tip: "Foul tip",
  in_play: "In play",
  hbp: "HBP",
};

const PITCH_TONE: Record<PitchResult, string> = {
  ball: "bg-sky text-white",
  strike_called: "bg-amber text-white",
  strike_swinging: "bg-red text-white",
  foul: "bg-paper-deep text-ink border border-hair",
  foul_tip: "bg-paper-deep text-ink border border-hair",
  in_play: "bg-grass text-white",
  hbp: "bg-dirt text-white",
};

const PITCH_SHORT: Record<PitchResult, string> = {
  ball: "B",
  strike_called: "Sc",
  strike_swinging: "Ss",
  foul: "F",
  foul_tip: "Ft",
  in_play: "IP",
  hbp: "HBP",
};

// ── Outcome text rendering ────────────────────────────
// K-L in baseball scoring uses a backwards K. We render the "K" mirrored
// horizontally via CSS transform so it works in any font and at any size.
function OutcomeText({ outcome }: { outcome: AtBatOutcome }) {
  if (outcome === "K-L") {
    return (
      <span className="inline-flex items-center gap-0.5">
        <span style={{ display: "inline-block", transform: "scaleX(-1)" }}>K</span>
        <span className="text-[0.65em] opacity-75">L</span>
      </span>
    );
  }
  return <>{OUTCOME_LABEL[outcome]}</>;
}

// ── Cage setup ─────────────────────────────────────────

function CageSetup({
  open,
  onToggle,
  roster,
  cage,
  onChange,
  isOpen,
}: {
  open: boolean;
  onToggle: () => void;
  roster: RosterPlayer[];
  cage: CageState;
  onChange: (c: CageState) => void;
  isOpen: boolean;
}) {
  const [pitcherSearch, setPitcherSearch] = useState("");
  const [hitterSearch, setHitterSearch] = useState("");
  const pitcher = roster.find((r) => r.id === cage.pitcherId) ?? null;
  const hitters = cage.hitterIds
    .map((id) => roster.find((r) => r.id === id))
    .filter((p): p is RosterPlayer => Boolean(p));

  const pitcherList = roster.filter((p) =>
    pitcherSearch ? `${p.firstName} ${p.lastName}`.toLowerCase().includes(pitcherSearch.toLowerCase()) : true,
  );
  const hitterList = roster.filter((p) =>
    hitterSearch ? `${p.firstName} ${p.lastName}`.toLowerCase().includes(hitterSearch.toLowerCase()) : true,
  );

  const togglePitcher = (id: string) => {
    onChange({ ...cage, pitcherId: cage.pitcherId === id ? null : id });
  };
  const toggleHitter = (id: string) => {
    if (cage.hitterIds.includes(id)) {
      const nextIds = cage.hitterIds.filter((x) => x !== id);
      onChange({
        ...cage,
        hitterIds: nextIds,
        cursor: Math.min(cage.cursor, Math.max(0, nextIds.length - 1)),
      });
    } else {
      onChange({ ...cage, hitterIds: [...cage.hitterIds, id] });
    }
  };

  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-paper text-left"
      >
        <Settings className="w-4 h-4 text-red shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-red">
            Cage setup
          </div>
          {pitcher && hitters.length > 0 ? (
            <div className="text-[12.5px] mt-0.5 truncate">
              <span className="text-ink-3">Pitcher</span>{" "}
              <b className="text-ink">{pitcher.firstName} {pitcher.lastName}</b>
              <span className="text-ink-3"> · {hitters.length} hitter{hitters.length === 1 ? "" : "s"}:</span>{" "}
              <span className="text-ink-2">{hitters.map((h) => h.lastName).join(", ")}</span>
            </div>
          ) : (
            <div className="text-[12.5px] mt-0.5 text-ink-3">
              Pick a pitcher and the group of hitters in the cage.
            </div>
          )}
        </div>
        <ChevronRight
          className={cn(
            "w-4 h-4 text-ink-3 transition-transform",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-hair-2 p-4 space-y-4">
          {/* Pitcher */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
                Pitcher (one)
              </div>
              {pitcher && (
                <span className="text-[10.5px] text-grass font-semibold inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> {pitcher.firstName} {pitcher.lastName}
                </span>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-ink-3 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={pitcherSearch}
                onChange={(e) => setPitcherSearch(e.target.value)}
                placeholder="Search pitchers…"
                className="w-full bg-paper border border-hair rounded-sm pl-8 pr-3 py-2 text-[13px] outline-none focus:border-red"
              />
            </div>
            <div className="max-h-[180px] overflow-auto bg-paper rounded-sm border border-hair-2 grid grid-cols-1 sm:grid-cols-2 gap-px">
              {pitcherList.length === 0 ? (
                <div className="p-3 text-[12px] text-ink-3 text-center col-span-2">
                  No matches. Add players from Roster first.
                </div>
              ) : (
                pitcherList.map((p) => {
                  const isSelected = cage.pitcherId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePitcher(p.id)}
                      className={cn(
                        "px-3 py-2.5 flex items-center gap-2 text-left",
                        isSelected
                          ? "bg-sky-soft border-l-2 border-l-sky"
                          : "bg-card hover:bg-paper-deep border-l-2 border-l-transparent",
                      )}
                    >
                      <span className="font-mono text-[10.5px] text-ink-3 w-7 shrink-0">
                        {p.jersey ? `#${p.jersey}` : "—"}
                      </span>
                      <span className="text-[13px] font-semibold flex-1 truncate">
                        {p.firstName} {p.lastName}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-sky" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Hitters (multi-select) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
                In the cage (rotate through)
              </div>
              {hitters.length > 0 && (
                <span className="text-[10.5px] text-grass font-semibold inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> {hitters.length} selected
                </span>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-ink-3 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={hitterSearch}
                onChange={(e) => setHitterSearch(e.target.value)}
                placeholder="Search hitters…"
                className="w-full bg-paper border border-hair rounded-sm pl-8 pr-3 py-2 text-[13px] outline-none focus:border-red"
              />
            </div>
            <div className="max-h-[240px] overflow-auto bg-paper rounded-sm border border-hair-2 grid grid-cols-1 sm:grid-cols-2 gap-px">
              {hitterList.length === 0 ? (
                <div className="p-3 text-[12px] text-ink-3 text-center col-span-2">
                  No matches.
                </div>
              ) : (
                hitterList.map((p) => {
                  const isSelected = cage.hitterIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleHitter(p.id)}
                      className={cn(
                        "px-3 py-2.5 flex items-center gap-2 text-left",
                        isSelected
                          ? "bg-red-soft border-l-2 border-l-red"
                          : "bg-card hover:bg-paper-deep border-l-2 border-l-transparent",
                      )}
                    >
                      <span className="font-mono text-[10.5px] text-ink-3 w-7 shrink-0">
                        {p.jersey ? `#${p.jersey}` : "—"}
                      </span>
                      <span className="text-[13px] font-semibold flex-1 truncate">
                        {p.firstName} {p.lastName}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-red" />}
                    </button>
                  );
                })
              )}
            </div>
            {cage.hitterIds.length > 1 && (
              <div className="text-[10.5px] text-ink-3 mt-1.5">
                Tap done — they&apos;ll rotate in the order shown above. You can also tap any
                up-next chip to skip ahead.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggle}
            disabled={!cage.pitcherId || cage.hitterIds.length === 0 || !isOpen}
            className="w-full py-3 bg-red hover:bg-red/90 disabled:opacity-50 text-white rounded-sm text-[14px] font-bold inline-flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Done — start recording
          </button>
        </div>
      )}
    </div>
  );
}

// ── Record surface (the hot path) ───────────────────

interface HitterAggLine {
  pa: number; ab: number; h: number; bb: number; k: number; hr: number;
}

function RecordSurface({
  pitcher,
  onDeck,
  upNext,
  hitters,
  sessionStats,
  cursor,
  pitchVelo,
  setPitchVelo,
  exitVelo,
  setExitVelo,
  onRecord,
  onJump,
  onUndo,
  lastAB,
  disabled,
  veloInputRef,
  onSwapPitcher,
  selectedPitchType,
  onSetPitchType,
  pitches,
  ballCount,
  strikeCount,
  onAddPitch,
  onUndoPitch,
}: {
  pitcher: RosterPlayer | null;
  onDeck: RosterPlayer | null;
  upNext: RosterPlayer[];
  hitters: RosterPlayer[];
  sessionStats: Map<string, HitterAggLine>;
  cursor: number;
  pitchVelo: string;
  setPitchVelo: (s: string) => void;
  exitVelo: string;
  setExitVelo: (s: string) => void;
  onRecord: (o: AtBatOutcome) => void;
  onJump: (id: string) => void;
  onUndo: (() => void) | null;
  lastAB: PracticeAtBat | null;
  disabled: boolean;
  veloInputRef: React.RefObject<HTMLInputElement>;
  onSwapPitcher: () => void;
  selectedPitchType: PitchType;
  onSetPitchType: (t: PitchType) => void;
  pitches: PracticePitch[];
  ballCount: number;
  strikeCount: number;
  onAddPitch: (r: PitchResult) => void;
  onUndoPitch: () => void;
}) {
  const onDeckLine = onDeck ? sessionStats.get(onDeck.id) : undefined;
  const onDeckSession = onDeckLine
    ? `${onDeckLine.h}/${onDeckLine.ab}${onDeckLine.hr ? ` · ${onDeckLine.hr}HR` : ""} · ${onDeckLine.k}K · ${onDeckLine.bb}BB`
    : "First AB this session";

  return (
    <>
      {/* Pitcher chip — sticky context */}
      <div className="bg-ink text-white rounded-md px-3 py-2 mb-3 flex items-center gap-2.5">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/55 shrink-0">
          Pitching
        </span>
        <span className="font-display text-[14px] font-semibold tracking-tight flex-1 min-w-0 truncate">
          {pitcher ? `${pitcher.firstName} ${pitcher.lastName}` : "—"}
          {pitcher?.jersey ? <span className="font-mono text-white/60 ml-1">#{pitcher.jersey}</span> : null}
        </span>
        <button
          onClick={onSwapPitcher}
          className="text-[10.5px] text-red font-bold hover:text-white"
        >
          Swap
        </button>
      </div>

      {/* ON DECK — the big hitter card */}
      {onDeck && (
        <div className="bg-card border-2 border-red rounded-lg p-4 sm:p-5 mb-3 relative">
          <div className="absolute top-2 right-3 text-[9px] font-bold uppercase tracking-[0.1em] text-red">
            ● On deck
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="font-display text-[28px] sm:text-[34px] font-semibold tracking-[-0.03em] leading-none">
              {onDeck.firstName} {onDeck.lastName}
            </h2>
            {onDeck.jersey != null && (
              <span className="font-mono text-[20px] sm:text-[24px] text-ink-3 font-semibold">
                #{onDeck.jersey}
              </span>
            )}
          </div>
          <div className="text-[12.5px] text-ink-3 mt-1.5 flex items-center gap-2 flex-wrap">
            {onDeck.positions.length > 0 && <span>{onDeck.positions.join("/")}</span>}
            <span className="text-ink-4">·</span>
            <span className="font-mono">{onDeckSession}</span>
          </div>
        </div>
      )}

      {/* Pitch type chips — sticky select, attaches to next pitch + AB.
          Pitchers throw runs of the same pitch, so this stays selected
          between taps. Coach taps a different chip when the pitch
          type changes. */}
      <div className="mb-2.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1.5">
          Pitch type
        </div>
        <div className="flex gap-1 flex-wrap">
          {PITCH_TYPES.map((pt) => (
            <button
              key={pt.value}
              type="button"
              onClick={() => onSetPitchType(pt.value)}
              className={cn(
                "px-3 py-1.5 rounded-sm text-[12.5px] font-mono font-bold border transition-colors",
                selectedPitchType === pt.value
                  ? "bg-ink text-white border-ink"
                  : "bg-card text-ink-2 border-hair hover:border-ink-3",
              )}
              title={pt.long}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Velocities — always visible. Pitch velo attaches to the next pitch
          OR (if no pitch buttons tapped) to the AB row directly. */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <VeloInput
          inputRef={veloInputRef}
          label="Pitch velo"
          value={pitchVelo}
          onChange={setPitchVelo}
          tone="sky"
          hint="mph · stays sticky"
          inputMode="decimal"
        />
        <VeloInput
          label="Exit velo"
          value={exitVelo}
          onChange={setExitVelo}
          tone="red"
          hint="mph · clears each AB"
          inputMode="decimal"
        />
      </div>

      {/* Count display — only when at least one pitch logged */}
      {pitches.length > 0 && (
        <div className="bg-ink text-white rounded-md p-2.5 mb-2.5 flex items-center gap-3">
          <div className="flex items-baseline gap-2 flex-1">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/55">
              Count
            </div>
            <div className="font-mono text-[24px] sm:text-[28px] font-bold tracking-[-0.04em] leading-none">
              {ballCount}-{strikeCount}
            </div>
          </div>
          <div className="flex gap-0.5 flex-wrap justify-end max-w-[200px]">
            {pitches.map((p, i) => (
              <span
                key={i}
                className={cn(
                  "px-1.5 py-0.5 rounded-xs text-[10px] font-bold",
                  PITCH_TONE[p.result],
                )}
                title={`${i + 1}. ${PITCH_LABEL[p.result]}${p.pitchType ? ` · ${p.pitchType}` : ""}${p.pitchVelocity ? ` · ${p.pitchVelocity} mph` : ""}`}
              >
                {PITCH_SHORT[p.result]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pitch buttons — optional. Coach can skip these entirely if they
          only want outcome tracking. 4 balls / 3 strikes auto-end the AB. */}
      <div className="mb-3">
        <div className="flex items-center mb-1.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
            Track pitch (optional)
          </div>
          {pitches.length > 0 && (
            <button
              onClick={onUndoPitch}
              className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-ink-3 hover:text-red font-semibold"
            >
              <Undo2 className="w-3 h-3" /> Undo pitch
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <PitchBtn label="Ball" tone={PITCH_TONE.ball} onClick={() => onAddPitch("ball")} disabled={disabled} />
          <PitchBtn label="K — Looking" tone={PITCH_TONE.strike_called} onClick={() => onAddPitch("strike_called")} disabled={disabled} />
          <PitchBtn label="K — Swinging" tone={PITCH_TONE.strike_swinging} onClick={() => onAddPitch("strike_swinging")} disabled={disabled} />
          <PitchBtn label="Foul" tone={PITCH_TONE.foul} onClick={() => onAddPitch("foul")} disabled={disabled} />
        </div>
      </div>

      {/* Outcome buttons — primary action. Always visible. Coach can tap
          directly without any pitch tracking (fast path) or tap after a
          pitch sequence (auto-attaches the in-play pitch with current velo
          + type). */}
      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1.5">
          End at-bat with outcome
        </div>
        <div className="space-y-1.5">
          {OUTCOME_LAYOUT.map((row, ri) => (
            <div
              key={ri}
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}
            >
              {row.map((o) => (
                <button
                  key={o}
                  onClick={() => onRecord(o)}
                  disabled={disabled}
                  className={cn(
                    "py-4 sm:py-5 rounded-md font-display font-bold text-[18px] sm:text-[20px] tracking-tight transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm",
                    OUTCOME_TONE[o],
                  )}
                >
                  <OutcomeText outcome={o} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Undo last AB — prominent button right under the outcome grid so
          the coach can correct a misclick without hunting. Shows exactly
          what's about to be undone (player + outcome) and supports ⌘Z
          for desktop coaches scoring fast. */}
      {onUndo && lastAB && (
        <button
          onClick={onUndo}
          disabled={disabled}
          className="w-full mb-3 px-3 py-2.5 bg-paper border border-hair hover:border-red hover:bg-red-soft hover:text-red rounded-md text-[12.5px] font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed group"
          title="Undo last at-bat (⌘Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Undo last AB</span>
          <span className="text-ink-3 group-hover:text-red font-mono text-[11px]">
            · {lastAB.hitterName.split(" ").slice(-1)[0]} {lastAB.outcome}
          </span>
          <span className="ml-auto font-mono text-[10px] text-ink-4 hidden sm:inline">
            ⌘Z
          </span>
        </button>
      )}

      {/* Up next */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {upNext.length > 0 && (
          <>
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 shrink-0">
              Up next
            </span>
            <div className="flex gap-1.5 flex-1 overflow-x-auto">
              {upNext.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => onJump(p.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-xs font-semibold text-[11.5px] whitespace-nowrap",
                    i === 0
                      ? "bg-amber-soft text-amber-dark"
                      : "bg-paper text-ink-2 hover:bg-paper-deep",
                  )}
                >
                  {p.lastName}
                  {p.jersey ? (
                    <span className="font-mono text-[10px] text-ink-3 ml-1">#{p.jersey}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Full rotation strip — coach can jump to any hitter */}
      {hitters.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1.5">
            Rotation ({hitters.length} hitter{hitters.length === 1 ? "" : "s"})
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
            {hitters.map((h, i) => {
              const stats = sessionStats.get(h.id);
              const isOnDeck = i === cursor;
              return (
                <button
                  key={h.id}
                  onClick={() => onJump(h.id)}
                  className={cn(
                    "shrink-0 min-w-[120px] px-2.5 py-2 rounded-md text-left transition-colors border",
                    isOnDeck
                      ? "bg-red text-white border-red"
                      : "bg-card text-ink border-hair hover:border-ink-3",
                  )}
                >
                  <div className="text-[12px] font-semibold truncate">
                    {h.lastName}
                    {h.jersey ? (
                      <span className={cn("font-mono ml-1", isOnDeck ? "text-white/70" : "text-ink-3")}>
                        #{h.jersey}
                      </span>
                    ) : null}
                  </div>
                  <div className={cn("text-[10px] font-mono mt-0.5 truncate", isOnDeck ? "text-white/70" : "text-ink-3")}>
                    {stats ? `${stats.h}/${stats.ab}${stats.hr ? ` · ${stats.hr}HR` : ""}` : "0/0"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ── Pitch-result + Velo input helpers ───────────────────

// PITCH_LABEL / TONE / SHORT are still used for the inline count display
// in the unified RecordSurface.


function PitchBtn({
  label,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  tone: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "py-4 sm:py-5 rounded-md font-display font-semibold text-[13px] sm:text-[15px] tracking-tight transition-all active:scale-95 disabled:opacity-40 shadow-sm leading-tight",
        tone,
      )}
    >
      {label}
    </button>
  );
}

function VeloInput({
  label,
  value,
  onChange,
  tone,
  hint,
  inputMode,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  tone: "sky" | "red";
  hint?: string;
  inputMode?: "decimal" | "numeric";
  inputRef?: React.RefObject<HTMLInputElement>;
}) {
  const accent = tone === "sky" ? "border-sky focus-within:border-sky" : "border-red focus-within:border-red";
  return (
    <label
      className={cn(
        "block bg-card border-2 rounded-md px-3 py-2 cursor-text",
        accent,
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-3 shrink-0">
          {label}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onChange("");
            }}
            className="ml-auto text-ink-3 hover:text-red"
            aria-label={`Clear ${label}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <input
          ref={inputRef}
          type="number"
          step="0.1"
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="font-mono text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] bg-transparent outline-none w-full text-ink"
        />
        <span className="text-[12px] text-ink-3 font-medium">mph</span>
      </div>
      {hint && <div className="text-[10px] text-ink-3 mt-0.5">{hint}</div>}
    </label>
  );
}

// ── Stat aggregation helper ─────────────────────

function buildHitterStats(atBats: PracticeAtBat[]): Map<string, HitterAggLine> {
  const stats = new Map<string, HitterAggLine>();
  for (const ab of atBats) {
    const cur = stats.get(ab.hitterId) ?? { pa: 0, ab: 0, h: 0, bb: 0, k: 0, hr: 0 };
    cur.pa += 1;
    if (["1B", "2B", "3B", "HR", "K", "GO", "FO", "E", "FC"].includes(ab.outcome)) cur.ab += 1;
    if (["1B", "2B", "3B", "HR"].includes(ab.outcome)) cur.h += 1;
    if (ab.outcome === "HR") cur.hr += 1;
    if (ab.outcome === "BB") cur.bb += 1;
    if (ab.outcome === "K") cur.k += 1;
    stats.set(ab.hitterId, cur);
  }
  return stats;
}
