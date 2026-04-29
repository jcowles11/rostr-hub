"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockPlayer } from "@/lib/mock-data";
import {
  PlayerSlideover,
  type PlayerSlideoverStats,
  type PlayerSlideoverMeasurable,
} from "./player-slideover";

/**
 * AvailabilityList — clickable, column-aligned roster of who's out and
 * who's questionable today.
 *
 * Two design wins this fixes:
 *
 *   1. The names used to be plain `<b>` text. Now every row is a tap
 *      target that pops the same PlayerSlideover the Roster uses, so
 *      the coach can confirm "wait who's Brooks again?" without leaving
 *      the standup view.
 *
 *   2. Each row has a fixed-width gutter for jersey · year · position
 *      so the data lines up vertically — scannable instead of soup.
 *
 * The slideover gets the full roster as the `players` array so
 * prev/next arrows let the coach flip through anyone, not just the
 * unavailable subset.
 */
export interface AvailabilityListPlayer {
  id: string;
  jerseyNumber: number;
  firstName: string;
  lastName: string;
  classYearShort: string; // "Sr" / "Jr" / "So" / "Fr"
  positions: string[];
  availabilityStatus: "ok" | "questionable" | "out";
  availabilityNote?: string;
}

export function AvailabilityList({
  /** Players to display — typically out + questionable. Order is preserved. */
  rows,
  /** Full roster for slideover prev/next nav. If omitted, falls back to `rows`. */
  fullRoster,
  battingByPlayer,
  measurablesByPlayer,
  pitchingByPlayer,
}: {
  rows: AvailabilityListPlayer[];
  fullRoster?: MockPlayer[];
  /** Optional pre-computed stats keyed by player id; passed through to the slideover. */
  battingByPlayer?: Record<string, PlayerSlideoverStats>;
  measurablesByPlayer?: Record<string, PlayerSlideoverMeasurable[]>;
  pitchingByPlayer?: Record<
    string,
    { games: number; era: number; whip: number; ip: number; k: number; bb: number }
  >;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const open = activeId !== null;

  // Build a MockPlayer-shaped list for the slideover. The slideover only
  // reads a subset of fields, so we cast — anything missing is fine for
  // the Overview tab.
  const slideoverRoster: MockPlayer[] =
    fullRoster ??
    (rows.map((r) => ({
      id: r.id,
      jerseyNumber: r.jerseyNumber,
      firstName: r.firstName,
      lastName: r.lastName,
      handle: `${r.firstName}-${r.lastName}`.toLowerCase().replace(/\s+/g, "-"),
      initials: `${r.firstName[0] ?? "?"}${r.lastName[0] ?? "?"}`.toUpperCase(),
      avatarColor: "ink",
      classYear: r.classYearShort,
      classYearShort: r.classYearShort,
      gradYear: 2026,
      positions: r.positions,
      level: "V",
      availabilityStatus: r.availabilityStatus,
      availabilityNote: r.availabilityNote,
      profileStatus: "active",
    })) as unknown as MockPlayer[]);

  const activePlayer =
    activeId !== null
      ? slideoverRoster.find((p) => p.id === activeId) ?? null
      : null;

  if (rows.length === 0) return null;

  return (
    <>
      <ul className="divide-y divide-hair-2">
        {rows.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setActiveId(p.id)}
              className={cn(
                "w-full flex items-center gap-3 px-1 py-2 text-left rounded-sm",
                "hover:bg-paper-deep active:bg-paper-deep transition-colors",
              )}
            >
              {/* Fixed-width gutter so jersey / year / pos line up across rows. */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="font-mono text-[11px] text-ink-3 w-6 text-right tabular-nums"
                  aria-label={`Jersey ${p.jerseyNumber}`}
                >
                  #{p.jerseyNumber}
                </span>
                <span
                  className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-3 w-7"
                  aria-label={`Class ${p.classYearShort}`}
                >
                  {p.classYearShort}
                </span>
                <span
                  className="font-mono text-[10.5px] text-ink-3 w-12 truncate"
                  aria-label="Position"
                >
                  {p.positions[0] ?? "—"}
                </span>
              </div>
              {/* Name (flex-1 so it absorbs row width — note pushes status pill right). */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="font-medium text-[12.5px] text-ink truncate">
                  {p.firstName} {p.lastName}
                </span>
                {p.availabilityNote && (
                  <span className="text-[11.5px] text-ink-3 truncate">
                    · {p.availabilityNote}
                  </span>
                )}
              </div>
              {/* Status pill — right side, fixed width so they stack. */}
              <span
                className={cn(
                  "text-[9.5px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-xs shrink-0",
                  p.availabilityStatus === "out"
                    ? "bg-red-soft text-red"
                    : p.availabilityStatus === "questionable"
                      ? "bg-amber-soft text-amber"
                      : "bg-grass-dim text-grass",
                )}
              >
                {p.availabilityStatus === "out" ? "Out" : p.availabilityStatus === "questionable" ? "Quest." : "OK"}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-ink-4 shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      <PlayerSlideover
        player={activePlayer}
        players={slideoverRoster}
        stats={
          activePlayer && battingByPlayer ? battingByPlayer[activePlayer.id] ?? null : null
        }
        measurables={
          activePlayer && measurablesByPlayer ? measurablesByPlayer[activePlayer.id] ?? null : null
        }
        pitching={
          activePlayer && pitchingByPlayer ? pitchingByPlayer[activePlayer.id] ?? null : null
        }
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) setActiveId(null);
        }}
      />
    </>
  );
}
