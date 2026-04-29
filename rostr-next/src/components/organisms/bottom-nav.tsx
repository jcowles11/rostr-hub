"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Home,
  Users,
  CalendarDays,
  Swords,
  MoreHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavSection } from "./app-sidebar";

/**
 * BottomNav — sticky bottom tab bar for mobile.
 *
 * Five tabs (Hub / Roster / Schedule / Score / More) modeled after the
 * iOS Health / Apple Sports app pattern: thumb-reach, big touch targets,
 * single-tap return to the most-used surfaces. The "More" button opens
 * a Radix Dialog drawer with the rest of the nav (Stats, Practice,
 * Tryouts, Analytics, Messages, Settings, Help, etc.) so the bar
 * stays five-wide regardless of how the sidebar grows.
 *
 * Why this lives separately from MobileAppBar:
 *   - MobileAppBar is the slim TOP chrome (brand + burger + avatar).
 *   - BottomNav is the bottom tab bar (primary navigation).
 *   - Native apps almost always have both. Coaches' thumbs sit at the
 *     bottom of the phone — putting nav there is the single biggest
 *     win for "feels like an app."
 *
 * Hides itself on:
 *   - Desktop (lg+).
 *   - Full-bleed flows (station scoring) where any chrome would steal
 *     vertical real estate from the input grid.
 */
export interface BottomNavTab {
  label: string;
  href: string;
  /** Match if pathname starts with this (after exact-match check). */
  matchPrefix?: string;
  icon: React.ReactNode;
}

export function BottomNav({
  tabs,
  moreSections,
}: {
  /** Five primary tabs. The 5th is replaced by a "More" button if
   *  `moreSections` is provided. */
  tabs: BottomNavTab[];
  /** Optional drawer sections shown when "More" is tapped. If omitted,
   *  the More button doesn't render and the bar shows all `tabs` flat. */
  moreSections?: NavSection[];
}) {
  const pathname = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = useState(false);

  // Full-bleed: station scoring page owns the screen. No bottom nav.
  if (/^\/(app|demo)\/tryouts\/[^/]+\/station\/[^/]+/.test(pathname)) return null;

  const isTabActive = (tab: BottomNavTab) => {
    if (pathname === tab.href) return true;
    if (tab.matchPrefix && pathname.startsWith(tab.matchPrefix)) return true;
    return false;
  };

  // Are any of the "More" drawer items active? If so, highlight the More tab.
  const moreItems = moreSections?.flatMap((s) => s.items) ?? [];
  const moreActive =
    moreItems.length > 0 &&
    moreItems.some(
      (item) =>
        pathname === item.href ||
        (item.href !== "/app" &&
          item.href !== "/demo" &&
          pathname.startsWith(item.href + "/")),
    );

  return (
    <nav
      className={cn(
        "lg:hidden shrink-0 sticky bottom-0 z-topbar",
        "bg-card border-t border-hair",
        // Respect iPhone home-bar inset so taps don't land on the bezel.
        "pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label="Primary"
    >
      <div className="flex items-stretch h-14">
        {tabs.map((tab) => {
          const active = isTabActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5",
                // Big touch target — minimum height satisfies WCAG 2.5.5.
                "min-h-[44px] active:bg-paper-deep transition-colors",
                active ? "text-red" : "text-ink-3",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center w-5 h-5",
                  active && "drop-shadow-[0_0_0.5px_rgba(200,58,58,0.3)]",
                )}
              >
                {tab.icon}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none tracking-tight",
                  active ? "font-bold" : "font-semibold",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}

        {moreSections && moreSections.length > 0 && (
          <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5",
                  "min-h-[44px] active:bg-paper-deep transition-colors",
                  moreActive ? "text-red" : "text-ink-3",
                )}
                aria-label="More"
              >
                <span className="inline-flex items-center justify-center w-5 h-5">
                  <MoreHorizontal className="w-5 h-5" />
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-none tracking-tight",
                    moreActive ? "font-bold" : "font-semibold",
                  )}
                >
                  More
                </span>
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay
                className="lg:hidden fixed inset-0 bg-black/50 z-[95] data-[state=open]:animate-in data-[state=open]:fade-in-0"
              />
              <Dialog.Content
                className={cn(
                  "lg:hidden fixed left-0 right-0 bottom-0 z-[96]",
                  "bg-card rounded-t-xl shadow-modal",
                  "max-h-[80vh] flex flex-col",
                  "pb-[env(safe-area-inset-bottom)]",
                  "data-[state=open]:animate-slide-up",
                )}
              >
                {/* Drag handle for affordance — taps anywhere on it close */}
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="w-full flex justify-center pt-2 pb-1"
                    aria-label="Close menu"
                  >
                    <span className="w-10 h-1 rounded-full bg-hair" />
                  </button>
                </Dialog.Close>

                <div className="flex items-center justify-between px-4 pt-1 pb-2">
                  <Dialog.Title className="font-display text-[16px] font-bold tracking-tight text-ink">
                    More
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close"
                      className="w-9 h-9 inline-flex items-center justify-center rounded-sm text-ink-3 hover:text-ink hover:bg-paper-deep"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </Dialog.Close>
                </div>

                <nav className="flex-1 overflow-y-auto px-2 pb-3">
                  {moreSections.map((section) => (
                    <div key={section.label} className="mb-1">
                      <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
                        {section.label}
                      </div>
                      {section.items.map((item) => {
                        const isActive =
                          pathname === item.href ||
                          (item.href !== "/app" &&
                            item.href !== "/demo" &&
                            pathname.startsWith(item.href + "/"));
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMoreOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-3 rounded-md text-[14px] font-medium transition-colors",
                              isActive
                                ? "bg-red-soft text-red"
                                : "text-ink-2 hover:bg-paper-deep hover:text-ink",
                            )}
                          >
                            <span className="w-5 h-5 inline-flex items-center justify-center shrink-0">
                              {item.icon}
                            </span>
                            <span className="flex-1">{item.label}</span>
                            {item.badge != null && (
                              <span
                                className={cn(
                                  "font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                  isActive ? "bg-red text-white" : "bg-hair-2 text-ink-3",
                                )}
                              >
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </nav>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </div>
    </nav>
  );
}

/**
 * Default 5-tab config for the authenticated coach app.
 * Hub / Roster / Schedule / Score / More — matches what the original
 * Vite SPA shipped with, scaled to the Next.js feature set.
 */
export const APP_BOTTOM_TABS: BottomNavTab[] = [
  { label: "Hub", href: "/app", icon: <Home className="w-5 h-5" /> },
  { label: "Roster", href: "/app/roster", matchPrefix: "/app/roster", icon: <Users className="w-5 h-5" /> },
  { label: "Schedule", href: "/app/schedule", matchPrefix: "/app/schedule", icon: <CalendarDays className="w-5 h-5" /> },
  { label: "Score", href: "/app/games", matchPrefix: "/app/games", icon: <Swords className="w-5 h-5" /> },
];

/**
 * Demo-mode mirror — same 5 destinations under /demo.
 */
export const DEMO_BOTTOM_TABS: BottomNavTab[] = [
  { label: "Hub", href: "/demo", icon: <Home className="w-5 h-5" /> },
  { label: "Roster", href: "/demo/roster", matchPrefix: "/demo/roster", icon: <Users className="w-5 h-5" /> },
  { label: "Schedule", href: "/demo/schedule", matchPrefix: "/demo/schedule", icon: <CalendarDays className="w-5 h-5" /> },
  { label: "Score", href: "/demo/games", matchPrefix: "/demo/games", icon: <Swords className="w-5 h-5" /> },
];
