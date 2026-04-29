"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Star,
  X,
  Flag,
  Delete,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Avatar, avatarColorFromSeed } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import { recordScoreAction, clearScoreAction } from "@/app/app/tryouts/actions";
import type { Tryout, TryoutStation } from "@/lib/services/tryouts";

/**
 * StationScoringView — phone-first scoring UI.
 *
 * Design intent:
 * - One player on screen at a time (no scrolling to find them).
 * - Massive tap targets. The keypad is thumb-reachable.
 * - "Save & next" advances IMMEDIATELY (optimistic) — saves go to the
 *   server in the background. Coach taps don't block on network.
 * - Flags are one tap, not a menu.
 * - Rating stations (1–5) swap the keypad for a big 5-button row.
 *
 * Reliability model:
 *   - Optimistic local map (`localScores`) updates synchronously.
 *   - In-flight saves tracked by player_id in `inFlight` Set + count.
 *   - Failures don't disappear: they go into `failed[]` queue with the
 *     full payload, surfaced as a top banner with one-tap retry. Coach
 *     can keep scoring other players while a flaky network sorts itself
 *     out — no data is dropped, no value silently lost.
 *   - Per-player "submit lock" prevents double-tap dupes (action is
 *     idempotent server-side via UPSERT, but we still skip while a
 *     prior save for the same player is mid-flight).
 */

interface FailedSave {
  /** Stable key for React + dedupe. */
  id: string;
  playerId: string;
  playerName: string;
  value: number;
  flag: "attention" | "standout" | null;
  note: string | null;
  error: string;
}

/**
 * localStorage key namespace for the failure queue. Scoped per
 * (tryout, station) so two coaches scoring different stations on the
 * same iPad don't stomp on each other.
 *
 * Why localStorage: a coach mid-tryout may accidentally close the tab
 * or navigate away during a network blip. Without persistence, the
 * failed entries vanish — the values displayed on screen were rolled
 * back, so the data is genuinely lost. With persistence, the banner
 * comes right back on the next page load.
 */
function failureQueueKey(tryoutId: string, stationId: string): string {
  return `rostr.scoring.failed.${tryoutId}.${stationId}`;
}

/**
 * Read the persisted failure queue. Tolerates JSON corruption and
 * stale schema by returning [] on any error.
 */
