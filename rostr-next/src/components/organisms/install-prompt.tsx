"use client";

import { useEffect, useState } from "react";
import { Share, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { tapHaptic } from "@/lib/haptic";

/**
 * InstallPrompt — iOS / Android "Add to Home Screen" prompt.
 *
 * The single biggest thing that makes a web app feel like "just a
 * browser" on a phone is, well, the browser chrome. Once you tap
 * "Add to Home Screen" and launch from the home icon, the URL bar +
 * tab strip vanish and the app runs fullscreen — no fake. This
 * component teaches that path in 8 seconds.
 *
 * Behavior:
 *   - Detects iOS Safari + standalone display-mode. Shows ONLY when
 *     on iOS Safari and NOT already installed.
 *   - Android Chrome: gets the native `beforeinstallprompt` event
 *     plumbing — tap the button → fires the install dialog.
 *   - Other browsers: hides itself (we'd just be lying about the path).
 *   - Dismissible. The dismissed-at timestamp is persisted in
 *     localStorage; we wait 7 days before re-showing so it's not nag.
 *
 * Designed to feel like a UIAlert / iOS bottom sheet — translucent
 * blurred backdrop, slide-up entrance, drag-handle affordance, big
 * tap targets.
 */

const STORAGE_KEY = "rostr.installPrompt.dismissedAt";
const REPROMPT_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [androidEvent, setAndroidEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed? Hide forever.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari sets navigator.standalone when launched from home
      // screen. Non-standard but the most reliable iOS signal.
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Recently dismissed? Don't re-prompt yet.
    try {
      const dismissedAtStr = localStorage.getItem(STORAGE_KEY);
      if (dismissedAtStr) {
        const dismissedAt = Number(dismissedAtStr);
        const elapsedDays = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
        if (Number.isFinite(elapsedDays) && elapsedDays < REPROMPT_DAYS) return;
      }
    } catch {
      /* localStorage blocked — fine, just always show */
    }

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const isAndroid = /Android/.test(ua);

    // iOS Safari: there's no programmatic install API, but we can
    // *teach* the share-sheet flow. Show the prompt after a short
    // delay so it doesn't fight first paint.
    if (isIOS && isSafari) {
      setPlatform("ios");
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }

    // Android: capture the beforeinstallprompt event Chrome fires.
    // We override Chrome's native banner with our own + call .prompt()
    // when the user taps install.
    if (isAndroid) {
      const handler = (e: Event) => {
        e.preventDefault();
        setAndroidEvent(e as BeforeInstallPromptEvent);
        setPlatform("android");
        setVisible(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }

    // Other (desktop, Firefox iOS, etc.) — no-op.
  }, []);

  function dismiss() {
    tapHaptic(8);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  async function installAndroid() {
    if (!androidEvent) return;
    tapHaptic(12);
    await androidEvent.prompt();
    await androidEvent.userChoice;
    setVisible(false);
  }

  if (!visible || !platform) return null;

  return (
    <div
      className={cn(
        "lg:hidden fixed left-3 right-3 z-[6]",
        // Sit above the bottom nav (which is z-topbar=5) and the FAB
        // (z-10). Banner z is between safe-area chrome and overlays.
        "bottom-[calc(80px+env(safe-area-inset-bottom))]",
        // iOS UIAlert / sheet feel.
        "rounded-2xl bg-white/92 backdrop-blur-xl backdrop-saturate-150",
        "border border-hair shadow-[0_20px_50px_-10px_rgba(0,0,0,0.35),0_4px_12px_-4px_rgba(0,0,0,0.15)]",
        "p-3.5 flex items-start gap-3",
        // Slide-up entrance.
        "animate-slide-up",
      )}
      role="dialog"
      aria-label="Install Rostr"
    >
      <span className="w-10 h-10 rounded-xl bg-red-soft text-red flex items-center justify-center shrink-0 font-display font-black text-[16px]">
        R
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-display text-[14px] font-bold tracking-tight text-ink">
          Install Rostr
        </div>
        {platform === "ios" ? (
          <div className="text-[11.5px] text-ink-2 leading-snug mt-0.5">
            Tap{" "}
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-[3px] bg-paper-deep align-text-bottom">
              <Share className="w-2.5 h-2.5" strokeWidth={2.25} />
            </span>{" "}
            then{" "}
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-[3px] bg-paper-deep text-[10px] font-semibold align-text-bottom">
              <Plus className="w-2.5 h-2.5" strokeWidth={2.5} />
              Add to Home Screen
            </span>{" "}
            for the full app feel.
          </div>
        ) : (
          <div className="text-[11.5px] text-ink-2 leading-snug mt-0.5">
            Get the full-screen app — no browser bars, app icon on your
            home screen, faster launch.
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        {platform === "android" && (
          <button
            type="button"
            onClick={installAndroid}
            className={cn(
              "h-8 px-3 rounded-full bg-red text-white text-[12px] font-bold",
              "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              "active:scale-[0.94]",
            )}
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className={cn(
            "w-8 h-8 rounded-full bg-paper-deep text-ink-3 inline-flex items-center justify-center self-end",
            "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            "active:scale-90 hover:text-ink",
          )}
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
