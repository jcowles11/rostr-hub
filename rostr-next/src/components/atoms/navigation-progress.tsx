"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * NavigationProgress — thin red bar that flashes on every route change.
 *
 * Why this exists:
 *   Per-route `loading.tsx` files cover server-component fetches (great
 *   for cold navigation), but searchParam swaps, intra-page transitions,
 *   and prefetched links don't trigger them. Coaches still need a visual
 *   ack that their tap registered.
 *
 * How it works:
 *   1. Document-level click listener: any `<a href="/...">` tap shows
 *      the bar instantly — feedback BEFORE the navigation even resolves.
 *   2. usePathname + useSearchParams change → hide the bar after a brief
 *      dwell so the user sees it complete (instead of vanishing
 *      mid-flight on a fast nav).
 *
 * Self-clamps to ~1.6s if no nav resolution arrives (e.g. external link
 * or a tap that didn't actually navigate) so the bar can't get stuck on.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);

  // Hide on route change — but with a small dwell so the bar visibly
  // "completes" instead of disappearing on the same frame as the new
  // page renders.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 250);
    return () => clearTimeout(t);
    // We intentionally fire on path/search change — that's the success
    // condition that hides the bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  // Fallback timeout — never let the bar hang if nothing actually
  // navigated (e.g. modifier-clicked link, target=_blank, hash link).
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 1600);
    return () => clearTimeout(t);
  }, [active]);

  // Document-level click listener — fires the moment a coach taps a
  // navigation link, before Next.js even starts transitioning.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Modifier keys = open in new tab/window; let it through silently.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return; // not a primary click
      const a = (e.target as Element | null)?.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      // Only intercept same-origin same-tab navigations.
      if (a.target && a.target !== "" && a.target !== "_self") return;
      if (href.startsWith("#")) return;
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      )
        return;
      setActive(true);
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
  }, []);

  if (!active) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] pointer-events-none">
      <div className="h-0.5 bg-red/15 overflow-hidden">
        <div className="h-full bg-red w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
