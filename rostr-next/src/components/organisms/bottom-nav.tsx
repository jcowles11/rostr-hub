"use client";

import { cloneElement, isValidElement, useState } from "react";
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
import { tapHaptic } from "@/lib/haptic";
import type { NavSection } from "./app-sidebar";

/**
 * BottomNav — sticky iOS-style tab bar for mobile.
 *
 * Design references: Apple Health, Apple Music, LinkedIn iOS, Whoop.
 *
 * iOS-native cues:
 *   - Translucent backdrop with `backdrop-blur-xl` (UITabBar look).
 *     Content scrolls *under* the bar instead of cutting off cleanly.
 *   - Active tab: bumped icon stroke (filled-feel), red color, and a
 *     compact pill indicator above the icon.
 *   - Press-down: spring scale via cubic-bezier(0.34, 1.56, 0.64, 1)
 *     so taps feel like iOS, not like a website button.
 *   - Haptic buzz on Android (iOS Safari blocks vibrate, so iPhone
 *     users get the visual spring instead — it still feels right).
 *   - Safe-area-inset padding so taps clear the iPhone home indicator.
 *
 * Five tabs (Hub / Roster / Schedule / Score / More). The "More" sheet
 * slides up from the bottom and surfaces every sidebar section, so the
 * 5-tab bar never has to grow.
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
        // iOS UITabBar look: very-light translucent backdrop, hairline top.
        // The blur reads "iOS" instantly — content slides under it
        // instead of being clipped.
        "bg-white/80 dark:bg-ink/80 backdrop-blur-xl backdrop-saturate-150",
        "border-t border-hair/80",
        // Respect iPhone home-bar inset so taps don't land on the bezel.
        "pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label="Primary"
    >
      <div className="flex items-stretch h-[52px]">
        {tabs.map((tab) => {
          const active = isTabActive(tab);
          return (
            <BottomNavLink
              key={tab.href}
              tab={tab}
              active={active}
              onTap={() => tapHaptic(6)}
            />
          );
        })}

        {moreSections && moreSections.length > 0 && (
          <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                onPointerDown={() => tapHaptic(6)}
                className={cn(
                  "group flex-1 flex flex-col items-center justify-center gap-0.5 relative",
                  "min-h-[44px] select-none",
                  "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  "active:scale-[0.88]",
                  moreActive ? "text-red" : "text-ink-3",
                )}
                aria-label="More"
              >
                {/* iOS-style indicator pill — only visible when active */}
                <span
                  className={cn(
                    "absolute top-1 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-red transition-all duration-[200ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                    moreActive ? "w-6 opacity-100" : "w-0 opacity-0",
                  )}
                />
                <MoreHorizontal
                  className="w-[22px] h-[22px]"
                  strokeWidth={moreActive ? 2.5 : 1.75}
                />
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
                className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[95] data-[state=open]:animate-in data-[state=open]:fade-in-0"
              />
              <Dialog.Content
                className={cn(
                  "lg:hidden fixed left-0 right-0 bottom-0 z-[96]",
                  "bg-card rounded-t-2xl shadow-modal",
                  "max-h-[80vh] flex flex-col",
                  "pb-[env(safe-area-inset-bottom)]",
                  "data-[state=open]:animate-slide-up",
                )}
              >
                {/* iOS-style drag handle */}
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="w-full flex justify-center pt-2.5 pb-1.5"
                    aria-label="Close menu"
                  >
                    <span className="w-9 h-[5px] rounded-full bg-hair" />
                  </button>
                </Dialog.Close>

                <div className="flex items-center justify-between px-4 pt-1 pb-2">
                  <Dialog.Title className="font-display text-[17px] font-bold tracking-tight text-ink">
                    More
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close"
                      className="w-9 h-9 inline-flex items-center justify-center rounded-full text-ink-3 hover:text-ink hover:bg-paper-deep active:scale-90 transition-transform"
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
                            onClick={() => {
                              tapHaptic(6);
                              setMoreOpen(false);
                            }}
                            className={cn(
                              "flex items-center gap-3 px-3 py-3 rounded-xl text-[14.5px] font-medium",
                              "transition-all duration-[120ms] active:scale-[0.98]",
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
 * Single tab link. Pulled out so we can clone the icon and bump its
 * strokeWidth for the "filled" active state (Lucide icons accept
 * strokeWidth as a prop).
 */
function BottomNavLink({
  tab,
  active,
  onTap,
}: {
  tab: BottomNavTab;
  active: boolean;
  onTap: () => void;
}) {
  // Bump icon stroke + size on active for that "filled SF Symbol" feel.
  const styledIcon = isValidElement(tab.icon)
    ? cloneElement(tab.icon as React.ReactElement, {
        strokeWidth: active ? 2.5 : 1.75,
      })
    : tab.icon;

  return (
    <Link
      href={tab.href}
      onPointerDown={onTap}
      className={cn(
        "group flex-1 flex flex-col items-center justify-center gap-0.5 relative",
        "min-h-[44px] select-none",
        // iOS spring on tap. cubic-bezier(0.34, 1.56, 0.64, 1) is the
        // overshoot curve UIKit uses for press-and-release feedback.
        "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "active:scale-[0.88]",
        active ? "text-red" : "text-ink-3",
      )}
      aria-current={active ? "page" : undefined}
    >
      {/* Indicator pill at the top of the tab — UITabBar selection cue. */}
      <span
        className={cn(
          "absolute top-1 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-red",
          "transition-all duration-[200ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          active ? "w-6 opacity-100" : "w-0 opacity-0",
        )}
      />
      <span className="inline-flex items-center justify-center w-[22px] h-[22px]">
        {styledIcon}
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
}

/**
 * Default 5-tab config for the authenticated coach app.
 * Hub / Roster / Schedule / Score / More — matches what the original
 * Vite SPA shipped with, scaled to the Next.js feature set.
 */
export const APP_BOTTOM_TABS: BottomNavTab[] = [
  { label: "Hub", href: "/app", icon: <Home className="w-[22px] h-[22px]" /> },
  { label: "Roster", href: "/app/roster", matchPrefix: "/app/roster", icon: <Users className="w-[22px] h-[22px]" /> },
  { label: "Schedule", href: "/app/schedule", matchPrefix: "/app/schedule", icon: <CalendarDays className="w-[22px] h-[22px]" /> },
  { label: "Score", href: "/app/games", matchPrefix: "/app/games", icon: <Swords className="w-[22px] h-[22px]" /> },
];

/**
 * Demo-mode mirror — same 5 destinations under /demo.
 */
export const DEMO_BOTTOM_TABS: BottomNavTab[] = [
  { label: "Hub", href: "/demo", icon: <Home className="w-[22px] h-[22px]" /> },
  { label: "Roster", href: "/demo/roster", matchPrefix: "/demo/roster", icon: <Users className="w-[22px] h-[22px]" /> },
  { label: "Schedule", href: "/demo/schedule", matchPrefix: "/demo/schedule", icon: <CalendarDays className="w-[22px] h-[22px]" /> },
  { label: "Score", href: "/demo/games", matchPrefix: "/demo/games", icon: <Swords className="w-[22px] h-[22px]" /> },
];
