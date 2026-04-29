"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Plus,
  X,
  Swords,
  ClipboardList,
  UserPlus,
  Zap,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { thumpHaptic, tapHaptic } from "@/lib/haptic";

/**
 * MobileFab — floating "compose" button + iOS-style bottom sheet of
 * quick actions.
 *
 * Why this matters for "feels like an app":
 *   - Twitter / LinkedIn / Apple-Notes pattern: a circular accent
 *     button that hovers above the chrome and gets you to the most
 *     common create flows in one tap.
 *   - Sits above the BottomNav (z-topbar+1) and respects safe-area-inset
 *     so it never overlaps the iPhone home bar.
 *   - The action sheet uses Radix Dialog with a slide-up animation,
 *     drag handle, and rounded corners — matches iOS native bottom
 *     sheets visually.
 *
 * Hidden on lg+ (desktop has the docked sidebar) and on full-bleed
 * scoring routes where chrome would steal real estate.
 */
export interface MobileFabAction {
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  /** Tailwind classes for the icon background — e.g. "bg-red-soft text-red". */
  tone?: string;
}

export function MobileFab({
  actions,
  /** Pathnames where the FAB should hide (e.g. station scoring). */
  hideOn = [],
  /** Override the trigger icon. Default is a plus sign. */
  triggerIcon,
  /** Optional bottom offset (defaults to bottom-nav height + safe-area).
   *  Override when the FAB sits on a page without the bottom nav. */
  bottomOffsetClass = "bottom-[calc(64px+env(safe-area-inset-bottom))]",
}: {
  actions: MobileFabAction[];
  hideOn?: RegExp[];
  triggerIcon?: React.ReactNode;
  bottomOffsetClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";

  // Default hide-list: full-bleed flows where the FAB would steal
  // tap targets from the input grid (e.g. station scoring, live
  // scoring view). Caller can override with their own patterns.
  const hide =
    hideOn.length > 0
      ? hideOn
      : [
          /^\/(app|demo)\/tryouts\/[^/]+\/station\/[^/]+/,
          /^\/(app|demo)\/games\/[^/]+\/score(\/|$)/,
          /^\/(app|demo)\/practice\/live-abs\/[^/]+/,
        ];
  if (hide.some((rx) => rx.test(pathname))) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Quick actions"
          onPointerDown={() => thumpHaptic()}
          className={cn(
            // FAB sits above the bottom nav (z-topbar = 5) but below
            // overlays + sheets (z-90+). Plain z-index value, no
            // arbitrary alias — keeps Tailwind happy.
            "lg:hidden fixed right-4 z-10",
            bottomOffsetClass,
            "w-14 h-14 rounded-full",
            // Brand red with iOS-style elevation. Shadow is layered:
            // a soft ambient + a tight contact shadow under the button.
            "bg-red text-white",
            "shadow-[0_10px_30px_-6px_rgba(200,58,58,0.55),0_4px_10px_-2px_rgba(0,0,0,0.25)]",
            // Spring scale on press.
            "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            "active:scale-[0.92]",
            "flex items-center justify-center",
          )}
        >
          {triggerIcon ?? <Plus className="w-6 h-6" strokeWidth={2.5} />}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "lg:hidden fixed inset-0 z-[97]",
            "bg-black/40 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
        />
        <Dialog.Content
          className={cn(
            "lg:hidden fixed left-0 right-0 bottom-0 z-[98]",
            "bg-card rounded-t-2xl shadow-[0_-20px_60px_rgba(0,0,0,0.25)]",
            "max-h-[80vh] flex flex-col",
            "pb-[env(safe-area-inset-bottom)]",
            "data-[state=open]:animate-slide-up",
          )}
        >
          {/* iOS-style drag handle. Tap closes (real drag-to-dismiss
              would need touch-event wiring; tap-handle is fine for v1). */}
          <Dialog.Close asChild>
            <button
              type="button"
              className="w-full flex justify-center pt-2.5 pb-1.5"
              aria-label="Close quick actions"
            >
              <span className="w-9 h-[5px] rounded-full bg-hair" />
            </button>
          </Dialog.Close>

          <div className="flex items-center justify-between px-5 pt-1 pb-3">
            <Dialog.Title className="font-display text-[18px] font-bold tracking-tight text-ink">
              Quick add
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className={cn(
                  "w-9 h-9 inline-flex items-center justify-center rounded-full",
                  "text-ink-3 bg-paper-deep",
                  "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  "active:scale-90 hover:text-ink",
                )}
              >
                <X className="w-4 h-4" strokeWidth={2.25} />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-3 pb-4">
            <ul className="space-y-1">
              {actions.map((action) => (
                <li key={action.label}>
                  <FabActionRow
                    action={action}
                    onSelected={() => {
                      tapHaptic(8);
                      setOpen(false);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FabActionRow({
  action,
  onSelected,
}: {
  action: MobileFabAction;
  onSelected: () => void;
}) {
  const className = cn(
    "w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-left",
    "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    "hover:bg-paper-deep active:scale-[0.98] active:bg-paper-deep",
  );

  const inner = (
    <>
      <span
        className={cn(
          "w-10 h-10 inline-flex items-center justify-center rounded-xl shrink-0",
          action.tone ?? "bg-paper-deep text-ink",
        )}
      >
        {action.icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-[15px] font-semibold tracking-tight text-ink">
          {action.label}
        </span>
        {action.description && (
          <span className="block text-[12px] text-ink-3 mt-0.5 leading-snug">
            {action.description}
          </span>
        )}
      </span>
    </>
  );

  if (action.href) {
    return (
      <Link href={action.href} onClick={onSelected} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        action.onClick?.();
        onSelected();
      }}
      className={className}
    >
      {inner}
    </button>
  );
}

/**
 * Default action set for the authenticated coach app.
 * Each entry is a plausible "the thing I most want to do right now"
 * for a coach who just opened the app.
 */
export const APP_FAB_ACTIONS: MobileFabAction[] = [
  {
    label: "Score live",
    description: "Pick up an in-progress game or start a new one.",
    href: "/app/games",
    icon: <Swords className="w-5 h-5" strokeWidth={2.25} />,
    tone: "bg-red-soft text-red",
  },
  {
    label: "Live AB session",
    description: "Tap-by-tap pitch + outcome scoring.",
    href: "/app/practice/live-abs",
    icon: <Zap className="w-5 h-5" strokeWidth={2.25} />,
    tone: "bg-amber-soft text-amber",
  },
  {
    label: "New practice plan",
    description: "Blocks, drills, lanes — AI helps if stuck.",
    href: "/app/practice",
    icon: <ClipboardList className="w-5 h-5" strokeWidth={2.25} />,
    tone: "bg-grass-dim text-grass",
  },
  {
    label: "Add player",
    description: "One player or import from CSV.",
    href: "/app/roster",
    icon: <UserPlus className="w-5 h-5" strokeWidth={2.25} />,
    tone: "bg-sky-soft text-sky",
  },
  {
    label: "Send announcement",
    description: "Broadcast to parents or the team.",
    href: "/app/messages",
    icon: <Megaphone className="w-5 h-5" strokeWidth={2.25} />,
    tone: "bg-paper-deep text-ink-2",
  },
];

/** Demo mirror — same actions, /demo destinations. */
export const DEMO_FAB_ACTIONS: MobileFabAction[] = [
  {
    label: "Score live",
    description: "Pick up an in-progress game or start a new one.",
    href: "/demo/games",
    icon: <Swords className="w-5 h-5" strokeWidth={2.25} />,
    tone: "bg-red-soft text-red",
  },
  {
    label: "Live AB session",
    description: "Tap-by-tap pitch + outcome scoring.",
    href: "/demo/practice",
    icon: <Zap className="w-5 h-5" strokeWidth={2.25} />,
    tone: "bg-amber-soft text-amber",
  },
  {
    label: "New practice plan",
    description: "Blocks, drills, lanes — AI helps if stuck.",
    href: "/demo/practice",
    icon: <ClipboardList className="w-5 h-5" strokeWidth={2.25} />,
    tone: "bg-grass-dim text-grass",
  },
  {
    label: "Add player",
    description: "One player or import from CSV.",
    href: "/demo/roster",
    icon: <UserPlus className="w-5 h-5" strokeWidth={2.25} />,
    tone: "bg-sky-soft text-sky",
  },
  {
    label: "Send announcement",
    description: "Broadcast to parents or the team.",
    href: "/demo/messages",
    icon: <Megaphone className="w-5 h-5" strokeWidth={2.25} />,
    tone: "bg-paper-deep text-ink-2",
  },
];
