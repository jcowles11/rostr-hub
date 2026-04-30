"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { tapHaptic } from "@/lib/haptic";

/**
 * DemoBanner — sticky chrome that tells visitors "this is fake data".
 *
 * Mobile-first redesign: vertical real estate is precious on phones
 * and the previous full-width banner wrapped to two rows + ate ~50px.
 *
 * On mobile (<lg) defaults to a compact 32px pill: "DEMO · Sign up →"
 * with a chevron to expand into the full explainer. On desktop, full
 * banner is shown by default.
 *
 * Translucent blur backdrop matches the rest of our iOS chrome so the
 * page reads as a single cohesive surface instead of three stacked
 * bars (browser → demo banner → app bar).
 */
export function DemoBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        // Translucent blurred amber so it visually integrates with the
        // chrome above it instead of being a stark separator strip.
        "sticky top-0 z-[40]",
        "bg-amber-soft/85 backdrop-blur-xl backdrop-saturate-150",
        "border-b border-amber/40",
      )}
    >
      <div className="max-w-layout-app mx-auto">
        {/* Compact row — always visible. */}
        <div className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-2">
          <Link
            href="/"
            onPointerDown={() => tapHaptic(6)}
            className={cn(
              "hidden sm:inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-3 whitespace-nowrap rounded-full px-1.5 py-0.5",
              "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              "hover:text-ink active:scale-[0.94]",
            )}
            title="Back to Rostr home"
          >
            <ArrowLeft className="w-3 h-3" strokeWidth={2.25} />
            Home
          </Link>
          <span className="hidden sm:inline text-ink-4">·</span>
          <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-amber text-white text-[10px] font-bold uppercase tracking-[0.08em] shrink-0">
            <Eye className="w-3 h-3" strokeWidth={2.5} />
            Demo
          </span>

          {/* Mobile: compact one-liner. Desktop: full sentence. */}
          <span className="text-[12px] sm:text-[12.5px] text-ink-2 leading-snug flex-1 min-w-0 truncate">
            <span className="hidden sm:inline">
              Fictional Lincoln HS data — click anywhere, nothing saves.
            </span>
            <span className="sm:hidden">Fictional data · nothing saves.</span>
          </span>

          <Link
            href="/signup"
            onPointerDown={() => tapHaptic(8)}
            className={cn(
              "inline-flex items-center gap-1 text-[11.5px] sm:text-[12.5px] font-bold text-red whitespace-nowrap rounded-full px-2.5 py-1",
              "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              "hover:bg-red hover:text-white active:scale-[0.94]",
            )}
          >
            <span className="sm:hidden">Sign up →</span>
            <span className="hidden sm:inline">Sign up to use it for real →</span>
          </Link>

          {/* Mobile-only expand toggle. */}
          <button
            type="button"
            onClick={() => {
              tapHaptic(6);
              setExpanded((v) => !v);
            }}
            aria-label={expanded ? "Collapse demo banner" : "Expand demo banner"}
            aria-expanded={expanded}
            className={cn(
              "sm:hidden w-7 h-7 inline-flex items-center justify-center rounded-full text-ink-3 shrink-0",
              "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              "active:scale-90",
            )}
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.25} />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.25} />
            )}
          </button>
        </div>

        {/* Mobile-only expanded body. */}
        {expanded && (
          <div className="sm:hidden px-3 pb-3 -mt-1 text-[11.5px] text-ink-2 leading-relaxed animate-page-enter">
            <p>
              You&apos;re looking at the real Rostr coach app, populated with
              fake Lincoln HS data so you can poke around without signing
              up. Buttons work; nothing actually saves.
            </p>
            <Link
              href="/"
              onClick={() => tapHaptic(6)}
              className="inline-flex items-center gap-1 mt-2 text-[11.5px] font-semibold text-ink-3 active:scale-[0.94] transition-transform"
            >
              <ArrowLeft className="w-3 h-3" strokeWidth={2.25} />
              Back to Rostr home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
