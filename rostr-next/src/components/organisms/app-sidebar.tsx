"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, User as UserIcon, ExternalLink, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/atoms/avatar";
import { LogoMark } from "@/components/atoms/logo";

/**
 * AppSidebar — organisms/app-sidebar
 * COMPONENTS.md §Organisms/<AppSidebar>: 220px, ink bg, sections + items.
 * Visual reference: handoff/designs/02_Coach_Hub.html.
 */

export interface TeamContext {
  name: string;
  sport: string;
  level: string;
  playerCount: number;
}

export interface UserContext {
  name: string;
  role: string;
  initials: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export interface UpNextItem {
  id: string;
  opponent: string;
  dateLabel: string;
  reportLabel: string | null;
}

export interface AppSidebarProps {
  team: TeamContext;
  sections: NavSection[];
  user: UserContext;
  upNext?: UpNextItem | null;
}

export function AppSidebar({ team, sections, user, upNext }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-[240px] bg-ink text-white flex flex-col px-3 py-4 shrink-0 h-screen">
      {/* Brand mark */}
      <div className="flex items-center gap-2.5 px-2 py-1">
        <LogoMark size="md" variant="light" />
        <span className="font-display text-[17px] font-bold tracking-tight">
          rostr
        </span>
      </div>

      {/* Team switcher */}
      <button
        type="button"
        className="mt-4 mb-5 p-3 bg-white/5 border border-white/10 rounded-md text-left hover:bg-white/10 transition-colors"
      >
        <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/50 mb-1">
          Active team
        </div>
        <div className="flex items-center gap-1.5 font-display text-[14px] font-semibold">
          {team.name}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/55">
          <span>{team.sport}</span>
          <span>·</span>
          <span>{team.level}</span>
          <span>·</span>
          <span>{team.playerCount} players</span>
          <ChevronDown className="ml-auto w-3.5 h-3.5 text-white/40" />
        </div>
      </button>

      {/* Nav sections — scrollable so we never overflow the column */}
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto -mx-3 px-3 min-h-0">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-2.5 pt-3.5 pb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
              {section.label}
            </div>
            {section.items.map((item) => {
              // Exact-match root paths (/app, /demo) so they don't claim
              // every sub-route as "active". For deeper hrefs, require a
              // trailing-slash boundary so /demo/games doesn't accidentally
              // match /demo/g... — only true sub-routes.
              const isRootPath =
                item.href === "/app" || item.href === "/demo";
              const isActive = isRootPath
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-[13.5px] font-medium transition-colors",
                    isActive
                      ? "bg-red text-white"
                      : "text-white/75 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <span className="w-4 h-4 inline-flex items-center justify-center shrink-0">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {item.badge != null && (
                    <span
                      className={cn(
                        "ml-auto font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                        isActive ? "bg-black/25" : "bg-white/15",
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

      {/* "Up next" block — fills empty space + drives the coach to the next event */}
      {upNext && (
        <Link
          href={`/app/games/${upNext.id}`}
          className="mt-3 mb-3 block p-3 bg-red/10 border border-red/30 rounded-md hover:bg-red/15 transition-colors"
        >
          <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-red">
            <Clock className="w-3 h-3" /> Up next
          </div>
          <div className="font-display text-[13.5px] font-semibold mt-1 truncate">
            vs {upNext.opponent}
          </div>
          <div className="font-mono text-[11px] text-white/70 mt-0.5 truncate">
            {upNext.dateLabel}
            {upNext.reportLabel ? ` · Report ${upNext.reportLabel}` : ""}
          </div>
        </Link>
      )}

      {/* User menu */}
      <UserMenu user={user} />
    </aside>
  );
}

function UserMenu({ user }: { user: UserContext }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="mt-auto pt-3 border-t border-white/10 relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 p-2 rounded-sm hover:bg-white/5 text-left"
      >
        <Avatar size="md" color="dirt" initials={user.initials} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold truncate">{user.name}</div>
          <div className="text-[10.5px] text-white/55 truncate">{user.role}</div>
        </div>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-white/55 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 bottom-full mb-2 bg-card text-ink border border-hair rounded-md shadow-modal overflow-hidden">
          <Link
            href="/me"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] hover:bg-paper"
          >
            <UserIcon className="w-3.5 h-3.5 text-ink-3" /> My profile
          </Link>
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] hover:bg-paper border-t border-hair-2"
          >
            <ExternalLink className="w-3.5 h-3.5 text-ink-3" /> Marketing site
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] hover:bg-red-soft hover:text-red text-left border-t border-hair-2"
            >
              <LogOut className="w-3.5 h-3.5" /> Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
