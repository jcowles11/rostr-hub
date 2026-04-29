"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, User as UserIcon, ExternalLink, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/atoms/avatar";
import { LogoMark } from "@/components/atoms/logo";
import type { RecruiterContext, RecruiterList } from "@/lib/services/recruiter";

/**
 * ScoutSidebar — the navigation column for the recruiter workspace.
 * Visually mirrors AppSidebar (same ink bg, same densities) but with a
 * recruiter-specific team card + list shortcuts.
 */

export interface ScoutNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
}

export interface ScoutSidebarProps {
  recruiter: RecruiterContext;
  lists: RecruiterList[];
  user: { name: string; role: string; initials: string };
  primaryNav: ScoutNavItem[];
}

export function ScoutSidebar({
  recruiter,
  lists,
  user,
  primaryNav,
}: ScoutSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-[260px] h-screen bg-ink text-white flex flex-col px-3 py-4 shrink-0">
      {/* Brand + switch back to marketing */}
      <Link href="/" className="flex items-center gap-2.5 px-2 py-1 hover:opacity-90">
        <LogoMark size="md" variant="light" />
        <span className="font-display text-[17px] font-bold tracking-tight">
          rostr
        </span>
        <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.12em] text-red bg-red/15 rounded-xs px-1.5 py-0.5">
          Scout
        </span>
      </Link>

      {/* Org card */}
      <button
        type="button"
        className="mt-4 mb-5 p-3 bg-white/5 border border-white/10 rounded-md text-left hover:bg-white/10 transition-colors"
      >
        <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/50 mb-1">
          Recruiting for
        </div>
        <div className="flex items-center gap-1.5 font-display text-[14px] font-semibold truncate">
          {recruiter.organizationName}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/55">
          <span className="uppercase font-mono">
            {recruiter.organizationDivision ?? "—"}
          </span>
          <span>·</span>
          <span>{recruiter.sport}</span>
          {recruiter.verified && (
            <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-grass-dim text-grass text-[9px] font-bold uppercase tracking-[0.04em]">
              Verified
            </span>
          )}
        </div>
      </button>

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5">
        {primaryNav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/scout" && pathname.startsWith(item.href));
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
      </nav>

      {/* Lists section */}
      <div className="mt-6">
        <div className="flex items-center gap-2 px-2.5 pb-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
            My lists
          </div>
          <Link
            href="/scout/lists?new=1"
            className="ml-auto text-white/40 hover:text-white w-5 h-5 inline-flex items-center justify-center rounded-xs hover:bg-white/10"
            aria-label="New list"
          >
            <Plus className="w-3 h-3" />
          </Link>
        </div>
        {lists.length === 0 ? (
          <div className="px-2.5 py-2 text-[11px] text-white/40 leading-relaxed">
            No lists yet. Save a player to start one.
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 max-h-[280px] overflow-y-auto pr-1">
            {lists.map((l) => {
              const href = `/scout/lists/${l.id}`;
              const active = pathname === href;
              return (
                <Link
                  key={l.id}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-[12.5px] transition-colors min-w-0",
                    active ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/5",
                  )}
                >
                  <span className="shrink-0 text-[14px]">{l.emoji ?? "•"}</span>
                  <span className="truncate flex-1">{l.name}</span>
                  <span className="font-mono text-[10px] text-white/40 shrink-0">
                    {l.playerCount}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <UserMenu user={user} />
    </aside>
  );
}

function UserMenu({ user }: { user: { name: string; role: string; initials: string } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="mt-auto pt-3 border-t border-white/10 relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 p-2 rounded-sm hover:bg-white/5 text-left"
      >
        <Avatar size="md" color="sky" initials={user.initials} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold truncate">{user.name}</div>
          <div className="text-[10.5px] text-white/55 truncate">{user.role}</div>
        </div>
        <ChevronDown className={cn("w-3.5 h-3.5 text-white/55 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 bottom-full mb-2 bg-card text-ink border border-hair rounded-md shadow-modal overflow-hidden">
          <Link
            href="/scout/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] hover:bg-paper"
          >
            <UserIcon className="w-3.5 h-3.5 text-ink-3" /> Recruiter settings
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
