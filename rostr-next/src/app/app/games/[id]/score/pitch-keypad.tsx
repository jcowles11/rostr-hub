"use client";

import { Loader2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PitchKind, PitchState } from "./pitch-state";

/**
 * PitchCount — visualizes the live ball/strike count.
 *
 * 3-dot strikes row + 4-dot balls row. Filled per current count.
 * Bold count text on the right. Designed to sit ABOVE the keypad in
 * the scoring view.
 */
export function PitchCount({
  state,
  pitchSequence,
}: {
  state: PitchState;
  /** B-S-B-F-S display under the dots so coach can see the sequence. */
  pitchSequence?: string;
}) {
  return (
    <div className="bg-paper border border-hair rounded-md px-4 py-3 flex items-center gap-4">
      <div className="flex flex-col gap-1.5">
        {/* Strikes (top row) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-3 w-12">
            Strikes
          </span>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "w-3.5 h-3.5 rounded-full border-2",
                i < state.strikes
                  ? "bg-red border-red"
                  : "bg-transparent border-ink-3/30",
              )}
              aria-label={i < state.strikes ? "strike" : "no strike"}
            />
          ))}
        </div>
        {/* Balls (bottom row) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-3 w-12">
            Balls
          </span>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "w-3.5 h-3.5 rounded-full border-2",
                i < state.balls
                  ? "bg-sky border-sky"
                  : "bg-transparent border-ink-3/30",
              )}
              aria-label={i < state.balls ? "ball" : "no ball"}
            />
          ))}
        </div>
      </div>
      <div className="flex-1 text-right">
        <div className="font-mono text-[28px] font-bold tracking-[-0.02em] leading-none">
          {state.balls}-{state.strikes}
        </div>
        {pitchSequence && (
          <div className="font-mono text-[10px] text-ink-3 mt-1 truncate">
            {pitchSequence}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * PitchKeypad — Ball / Strike / Foul / In Play (2x2 grid).
 *
 * Big tap targets (h-16). Auto-resolution (4B → walk, 3K → strikeout)
 * is handled by the reducer; the keypad just fires pitches. When the
 * at-bat is auto-resolved, the parent typically replaces this keypad
 * with the outcome picker (for in-play) or auto-logs (for walks/Ks).
 *
 * Undo button removes the last pitch via the reducer.
 */
export function PitchKeypad({
  onPitch,
  onUndo,
  disabled,
  hasPitches,
}: {
  onPitch: (pitch: PitchKind) => void;
  onUndo: () => void;
  disabled?: boolean;
  hasPitches: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <PitchButton
          label="Ball"
          accent="sky"
          onTap={() => onPitch("ball")}
          disabled={disabled}
        />
        <PitchButton
          label="Strike"
          accent="red"
          onTap={() => onPitch("strike")}
          disabled={disabled}
        />
        <PitchButton
          label="Foul"
          accent="dirt"
          onTap={() => onPitch("foul")}
          disabled={disabled}
        />
        <PitchButton
          label="In Play"
          accent="grass"
          onTap={() => onPitch("in_play")}
          disabled={disabled}
        />
      </div>
      <button
        type="button"
        onClick={onUndo}
        disabled={disabled || !hasPitches}
        className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-paper hover:bg-paper-deep text-ink-2 rounded-sm text-[12.5px] font-semibold disabled:opacity-40"
      >
        <Undo2 className="w-3.5 h-3.5" />
        Undo last pitch
      </button>
    </div>
  );
}

function PitchButton({
  label,
  accent,
  onTap,
  disabled,
}: {
  label: string;
  accent: "sky" | "red" | "dirt" | "grass";
  onTap: () => void;
  disabled?: boolean;
}) {
  const colorMap: Record<string, string> = {
    sky: "bg-sky text-white hover:bg-sky/90 active:bg-sky/80",
    red: "bg-red text-white hover:bg-red/90 active:bg-red/80",
    dirt: "bg-dirt text-white hover:bg-dirt/90 active:bg-dirt/80",
    grass: "bg-grass text-white hover:bg-grass/90 active:bg-grass/80",
  };
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={cn(
        "h-16 rounded-md font-display text-[18px] font-bold tracking-tight transition-colors disabled:opacity-50",
        colorMap[accent],
      )}
    >
      {disabled ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : label}
    </button>
  );
}
