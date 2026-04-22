import Link from "next/link";
import { Sparkles, ArrowRight, X } from "lucide-react";

/**
 * SetupBanner — shown at the top of the app shell when the signed-in
 * user has no coach record linked to a program yet. Frames the mock data
 * as a demo preview while they set up their real team.
 */
export function SetupBanner() {
  return (
    <div className="relative bg-ink text-white px-8 py-3 flex items-center gap-3 border-b border-hair">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red/20 text-red shrink-0">
        <Sparkles className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 text-[13px]">
        <b className="font-semibold">Demo mode.</b>{" "}
        <span className="text-white/70">
          You&apos;re looking at sample Lincoln HS data. Connect your real program to see your
          own roster, games, and practices here.
        </span>
      </div>
      <Link
        href="/app/setup"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red hover:bg-red/90 rounded-sm text-[12px] font-semibold"
      >
        Set up program <ArrowRight className="w-3 h-3" />
      </Link>
      <button
        aria-label="Dismiss"
        className="text-white/40 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