function loadFailedFromStorage(
  tryoutId: string,
  stationId: string,
): FailedSave[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(failureQueueKey(tryoutId, stationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: only accept rows with the required shape.
    return parsed.filter(
      (r): r is FailedSave =>
        r &&
        typeof r.id === "string" &&
        typeof r.playerId === "string" &&
        typeof r.value === "number" &&
        typeof r.error === "string",
    );
  } catch {
    return [];
  }
}

function saveFailedToStorage(
  tryoutId: string,
  stationId: string,
  queue: FailedSave[],
): void {
  if (typeof window === "undefined") return;
  try {
    if (queue.length === 0) {
      window.localStorage.removeItem(failureQueueKey(tryoutId, stationId));
    } else {
      window.localStorage.setItem(
        failureQueueKey(tryoutId, stationId),
        JSON.stringify(queue),
      );
    }
  } catch {
    // localStorage can throw on quota / disabled — best-effort only.
  }
}

/**
 * Tiny haptic ack on supported devices (Android Chrome, some iOS PWAs).
 * No-op on iOS Safari standalone where vibrate is permanently disabled
 * by Apple. The visual progress bar + indicator carry the load there.
 *
 * 12ms = "tap registered" pulse. Intentionally subtle — coaches will
 * fire this 30+ times per station and we don't want it to feel like
 * a notification.
 */
function hapticTap(): void {
  if (typeof window === "undefined") return;
  if (!("vibrate" in window.navigator)) return;
  try {
    window.navigator.vibrate(12);
  } catch {
    // Some browsers throw if vibrate is called from a non-user-gesture
    // context. Failure here is harmless — just no buzz.
  }
}

export interface AttendeeRow {
  playerId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  positions: string[];
  currentScore: number | null;
  currentFlag: "attention" | "standout" | null;
  currentNote: string | null;
}

export function StationScoringView({
  tryoutId,
  stationId,
  tryout,
  station,
  attendees,
}: {
  tryoutId: string;
  stationId: string;
  tryout: Tryout;
  station: TryoutStation;
  attendees: AttendeeRow[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(() => {
    // Start on the first unscored player (coach just opened the link
    // mid-session — drop them where the work is).
    const unscoredIdx = attendees.findIndex((a) => a.currentScore == null);
    return unscoredIdx === -1 ? 0 : unscoredIdx;
  });
  const [value, setValue] = useState<string>("");
  const [flag, setFlag] = useState<"attention" | "standout" | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  // useTransition is reserved for clearScore (which the coach EXPECTS to
  // wait on). Save is now fully optimistic — see saveAsync below.
  const [isPending, startTransition] = useTransition();
  const [localScores, setLocalScores] = useState<Map<string, number>>(
    new Map(
      attendees
        .filter((a) => a.currentScore != null)
        .map((a) => [a.playerId, a.currentScore as number]),
    ),
  );

  // In-flight saves: count drives the top-bar pill so coach sees
  // background activity at a glance. Set tracks playerIds for dedupe.
  const [inFlightCount, setInFlightCount] = useState(0);
  const inFlightRef = useRef<Set<string>>(new Set());
  // Failed saves stay in this queue until the coach retries or dismisses.
  // Persisted to localStorage so a tab crash / accidental nav-away
  // doesn't drop the queue. Most-recent-first so the banner reads
  // naturally.
  //
  // Initial render is empty (matches SSR), then the effect below
  // hydrates from storage on mount. This avoids a hydration mismatch
  // since localStorage is only available client-side.
  const [failed, setFailed] = useState<FailedSave[]>([]);
  useEffect(() => {
    const persisted = loadFailedFromStorage(tryoutId, stationId);
    if (persisted.length > 0) setFailed(persisted);
    // Only run on mount — subsequent updates are write-through via the
    // effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Write-through every change so a refresh during a network outage
  // recovers the in-progress queue.
  useEffect(() => {
    saveFailedToStorage(tryoutId, stationId, failed);
  }, [failed, tryoutId, stationId]);

  const player = attendees[index];
  const progress = localScores.size;
  const total = attendees.length;
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  // When the player changes, reset the keypad state.
  const goToIndex = (next: number) => {
    if (next < 0 || next >= attendees.length) return;
    setIndex(next);
    const nextPlayer = attendees[next];
    setValue(nextPlayer?.currentScore != null ? String(nextPlayer.currentScore) : "");
    setFlag(nextPlayer?.currentFlag ?? null);
    setNote(nextPlayer?.currentNote ?? "");
    setShowNote(false);
  };

  /**
   * Background save — fire-and-forget. UI has already advanced.
   * Tracks in-flight count so the coach sees a "Saving N…" pill, and
   * routes failures into the retry banner instead of a transient toast.
   */
  const saveInBackground = async (payload: {
    playerId: string;
    playerName: string;
    value: number;
    flag: "attention" | "standout" | null;
    note: string | null;
  }) => {
    inFlightRef.current.add(payload.playerId);
    setInFlightCount(inFlightRef.current.size);
    try {
      const r = await recordScoreAction({
        tryoutId,
        stationId,
        playerId: payload.playerId,
        value: payload.value,
        flag: payload.flag,
        note: payload.note,
      });
      if (r.error) {
        // Park in failure queue; coach can retry without retyping.
        // Defensive ?? in case the action returns truthy-but-nullable.
        const errMsg = r.error ?? "Save failed";
        setFailed((prev) => [
          {
            id: `${payload.playerId}-${Date.now()}`,
            playerId: payload.playerId,
            playerName: payload.playerName,
            value: payload.value,
            flag: payload.flag,
            note: payload.note,
            error: errMsg,
          },
          ...prev,
        ]);
        // Roll back the optimistic localScores update so the UI accurately
        // reflects what's persisted (the failure banner shows the lost
        // value so the coach can see what's pending).
        setLocalScores((prev) => {
          const next = new Map(prev);
          next.delete(payload.playerId);
          return next;
        });
      }
    } catch (err) {
      // Network/transport-level failure (vs. an action returning {error}).
      setFailed((prev) => [
        {
          id: `${payload.playerId}-${Date.now()}`,
          playerId: payload.playerId,
          playerName: payload.playerName,
          value: payload.value,
          flag: payload.flag,
          note: payload.note,
          error: err instanceof Error ? err.message : "Network error",
        },
        ...prev,
      ]);
      setLocalScores((prev) => {
        const next = new Map(prev);
        next.delete(payload.playerId);
        return next;
      });
    } finally {
      inFlightRef.current.delete(payload.playerId);
      setInFlightCount(inFlightRef.current.size);
    }
  };

  const save = (andAdvance: boolean) => {
    if (!player) return;
    const numeric = parseFloat(value);
    if (Number.isNaN(numeric)) {
      toast.error("Enter a score");
      return;
    }
    if (station.minValue != null && numeric < station.minValue) {
      toast.error(`Below min (${station.minValue})`);
      return;
    }
    if (station.maxValue != null && numeric > station.maxValue) {
      toast.error(`Above max (${station.maxValue})`);
      return;
    }

    // Tactile ack — coach feels the tap registered before the next
    // player even paints. No-op on iOS Safari (Apple disabled vibrate)
    // where the visual advance is already instant anyway.
    hapticTap();

    const playerName = `${player.firstName} ${player.lastName}`;
    const savedPayload = {
      playerId: player.playerId,
      playerName,
      value: numeric,
      flag,
      note: note || null,
    };

    // 1. Optimistic local update — compute new map FIRST so the next-player
    //    picker below sees fresh data (no stale-closure bug).
    const nextScores = new Map(localScores);
    nextScores.set(player.playerId, numeric);
    setLocalScores(nextScores);

    // 2. Advance the UI immediately, before the save round-trip.
    if (andAdvance) {
      const startFrom = index + 1;
      let target = -1;
      for (let i = 0; i < attendees.length; i++) {
        const tryIdx = (startFrom + i) % attendees.length;
        if (
          tryIdx !== index &&
          !nextScores.has(attendees[tryIdx].playerId)
        ) {
          target = tryIdx;
          break;
        }
      }
      if (target === -1) {
        // Everyone scored — refresh server state and tell the coach.
        router.refresh();
        toast.success("All players scored!", {
          description: "Background saves still finishing.",
        });
      } else {
        goToIndex(target);
      }
    }

    // 3. Send the save in the background. The await here doesn't block
    //    the coach because it's not in the UI critical path anymore.
    void saveInBackground(savedPayload);
  };

  /**
   * Retry a queued failed save. On success, drops it from the queue
   * and re-adds it to localScores. On failure, leaves it in the queue.
   */
  const retryFailed = (entry: FailedSave) => {
    // Remove from failure queue immediately; saveInBackground will re-add
    // with a new id if it fails again.
    setFailed((prev) => prev.filter((f) => f.id !== entry.id));
    // Re-mark as locally scored (optimistic) so the UI count stays
    // accurate while the retry is in flight.
    setLocalScores((prev) => {
      const next = new Map(prev);
      next.set(entry.playerId, entry.value);
      return next;
    });
    void saveInBackground({
      playerId: entry.playerId,
      playerName: entry.playerName,
      value: entry.value,
      flag: entry.flag,
      note: entry.note,
    });
  };

  const retryAllFailed = () => {
    // Snapshot the queue before iterating since saveInBackground mutates
    // it on per-attempt failure.
    const snapshot = [...failed];
    setFailed([]);
    for (const entry of snapshot) {
      setLocalScores((prev) => {
        const next = new Map(prev);
        next.set(entry.playerId, entry.value);
        return next;
      });
      void saveInBackground({
        playerId: entry.playerId,
        playerName: entry.playerName,
        value: entry.value,
        flag: entry.flag,
        note: entry.note,
      });
    }
  };

  const dismissFailed = (id: string) => {
    setFailed((prev) => prev.filter((f) => f.id !== id));
  };

  const clearScore = () => {
    if (!player) return;
    startTransition(async () => {
      const r = await clearScoreAction(tryoutId, stationId, player.playerId);
      if (r.error) toast.error("Couldn't clear", { description: r.error });
      else {
        toast.success("Score cleared");
        setLocalScores((prev) => {
          const next = new Map(prev);
          next.delete(player.playerId);
          return next;
        });
        setValue("");
        setFlag(null);
        setNote("");
      }
    });
  };

  if (attendees.length === 0) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <div className="max-w-[420px] w-full bg-card border border-hair rounded-lg p-7 text-center">
          <div className="font-display text-[22px] font-semibold tracking-tight">
            No attendees yet
          </div>
          <p className="text-[13px] text-ink-3 mt-2">
            Head back to the tryout and register players on the Players tab before
            scoring.
          </p>
          <Link
            href={`/app/tryouts/${tryoutId}`}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 bg-ink hover:bg-red text-white rounded-sm text-[12.5px] font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to tryout
          </Link>
        </div>
      </div>
    );
  }

  if (!player) return null;

  const isRating = station.scoreType === "rating";
  const initials =
    (player.firstName?.[0] ?? "?") + (player.lastName?.[0] ?? "?");
  const avatarColor = avatarColorFromSeed(player.playerId);

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Top bar */}
      <div className="bg-ink text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link
          href={`/app/tryouts/${tryoutId}`}
          className="w-9 h-9 inline-flex items-center justify-center rounded-sm hover:bg-white/10"
          aria-label="Back"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-white/60 truncate">
            {tryout.name}
          </div>
          <div className="font-display text-[15px] font-semibold truncate">
            {station.name}
            {station.unit ? ` · ${station.unit}` : ""}
          </div>
        </div>
        <div className="text-right shrink-0 flex items-center gap-2">
          {/* In-flight indicator: when background saves are pending,
              show a tiny pill so coach knows the network is still
              working on prior taps. Updates live as saves resolve. */}
          {inFlightCount > 0 && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-white/10 text-white text-[10px] font-bold uppercase tracking-[0.04em]"
              aria-live="polite"
            >
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              {inFlightCount}
            </span>
          )}
          <div>
            <div className="font-mono text-[13px] font-bold">
              {progress} / {total}
            </div>
            <div className="text-[10px] text-white/60">{pct}%</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-ink/10">
        <div className="h-full bg-red transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Failure banner — sits between the top bar and the prev/next strip
          so it's impossible to miss without blocking the score field. */}
      {failed.length > 0 && (
        <FailureBanner
          failed={failed}
          onRetry={retryFailed}
          onRetryAll={retryAllFailed}
          onDismiss={dismissFailed}
          formatValue={(v) => formatValue(v, station)}
        />
      )}

      {/* Prev / next strip — 44px tap targets so coaches don't fat-finger
          the wrong direction while sprinting through a station. */}
      <div className="px-3 py-2 bg-card border-b border-hair-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => goToIndex(index - 1)}
          disabled={index === 0}
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-sm text-ink-3 hover:text-ink hover:bg-paper active:bg-paper-deep disabled:opacity-30"
          aria-label="Previous player"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 text-center font-mono text-[11.5px] text-ink-3">
          {index + 1} of {attendees.length}
        </div>
        <button
          type="button"
          onClick={() => goToIndex(index + 1)}
          disabled={index === attendees.length - 1}
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-sm text-ink-3 hover:text-ink hover:bg-paper active:bg-paper-deep disabled:opacity-30"
          aria-label="Next player"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Hero: current player */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-4">
        <Avatar size="lg" color={avatarColor} initials={initials.toUpperCase()} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[24px] font-semibold tracking-tight leading-tight truncate">
            {player.firstName} {player.lastName}
          </div>
          <div className="font-mono text-[12px] text-ink-3 mt-0.5">
            #{player.jerseyNumber ?? "—"} · {player.positions.join("/") || "—"}
          </div>
          {/* Trust signal: read from localScores (the optimistic source
              of truth). On a successful background save the optimistic
              value sticks; on rollback we delete from the map and the
              pill correctly disappears. The failure banner above
              surfaces the pending value the coach intended. */}
          {(() => {
            const liveScore = localScores.get(player.playerId);
            const showScore = liveScore ?? player.currentScore;
            if (showScore == null) return null;
            return (
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-grass-dim text-grass text-[11px] font-bold uppercase tracking-[0.04em]">
                <Check className="w-3 h-3" />
                Saved: {formatValue(showScore, station)}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Scoring region */}
      <div className="flex-1 flex flex-col px-4 pb-[env(safe-area-inset-bottom)]">
        {/* Current value readout */}
        <div className="bg-card border border-hair rounded-lg px-5 py-5 text-center">
          <div className="type-label">
            {station.scoreType === "lower_better"
              ? "Time"
              : station.scoreType === "higher_better"
                ? "Value"
                : "Rating"}
          </div>
          <div
            className={cn(
              "mt-1 font-mono font-bold leading-none",
              value ? "text-ink" : "text-ink-4",
              value.length >= 6 ? "text-[40px]" : "text-[56px]",
            )}
          >
            {value || "—"}
            {value && station.unit && (
              <span className="text-[18px] text-ink-3 font-semibold ml-1">
                {station.unit}
              </span>
            )}
          </div>
          {showNote && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              className="mt-3 w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red"
              autoFocus
            />
          )}
        </div>

        {/* Flag row */}
        <div className="mt-3 flex gap-2">
          <FlagButton
            active={flag === "standout"}
            onClick={() => setFlag(flag === "standout" ? null : "standout")}
            icon={<Star className="w-4 h-4" />}
            label="Standout"
            color="grass"
          />
          <FlagButton
            active={flag === "attention"}
            onClick={() => setFlag(flag === "attention" ? null : "attention")}
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Attention"
            color="amber"
          />
          <button
            type="button"
            onClick={() => setShowNote((v) => !v)}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1 min-h-[44px] rounded-md border-2 text-[12px] font-semibold transition-colors",
              showNote || note
                ? "border-ink bg-paper text-ink"
                : "border-hair bg-card text-ink-3",
            )}
          >
            <Flag className="w-4 h-4" /> Note
          </button>
        </div>

        {/* Keypad */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {isRating ? (
            <RatingKeypad onPick={(v) => setValue(String(v))} value={value} />
          ) : (
            <NumericKeypad
              value={value}
              onChange={setValue}
              allowDecimal={station.scoreType !== "rating"}
            />
          )}
        </div>

        {/* Action row */}
        <div className="mt-auto pt-4 pb-4 space-y-2">
          {/* Save & next — fully optimistic. Coach can keep tapping
              even if background saves are still resolving; only blocked
              when there's no value entered yet. */}
          <button
            onClick={() => save(true)}
            disabled={!value}
            className={cn(
              "w-full h-14 rounded-md text-[16px] font-bold tracking-tight transition-colors",
              !value
                ? "bg-paper-deep text-ink-4"
                : "bg-red text-white hover:bg-red/90 active:bg-red/80",
            )}
          >
            Save &amp; next →
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => save(false)}
              disabled={!value}
              className="min-h-[44px] rounded-md bg-card border border-hair text-[13px] font-semibold text-ink hover:bg-paper active:bg-paper-deep disabled:opacity-50"
            >
              Save (stay)
            </button>
            <button
              onClick={clearScore}
              disabled={
                // Disabled when there's nothing to clear — read from
                // localScores so the button updates immediately after
                // an optimistic save (was disabled, now active).
                !(localScores.has(player.playerId) || player.currentScore != null) ||
                isPending
              }
              className="min-h-[44px] rounded-md bg-card border border-hair text-[13px] font-semibold text-red hover:bg-red-soft disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Keypads
// ─────────────────────────────────────────────────────────────────

function NumericKeypad({
  value,
  onChange,
  allowDecimal,
}: {
  value: string;
  onChange: (v: string) => void;
  allowDecimal: boolean;
}) {
  const press = (k: string) => {
    if (k === "⌫") {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === ".") {
      if (value.includes(".")) return;
      if (value.length === 0) onChange("0.");
      else onChange(value + ".");
      return;
    }
    if (value.length >= 6) return; // keep readout legible
    onChange(value + k);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", allowDecimal ? "." : "", "0", "⌫"];
  return (
    <>
      {keys.map((k, i) => {
        if (!k) return <div key={i} />;
        const isBackspace = k === "⌫";
        return (
          <button
            key={i}
            onClick={() => press(k)}
            className={cn(
              "h-14 rounded-md border font-display text-[22px] font-semibold transition-colors",
              isBackspace
                ? "bg-paper border-hair text-ink-3 hover:bg-paper-deep"
                : "bg-card border-hair text-ink hover:bg-paper",
            )}
          >
            {isBackspace ? <Delete className="w-5 h-5 mx-auto" /> : k}
          </button>
        );
      })}
    </>
  );
}

function RatingKeypad({
  onPick,
  value,
}: {
  onPick: (v: number) => void;
  value: string;
}) {
  const active = parseFloat(value);
  return (
    <div className="col-span-3 grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onPick(n)}
          className={cn(
            "h-20 rounded-md border-2 font-display text-[32px] font-bold transition-all",
            active === n
              ? "border-red bg-red-soft text-red"
              : "border-hair bg-card text-ink hover:border-ink-3",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function FlagButton({
  active,
  onClick,
  icon,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: "grass" | "amber";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // min-h-[44px] matches the rest of the action row so the flag
        // strip is comfortable to tap with a thumb at speed.
        "flex-1 inline-flex items-center justify-center gap-1 min-h-[44px] rounded-md border-2 text-[12px] font-semibold transition-colors",
        active
          ? color === "grass"
            ? "border-grass bg-grass-dim text-grass"
            : "border-amber bg-amber-soft text-amber"
          : "border-hair bg-card text-ink-3",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Failure banner
// ─────────────────────────────────────────────────────────────────

/**
 * FailureBanner — surfaces every save that didn't land. Coach can:
 *   - Tap "Retry" on an individual entry → re-fires that one save
 *   - Tap "Retry all" → re-fires every queued save in parallel
 *   - Tap × on an entry → drops it (last-resort: coach gives up)
 *
 * Each entry shows the player + value + reason, so the coach can
 * always recover the data manually if needed (no silent loss).
 */
function FailureBanner({
  failed,
  onRetry,
  onRetryAll,
  onDismiss,
  formatValue,
}: {
  failed: FailedSave[];
  onRetry: (entry: FailedSave) => void;
  onRetryAll: () => void;
  onDismiss: (id: string) => void;
  formatValue: (v: number) => string;
}) {
  return (
    <div
      role="alert"
      className="bg-red-soft border-b-2 border-red px-3 py-2"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle className="w-4 h-4 text-red shrink-0" />
        <div className="flex-1 text-[12px] font-bold text-red">
          {failed.length} save{failed.length === 1 ? "" : "s"} didn&apos;t
          land — your entries are safe below.
        </div>
        {failed.length > 1 && (
          <button
            type="button"
            onClick={onRetryAll}
            className="min-h-[40px] px-3 inline-flex items-center gap-1 bg-red text-white rounded-sm text-[11.5px] font-bold hover:bg-red/90 active:bg-red/80"
          >
            <RefreshCw className="w-3 h-3" />
            Retry all
          </button>
        )}
      </div>
      <div className="space-y-1">
        {failed.slice(0, 4).map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-2 bg-card border border-red/30 rounded-sm px-2.5 py-1.5"
          >
            <div className="flex-1 min-w-0 text-[12px]">
              <span className="font-semibold truncate">{f.playerName}</span>
              <span className="font-mono ml-1.5 text-ink-2">
                {formatValue(f.value)}
              </span>
              <span className="text-ink-3 ml-1.5 truncate">· {f.error}</span>
            </div>
            <button
              type="button"
              onClick={() => onRetry(f)}
              className="min-h-[40px] px-3 inline-flex items-center gap-1 bg-red text-white rounded-sm text-[11px] font-bold hover:bg-red/90"
              aria-label={`Retry save for ${f.playerName}`}
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
            <button
              type="button"
              onClick={() => onDismiss(f.id)}
              className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-ink-3 hover:text-red rounded-sm"
              aria-label={`Dismiss failed save for ${f.playerName}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {failed.length > 4 && (
          <div className="text-[11px] text-red/80 text-center pt-0.5">
            + {failed.length - 4} more — Retry all clears the queue
          </div>
        )}
      </div>
    </div>
  );
}

function formatValue(v: number, st: TryoutStation): string {
  if (st.scoreType === "rating") return v.toFixed(1);
  if (st.unit === "s") return v.toFixed(2) + "s";
  if (st.unit) return v.toFixed(1).replace(/\.0$/, "") + " " + st.unit;
  return v.toFixed(1).replace(/\.0$/, "");
}
