"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/atoms/avatar";

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

export interface AppSidebarProps {
  team: TeamContext;
  sections: NavSection[];
  user: UserContext;
}

export function AppSidebar({ team, sections, user }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] bg-ink text-white flex flex-col px-3 py-4 shrink-0">
      {/* Brand mark */}
      <div className="flex items-center gap-2.5 px-2 py-1">
        <span className="relative inline-flex w-7 h-7 rounded-sm bg-white text-ink items-center justify-center font-display text-[16px] font-bold brand-dashed">
          R
        </span>
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

      {/* Nav sections */}
      <nav className="flex flex-col gap-0.5">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-2.5 pt-3.5 pb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
              {section.label}
            </div>
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/app" && pathname.startsWith(item.href));
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

      {/* User card */}
      <div className="mt-auto pt-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 p-2">
          <Avatar size="md" color="dirt" initials={user.initials} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold truncate">{user.name}</div>
            <div className="text-[10.5px] text-white/55 truncate">{user.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
