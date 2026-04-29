"use client";

import { useEffect, useState } from "react";
import { UserPlus, MessageSquare, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import { comingSoon } from "@/lib/coming-soon";

/**
 * Tab descriptor passed in from the server component. Each tab points
 * at an `id="..."` on a section in the page below; clicking scrolls to
 * that section. Server decides which tabs to surface based on what
 * data actually exists for this profile (no "Stats" tab on a profile
 * with no stats yet).
 */
export interface PlayerProfileTab {
  /** Visible label, e.g. "Stats". */
  name: string;
  /** Anchor id to scroll into view. */
  anchor: string;
  /** Optional small annotation, e.g. "4yr". */
  count?: string;
}

/**
 * Interactive pieces of /p/[handle] — kept in a "use client" island
 * so the surrounding page stays an async Server Component.
 *
 * Tabs scroll to in-page section anchors instead of swapping content,
 * because the profile is a single long page (Stats, Highlights,
 * Combine, etc. all stack below the hero). The active state follows
 * the user's scroll position via IntersectionObserver so the
 * highlighted tab matches what they're actually looking at.
 */
export function PlayerProfileTabs({ tabs }: { tabs: PlayerProfileTab[] }) {
  const [active, setActive] = useState(tabs[0]?.anchor ?? "overview");

  // Track which section is currently in view so the active tab
  // updates as the user scrolls.
  useEffect(() => {
    if (typeof window === "undefined" || tabs.length === 0) return;
    const elements = tabs
      .map((t) => document.getElementById(t.anchor))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top of the viewport that's intersecting.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -55% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [tabs]);

  if (tabs.length === 0) return null;

  return (
    <div className="flex gap-1 border-b border-hair mt-8 overflow-x-auto">
      {tabs.map((t) => {
        const isActive = t.anchor === active;
        return (
          <button
            key={t.anchor}
            onClick={() => {
              const el = document.getElementById(t.anchor);
              if (el) {
                // Account for sticky DEMO banner / app bar overlap.
                const top = el.getBoundingClientRect().top + window.scrollY - 96;
                window.scrollTo({ top, behavior: "smooth" });
                setActive(t.anchor);
              }
            }}
            className={cn(
              "px-[18px] py-3.5 text-[13.5px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors",
              isActive
                ? "text-ink border-red"
                : "text-ink-3 border-transparent hover:text-ink",
            )}
          >
            {t.name}
            {t.count && <span className="ml-1.5 font-mono text-[11px] text-ink-4">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Re-export so callers that use the legacy `comingSoon` hook here
 * don't break — kept for any future tabs that don't have a section yet.
 */
export { comingSoon };

export function PlayerProfileActions({
  handle,
  name,
}: {
  handle: string;
  name: string;
}) {
  const [following, setFollowing] = useState(false);

  const copyLink = async () => {
    const url = `${window.location.origin}/p/${handle}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: url });
    } catch {
      toast.error("Couldn't copy", { description: "Browser blocked clipboard access." });
    }
  };

  return (
    <div className="flex gap-2 pt-16 shrink-0">
      <Button
        variant={following ? "primary" : "secondary"}
        size="lg"
        onClick={() => {
          setFollowing((v) => !v);
          toast.success(following ? `Unfollowed ${name}` : `Following ${name}`);
        }}
      >
        {following ? (
          <>
            <Check className="w-[15px] h-[15px]" /> Following
          </>
        ) : (
          <>
            <UserPlus className="w-[15px] h-[15px]" /> Follow
          </>
        )}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        onClick={() => comingSoon("Message", "Recruiter-routed messaging wires up with NCAA compliance next.")}
      >
        <MessageSquare className="w-[15px] h-[15px]" /> Message
      </Button>
      <Button variant="primary" size="lg" onClick={copyLink}>
        <Share2 className="w-[15px] h-[15px]" /> Share profile
      </Button>
    </div>
  );
}
