import { cn } from "@/lib/utils";

/**
 * LevelPill — atoms/level-pill
 * COMPONENTS.md §Atoms/<LevelPill>: V (varsity), JV, F.
 */
export type Level = "V" | "JV" | "F";

const LEVEL_CLASSES: Record<Level, string> = {
  V: "bg-red-soft text-red",
  JV: "bg-sky-soft text-sky",
  F: "bg-paper-deep text-ink-2",
};

export function LevelPill({
  level,
  className,
}: {
  level: Level;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xs px-1.5 py-[2px] text-[10.5px] font-bold uppercase tracking-[0.04em]",
        LEVEL_CLASSES[level],
        className,
      )}
    >
      {level}
    </span>
  );
}
