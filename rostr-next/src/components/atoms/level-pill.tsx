import { cn } from "@/lib/utils";

/**
 * LevelPill — atoms/level-pill
 *
 * Now accepts any level string (e.g. "Varsity", "JV", "Freshman",
 * "Sophomore", custom). Falls back to sensible visual styling based
 * on semantic order:
 *   0 → red (top team)
 *   1 → sky (second team)
 *   2 → paper-deep (third team)
 *   3+ → amber (extra custom teams)
 *   "cut" / "unassigned" → muted
 *
 * Display is a compact short code (V / JV / Fr / So / …). Pass `short`
 * to override the short code explicitly.
 */
export type LevelKind = "primary" | "secondary" | "tertiary" | "extra" | "cut" | "muted";

const KIND_CLASSES: Record<LevelKind, string> = {
  primary: "bg-red-soft text-red",
  secondary: "bg-sky-soft text-sky",
  tertiary: "bg-paper-deep text-ink-2",
  extra: "bg-amber-soft text-amber",
  cut: "bg-red-soft text-red opacity-70",
  muted: "bg-paper-deep text-ink-3",
};

export function shortCodeFor(level: string): string {
  const l = level.trim();
  if (!l) return "—";
  const lower = l.toLowerCase();
  // Already short — pass through
  if (lower === "v" || lower === "jv" || lower === "fr" || lower === "f") {
    return lower === "f" ? "Fr" : l.toUpperCase();
  }
  if (lower === "so" || lower === "jr" || lower === "sr") {
    return l.charAt(0).toUpperCase() + l.charAt(1).toLowerCase();
  }
  if (lower === "varsity") return "V";
  if (lower === "jv" || lower === "junior varsity") return "JV";
  if (lower === "freshman" || lower === "frosh") return "Fr";
  if (lower === "sophomore") return "So";
  if (lower === "junior") return "Jr";
  if (lower === "senior") return "Sr";
  if (lower === "cut") return "Cut";
  if (lower === "unassigned" || lower === "none") return "—";
  // Acronym multi-word names
  const parts = l.split(/\s+/);
  if (parts.length > 1) return parts.map((p) => p[0]).join("").toUpperCase().slice(0, 3);
  return l.slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}

export function kindFor(level: string, orderIndex?: number): LevelKind {
  const lower = level.trim().toLowerCase();
  if (lower === "cut") return "cut";
  if (!lower || lower === "unassigned" || lower === "none") return "muted";
  if (orderIndex === 0) return "primary";
  if (orderIndex === 1) return "secondary";
  if (orderIndex === 2) return "tertiary";
  if (orderIndex != null && orderIndex >= 3) return "extra";
  // Fallback: map by name
  if (lower === "v" || lower === "varsity") return "primary";
  if (lower === "jv" || lower === "junior varsity") return "secondary";
  if (lower === "f" || lower === "fr" || lower === "freshman" || lower === "frosh") return "tertiary";
  return "extra";
}

export function LevelPill({
  level,
  orderIndex,
  short,
  className,
}: {
  level: string;
  orderIndex?: number;
  short?: string;
  className?: string;
}) {
  const kind = kindFor(level, orderIndex);
  const label = short ?? shortCodeFor(level);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xs px-1.5 py-[2px] text-[10.5px] font-bold uppercase tracking-[0.04em]",
        KIND_CLASSES[kind],
        className,
      )}
      title={level}
    >
      {label}
    </span>
  );
}
