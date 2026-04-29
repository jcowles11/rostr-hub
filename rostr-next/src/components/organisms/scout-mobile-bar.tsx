"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Menu, X, LogOut, User as UserIcon, Search, BookmarkCheck, Heart,
  TrendingUp, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/atoms/avatar";
import { LogoMark } from "@/components/atoms/logo";
import type { RecruiterContext, RecruiterList } from "@/lib/services/recruiter";

/**
 * ScoutMobileBar — mobile chrome for /scout. Drawer-style hamburger
 * with primary nav + lists + profile actions.
 */
export function ScoutMobileBar({
  recruiter,
  lists,
  user,
}: {
  recruiter: RecruiterContext;
  lists: RecruiterList[];
  user: { name: string; role: string; initials: string };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const primaryNav = [
    { label: "Search", href: "/scout", icon: <Search className="w-4 h-4" /> },
    { label: "Saved searches", href: "/scout/searches", icon: <BookmarkCheck className="w-4 h-4" /> },
    { label: "Lists", href: "/scout/lists", icon: <Heart className="w-4 h-4" /> },
    { label: "Recent views", href: "/scout/history", icon: <TrendingUp className="w-4 h-4" /> },
    { label: "Settings", href: "/scout/settings", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <>
      <header className="lg:hidden h-12 px-3 bg-ink text-white flex items-center gap-2 shrink-0 sticky top-0 z-topbar">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              className="w-9 h-9 inline-flex items-center justify-center rounded-sm hover:bg-white/10"
            >
              <Menu className="w-[18px] h-[18px]" />
            </button>
          </Dialog.Trigger>

          <div className="flex items-center gap-2 ml-1 flex-1 min-w-0">
            <LogoMark size="sm" variant="light" />
            <div className="min-w-0 truncate font-display text-[13px] font-semibold tracking-tight">
              {recruiter.organizationName}
            </div>
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.12em] text-red bg-red/15 rounded-xs px-1.5 py-0.5">
              Scout
            </span>
          </div>

          <Dialog.Portal>
            <Dialog.Overlay className="lg:hidden fixed inset-0 bg-black/50 z-[95] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <Dialog.Content className="lg:hidden fixed left-0 top-0 bottom-0 w-[82vw] max-w-[320px] bg-ink text-white z-[96] flex flex-col shadow-[6px_0_30px_rgba(0,0,0,0.3)] data-[state=open]:animate-slide-in-left">
              <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <LogoMark size="md" variant="light" />
                  <Dialog.Title className="font-display text-[15px] font-bold tracking-tight">
                    rostr scout
                  </Dialog.Title>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="w-9 h-9 inline-flex items-center justify-center rounded-sm hover:bg-white/10"
                  >
                    <X className="w-[18px] h-[18px]" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Org card */}
              <div className="m-3 p-3 bg-white/5 border border-white/10 rounded-md">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/50 mb-1">
                  Recruiting for
                </div>
                <div className="font-display text-[14px] font-semibold truncate">
                  {recruiter.organizationName}
                </div>
                <div className="mt-0.5 text-[11px] text-white/55 uppercase font-mono">
                  {recruiter.organizationDivision ?? "—"} · {recruiter.sport}
                </div>
              </div>

              {/* Primary nav */}
              <nav className="flex-1 overflow-y-auto px-3">
                {primaryNav.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/scout" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2.5 rounded-sm text-[14px] font-medium transition-colors",
                        isActive ? "bg-red text-white" : "text-white/80 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span className="w-4 h-4 shrink-0">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                {lists.length > 0 && (
                  <>
                    <div className="px-2.5 pt-4 pb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
                      My lists
                    </div>
                    {lists.map((l) => (
                      <Link
                        key={l.id}
                        href={`/scout/lists/${l.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-sm text-[13px] text-white/80 hover:text-white hover:bg-white/5"
                      >
                        <span className="shrink-0 text-[14px]">{l.emoji ?? "•"}</span>
                        <span className="truncate flex-1">{l.name}</span>
                        <span className="font-mono text-[10px] text-white/40 shrink-0">
                          {l.playerCount}
                        </span>
                      </Link>
                    ))}
                  </>
                )}
              </nav>

              {/* User footer */}
              <div className="p-3 border-t border-white/10">
                <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
                  <Avatar size="md" color="sky" initials={user.initials} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate">{user.name}</div>
                    <div className="text-[10.5px] text-white/55 truncate">{user.role}</div>
                  </div>
                </div>
                <Link
                  href="/scout/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-[13px] text-white/80 hover:bg-white/5 hover:text-white"
                >
                  <UserIcon className="w-3.5 h-3.5" /> Recruiter settings
                </Link>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-[13px] text-white/80 hover:bg-red-soft/20 hover:text-red"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Log out
                  </button>
                </form>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>
    </>
  );
}
