import { cn } from "@/lib/utils";

/**
 * StatTile — molecules/stat-tile
 * COMPONENTS.md §Molecules/<StatTile>: label / value / optional delta.
 * Used in the Coach Hub 4-col stat row and elsewhere.
 */
export interface StatTileProps {
  label: string;
  value: string;
  /** Delta string — e.g. "+3 vs last season", ".014 last 5". */
  delta?: string;
  deltaDirection?: "up" | "down" | "flat";
  sparkline?: React.ReactNode;
  className?: string;
}

export function StatTile({
  label,
  value,
  delta,
  deltaDirection,
  sparkline,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "bg-card border border-hair rounded-md px-4 py-[14px]",
        className,
      )}
    >
      <div className="type-label">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div className="font-mono text-[26px] font-semibold tracking-[-0.02em] leading-none">
          {value}
        </div>
        {sparkline}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-0.5 text-[11px] font-medium",
            deltaDirection === "up" && "text-grass",
            deltaDirection === "down" && "text-red",
            !deltaDirection && "text-ink-3",
          )}
        >
          {deltaDirection === "up" && "▲ "}
          {deltaDirection === "down" && "▼ "}
          {delta}
        </div>
      )}
    </div>
  );
}
