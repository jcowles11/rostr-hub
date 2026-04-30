"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { tapHaptic } from "@/lib/haptic";

/**
 * MobileStickyCTA — sticky bottom bar on the marketing landing page.
 *
 * SaaS landing pattern: as the visitor scrolls, a thin pinned bar at
 * the bottom of the viewport keeps "Try free" + "See demo" one tap
 * away. Hides itself for the first ~600px of scroll so the hero CTAs
 * own the first viewport, then fades in. Hidden on desktop where the
 * top nav is always visible.
 *
 * Honors safe-area-inset-bottom so the bar sits above the iPhone home
 * indicator. Translucent backdrop blur reads as iOS chrome.
 */
export function MobileStickyCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      // Show after the user has scrolled past the hero. The threshold
      // is calibrated against the mobile hero — coarse, but better
      // than fading in at scroll=0 (which would compete with the
      // primary CTAs).
      setVisible(window.scrollY > 480);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "lg:hidden fixed left-0 right-0 bottom-0 z-[8] pb-[env(safe-area-inset-bottom)]",
        // iOS UITabBar look — translucent blur, hairline top edge.
        "bg-card/95 backdrop-blur-xl backdrop-saturate-150 border-t border-hair",
        "shadow-[0_-8px_24px_-8px_rgba(14,17,22,0.18)]",
        // Slide up on scroll past hero, slide down at the top.
        "transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Link
          href="/demo"
          onPointerDown={() => tapHaptic(6)}
          className={cn(
            "inline-flex items-center justify-center gap-1 flex-1 h-11 rounded-full",
            "bg-paper-deep text-ink font-semibold text-[13px]",
            "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            "active:scale-[0.96]",
          )}
        >
          <Eye className="w-4 h-4" strokeWidth={2.25} /> See it live
        </Link>
        <Link
          href="/signup"
          onPointerDown={() => tapHaptic(8)}
          className={cn(
            "inline-flex items-center justify-center gap-1 flex-1 h-11 rounded-full",
            "bg-red text-white font-bold text-[13.5px]",
            "shadow-[0_4px_14px_-4px_rgba(200,58,58,0.55)]",
            "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            "active:scale-[0.96] hover:bg-red/90",
          )}
        >
          Try free <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  );
}
