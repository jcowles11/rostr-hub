import Link from "next/link";

/**
 * / — Landing page stub.
 * Real marketing site will be built from handoff/designs/01_Landing.html.
 */
export default function Landing() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center gap-2.5 mb-6">
          <span className="relative inline-flex w-7 h-7 rounded-sm bg-ink text-white items-center justify-center font-display text-[16px] font-bold">
            R
          </span>
          <span className="font-display text-[17px] font-bold">rostr</span>
        </div>
        <h1 className="font-display text-display-lg mb-3">
          The team operating system for coaches.
        </h1>
        <p className="text-ink-3 text-body mb-8">
          Scaffold in place. Marketing landing page is next up — see{" "}
          <span className="font-mono text-body-sm">handoff/designs/01_Landing.html</span>.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-sm text-[13px] font-semibold hover:bg-red transition-colors"
          >
            Open Coach Hub
          </Link>
          <Link
            href="/dev/atoms"
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-hair text-ink rounded-sm text-[13px] font-semibold hover:bg-paper-deep transition-colors"
          >
            View atoms
          </Link>
        </div>
      </div>
    </div>
  );
}
