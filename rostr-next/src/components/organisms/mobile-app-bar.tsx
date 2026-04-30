"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { tapHaptic } from "@/lib/haptic";
import { Avatar } from "@/components/atoms/avatar";
import { LogoMark } from "@/components/atoms/logo";
import type { NavSection, TeamContext, UserContext } from "./app-sidebar";

/**
 * MobileAppBar — slim top chrome + hamburger drawer for phones/tablets.
 * Visible only <lg. Pairs with the always-docked desktop AppSidebar.
 * Coaches on iPhone see just the brand + burger; opening it reveals the
 * full nav + team switcher + profile actions.
 */
export function MobileAppBar({
  team,
  sections,
  user,
}: {
  team: TeamContext;
  sections: NavSection[];
  user: UserContext;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // The station scoring page is a full-bleed mobile experience with its own
  // top bar — don't double up on chrome there.
  if (/^\/app\/tryouts\/[^/]+\/station\/[^/]+/.test(pathname ?? "")) return null;

  return (
    <>
      {/* iOS UINavigationBar pattern: SOLID ink chrome (was bg-ink/95
          + backdrop-blur, which read as gray/translucent on the cream
          paper background — coaches said they couldn't tell where the
          nav bar ended). Solid black makes it unmissable. h-14 matches
          iPhone Mail / Apple Music nav-bar height. */}
      <header
        className={cn(
          "lg:hidden h-14 px-3 flex items-center gap-2.5 shrink-0 sticky top-0 z-topbar",
          "bg-ink text-white",
          // Strong shadow + accent border so the bar separates clearly
          // from page content even when scrolling under it.
          "border-b border-white/10",
          "shadow-[0_4px_16px_-6px_rgba(0,0,0,0.45)]",
        )}
      >
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              onPointerDown={() => tapHaptic(6)}
              className={cn(
                // Visible button background so it pops against the
                // dark bar — most "I can't tell what's tappable"
                // complaints on dark chrome trace back to icons that
                // look like decorations.
                "w-10 h-10 inline-flex items-center justify-center rounded-full bg-white/10 shrink-0",
                "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                "hover:bg-white/[0.18] active:bg-white/20 active:scale-[0.88]",
              )}
            >
              <Menu className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </Dialog.Trigger>

          <div className="flex items-center gap-2 ml-0.5 flex-1 min-w-0">
            <LogoMark size="sm" variant="light" />
            <div className="min-w-0 truncate font-display text-[15px] font-bold tracking-tight">
              {team.name}
            </div>
          </div>

          <Link
            href="/me"
            onPointerDown={() => tapHaptic(6)}
            className={cn(
              "w-10 h-10 inline-flex items-center justify-center rounded-full bg-white/10 shrink-0",
              "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              "hover:bg-white/[0.18] active:scale-[0.88]",
            )}
            aria-label="My profile"
          >
            <Avatar size="sm" color="dirt" initials={user.initials} />
          </Link>

          <Dialog.Portal>
            <Dialog.Overlay className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[95] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <Dialog.Content
              className={cn(
                "lg:hidden fixed left-0 top-0 bottom-0 w-[82vw] max-w-[320px] z-[96] flex flex-col",
                "bg-ink/95 backdrop-blur-xl text-white",
                "shadow-[6px_0_40px_rgba(0,0,0,0.4)]",
                "data-[state=open]:animate-slide-in-left",
                "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
              )}
            >
              <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <LogoMark size="md" variant="light" />
                  <Dialog.Title className="font-display text-[16px] font-bold tracking-tight">
                    rostr
                  </Dialog.Title>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className={cn(
                      "w-9 h-9 inline-flex items-center justify-center rounded-full",
                      "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                      "hover:bg-white/10 active:scale-[0.88]",
                    )}
                  >
                    <X className="w-[18px] h-[18px]" strokeWidth={2.25} />
                  </button>
                </Dialog.Close>
              </div>

              {/* Team switcher */}
              <button
                type="button"
                className={cn(
                  "m-3 p-3.5 bg-white/5 border border-white/10 rounded-xl text-left",
                  "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  "hover:bg-white/10 active:scale-[0.98]",
                )}
              >
                <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/50 mb-1">
                  Active team
                </div>
                <div className="font-display text-[15px] font-semibold">
                  {team.name}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/55">
                  <span>{team.sport}</span>
                  <span>·</span>
                  <span>{team.level}</span>
                  <span>·</span>
                  <span>{team.playerCount} players</span>
                </div>
              </button>

              {/* Nav sections */}
              <nav className="flex-1 overflow-y-auto px-3 pb-3">
                {sections.map((section) => (
                  <div key={section.label} className="mb-1">
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
                          onClick={() => {
                            tapHaptic(6);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[14.5px] font-medium",
                            "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                            "active:scale-[0.97]",
                            isActive
                              ? "bg-red text-white"
                              : "text-white/85 hover:bg-white/5 hover:text-white",
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

              {/* User footer */}
              <div className="p-3 border-t border-white/10">
                <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
                  <Avatar size="md" color="dirt" initials={user.initials} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate">{user.name}</div>
                    <div className="text-[10.5px] text-white/55 truncate">{user.role}</div>
                  </div>
                </div>
                <Link
                  href="/me"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-[13px] text-white/80 hover:bg-white/5 hover:text-white"
                >
                  <UserIcon className="w-3.5 h-3.5" /> My profile
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
