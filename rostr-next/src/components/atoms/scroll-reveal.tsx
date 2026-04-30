"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * ScrollReveal — fades + slides children in when they enter the viewport.
 *
 * The single biggest "is this an app or a website" tell is whether
 * content lands all at once vs. animating in as you scroll past it.
 * Apple News, Whoop, Instagram all stagger card entrances. So do we.
 *
 * Implementation:
 *   - IntersectionObserver fires when the element is ~10% on screen.
 *   - Once revealed, we disconnect the observer (one-shot) so cards
 *     don't replay when the user scrolls back up.
 *   - Honors `prefers-reduced-motion` — no animation for users who
 *     opted out (Apple HIG-compliant).
 *
 * Usage: wrap each card / section. Pass `delayMs` for stagger:
 *
 *   <ScrollReveal>             <- first card, no delay
 *   <ScrollReveal delayMs={60}><- second card, slight stagger
 *   <ScrollReveal delayMs={120}>...
 *
 * Don't over-stagger. >150ms feels slow.
 */
export function ScrollReveal({
  children,
  delayMs = 0,
  /** "up" slides up from below; "in" just fades. */
  variant = "up",
  className,
  /** When false, mounts already revealed — for above-the-fold hero
   *  cards that should appear instantly. */
  enabled = true,
}: {
  children: ReactNode;
  delayMs?: number;
  variant?: "up" | "in";
  className?: string;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(!enabled);
  // Prefers-reduced-motion: skip the animation entirely.
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReducedMotion(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (revealed) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Unsupported — show immediately.
      setRevealed(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            obs.disconnect();
            break;
          }
        }
      },
      {
        // Trigger before the element is fully in view so the animation
        // is most of the way done by the time the user can read it.
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.05,
      },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled, revealed]);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: revealed && !reducedMotion ? `${delayMs}ms` : undefined,
      }}
      className={cn(
        "transition-all duration-[440ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        // Initial: invisible + slid down a hair.
        !revealed && !reducedMotion && variant === "up" && "opacity-0 translate-y-3",
        !revealed && !reducedMotion && variant === "in" && "opacity-0",
        // Revealed (or reduced-motion): natural state.
        (revealed || reducedMotion) && "opacity-100 translate-y-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
