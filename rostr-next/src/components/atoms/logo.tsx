import { cn } from "@/lib/utils";

/**
 * Rostr logo mark.
 *
 * Sports tie-in: two red baseball-seam arcs flank a bold R, with subtle
 * stitch marks at larger sizes. The R reads first; the seams give it
 * sport-tech identity without being literal/cheesy.
 *
 * Variants:
 *   - dark   (default) — dark ink background, white R, red seams.
 *     Use on light backgrounds (sidebars set their own dark bg).
 *   - light — transparent background, dark R, red seams.
 *     Use on dark backgrounds when you want a bare wordmark.
 *   - mono  — pure white, no seams. For tight chrome where the seam
 *     detail would muddy.
 */

export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";
export type LogoVariant = "dark" | "light" | "mono";

const SIZE_PX: Record<LogoSize, number> = {
  xs: 20,
  sm: 24,
  md: 28,
  lg: 36,
  xl: 56,
};

export function LogoMark({
  size = "md",
  variant = "dark",
  className,
}: {
  size?: LogoSize;
  variant?: LogoVariant;
  className?: string;
}) {
  const px = SIZE_PX[size];
  const showStitches = px >= 28;
  // dark   → dark tile + white R   (use on LIGHT-background pages)
  // light  → white tile + dark R   (use on DARK sidebars / mobile chrome)
  // mono   → transparent + white R, no seams (rare; tight icon-only places)
  const bgFill =
    variant === "dark" ? "#0e1116" : variant === "light" ? "#ffffff" : "transparent";
  const letterFill =
    variant === "dark" ? "#ffffff" : variant === "mono" ? "#ffffff" : "#0e1116";
  const seamColor = variant === "mono" ? "transparent" : "#c83a3a";
  const radius = Math.round(px * 0.18);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={px}
      height={px}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Rostr"
    >
      {/* Background tile */}
      <rect width="32" height="32" rx={radius * 32 / px} fill={bgFill} />

      {/* Left baseball seam */}
      <path
        d="M 8 6 Q 4 16 8 26"
        stroke={seamColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right baseball seam */}
      <path
        d="M 24 6 Q 28 16 24 26"
        stroke={seamColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Stitches — only at sizes where they read clearly */}
      {showStitches && (
        <g stroke={seamColor} strokeWidth="0.9" strokeLinecap="round">
          {/* Left seam stitches */}
          <line x1="5.5" y1="11" x2="7" y2="10.5" />
          <line x1="4.5" y1="14" x2="6" y2="13.7" />
          <line x1="4.5" y1="18" x2="6" y2="18.3" />
          <line x1="5.5" y1="21" x2="7" y2="21.5" />
          {/* Right seam stitches */}
          <line x1="26.5" y1="11" x2="25" y2="10.5" />
          <line x1="27.5" y1="14" x2="26" y2="13.7" />
          <line x1="27.5" y1="18" x2="26" y2="18.3" />
          <line x1="26.5" y1="21" x2="25" y2="21.5" />
        </g>
      )}

      {/* The R — drawn as a path so it doesn't depend on a system font */}
      <path
        d="M 11 9 L 11 23 L 13.6 23 L 13.6 17.5 L 16 17.5 L 19.5 23 L 22.7 23 L 18.9 16.9 C 20.3 16.3 21.2 15.0 21.2 13.2 C 21.2 10.7 19.4 9 16.5 9 L 11 9 Z M 13.6 11.3 L 16.3 11.3 C 17.7 11.3 18.5 12 18.5 13.2 C 18.5 14.4 17.7 15.2 16.3 15.2 L 13.6 15.2 L 13.6 11.3 Z"
        fill={letterFill}
      />
    </svg>
  );
}

/**
 * Full wordmark — logo mark + "rostr" text. Used at the top of the
 * sidebar, signup/login pages, marketing site.
 */
export function LogoWordmark({
  size = "md",
  variant = "dark",
  className,
  textClassName,
}: {
  size?: LogoSize;
  variant?: LogoVariant;
  className?: string;
  textClassName?: string;
}) {
  const textColor =
    variant === "light" ? "text-ink" : "text-white";
  const textSize: Record<LogoSize, string> = {
    xs: "text-[14px]",
    sm: "text-[16px]",
    md: "text-[18px]",
    lg: "text-[24px]",
    xl: "text-[36px]",
  };
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} variant={variant} />
      <span
        className={cn(
          "font-display font-bold tracking-tight",
          textSize[size],
          textColor,
          textClassName,
        )}
      >
        rostr
      </span>
    </span>
  );
}
