import { ShieldCheck, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Data source badges for player profiles.
 *
 * Player profiles mix two kinds of data:
 *
 *   1. VERIFIED — produced by the Rostr scoring engine or written by
 *      a coach (live game stats, tryout measurables, season views).
 *      These are objective and tied to specific events that happened.
 *
 *   2. PLAYER REPORTED — typed by the player on /me/profile (bio,
 *      GPA, SAT/ACT, prior-season stats from before Rostr). These
 *      are unverified and recruiters need to know that.
 *
 * The two MUST be visually distinct on the public profile so a coach
 * or recruiter never confuses a player-typed ".380 BA last summer"
 * with a Rostr-tracked .380. These badges are the load-bearing visual
 * signal — every data block on /p/[handle] gets one.
 *
 * Verified = grass color + shield icon. Player Reported = amber +
 * person icon. Same shape (rounded pill), different color + icon, so
 * the distinction reads at a glance without coloring the whole card.
 */

export function VerifiedBadge({
  size = "md",
  source,
  className,
}: {
  size?: "sm" | "md";
  /** Optional source label, e.g. "Coach Martinez" or "Live scoring". */
  source?: string;
  className?: string;
}) {
  return (
    <span
      title={source ? `Verified by ${source}` : "Verified by Rostr"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.06em]",
        "bg-grass-dim text-grass border border-grass/20",
        size === "sm" ? "px-1.5 py-0.5 text-[9.5px]" : "px-2 py-0.5 text-[10.5px]",
        className,
      )}
    >
      <ShieldCheck
        className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"}
        strokeWidth={2.5}
      />
      {source ? `Verified · ${source}` : "Verified"}
    </span>
  );
}

export function PlayerReportedBadge({
  size = "md",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      title="Player reported — not independently verified"
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.06em]",
        "bg-amber-soft text-amber border border-amber/25",
        size === "sm" ? "px-1.5 py-0.5 text-[9.5px]" : "px-2 py-0.5 text-[10.5px]",
        className,
      )}
    >
      <UserCircle2
        className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"}
        strokeWidth={2.5}
      />
      Player reported
    </span>
  );
}
