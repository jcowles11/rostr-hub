"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/atoms/input";
import { TopBarSearchBox } from "@/components/organisms/top-bar-search";
import { Button } from "@/components/atoms/button";

/**
 * TopBar — organisms/top-bar
 * COMPONENTS.md §Organisms/<TopBar>: 56–60px, card bg, hair border-bottom.
 * Left: breadcrumbs. Right: 280px search + ghost buttons + primary CTA.
 */
export interface Crumb {
  label: string;
  href?: string;
}

export interface TopBarAction {
  kind: "icon" | "ghost" | "primary";
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  notification?: boolean;
}

export interface TopBarProps {
  breadcrumbs: Crumb[];
  searchPlaceholder?: string;
  actions?: TopBarAction[];
  className?: string;
}

export function TopBar({
  breadcrumbs,
  searchPlaceholder,
  actions = [],
  className,
}: TopBarProps) {
  return (
    <header
      className={cn(
        "h-14 px-3 sm:px-5 lg:px-7 bg-card border-b border-hair flex items-center gap-2 sm:gap-[18px] shrink-0 sticky top-0 z-topbar",
        className,
      )}
    >
      {/* Breadcrumbs — last crumb emphasized on mobile, earlier crumbs hidden */}
      <nav className="flex items-center gap-2 text-[13px] text-ink-3 min-w-0">
        {breadcrumbs.map((c, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <React.Fragment key={`${c.label}-${i}`}>
              {i > 0 && (
                <span className="text-ink-4 hidden sm:inline">/</span>
              )}
              <span
                className={cn(
                  isLast ? "text-ink font-semibold" : "text-ink-3 hidden sm:inline",
                  !isLast && c.href && "hover:text-ink cursor-pointer",
                  "truncate",
                )}
              >
                {c.label}
              </span>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Search — hidden on mobile, compact on tablet, full on desktop.
            Functional command-palette-style box: ⌘K opens, Enter
            navigates, Esc closes. Filters MOCK_PLAYERS + events + page
            shortcuts in /demo. */}
        <div className="hidden md:block w-[180px] lg:w-[280px]">
          <TopBarSearchBox placeholder={searchPlaceholder ?? "Search players, drills, games…"} />
        </div>
        {actions.map((a, i) => {
          if (a.kind === "icon") {
            return (
              <button
                key={i}
                type="button"
                onClick={a.onClick}
                aria-label={a.label ?? "Action"}
                className={cn(
                  "relative inline-flex items-center justify-center w-9 h-9 rounded-sm text-ink-2 hover:text-ink hover:bg-paper transition-colors",
                )}
              >
                {a.icon ?? <Bell className="w-[15px] h-[15px]" />}
                {a.notification && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red" />
                )}
              </button>
            );
          }
          // On mobile, ghost buttons collapse to icon-only (saves width).
          const buttonContent =
            a.kind === "ghost" ? (
              <>
                {a.icon}
                {a.label && <span className="hidden sm:inline">{a.label}</span>}
              </>
            ) : (
              <>
                {a.icon}
                {a.label}
              </>
            );
          if (a.href) {
            return (
              <Link key={i} href={a.href}>
                <Button size="md" variant={a.kind === "primary" ? "primary" : "ghost"}>
                  {buttonContent}
                </Button>
              </Link>
            );
          }
          return (
            <Button
              key={i}
              size="md"
              variant={a.kind === "primary" ? "primary" : "ghost"}
              onClick={a.onClick}
            >
              {buttonContent}
            </Button>
          );
        })}
      </div>
    </header>
  );
}
