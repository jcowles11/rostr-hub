import Link from "next/link";
import { PublicNav } from "@/components/organisms/public-nav";

/**
 * /scout/unavailable — landing page when an edge-geo block redirects
 * a scout signup or discovery attempt from CA or NY.
 *
 * This is the user-facing message; the underlying reasons are state-
 * law conflicts (CA SOPIPA, NY Ed Law 2-d) which Rostr addresses by
 * not offering the scout/recruiter tier in those states yet.
 *
 * Coach + athlete flows are NOT affected by this page; only the
 * scout-specific routes redirect here.
 */

export const metadata = {
  title: "Scout features not available · Rostr",
  description:
    "Rostr's scout / recruiter features are not yet available in your state. Coach and athlete features continue to work normally.",
  robots: { index: false, follow: false },
};

export default function ScoutUnavailablePage() {
  return (
    <div className="bg-paper min-h-[100dvh]">
      <PublicNav />
      <div className="max-w-[640px] mx-auto px-5 py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-soft text-amber border border-amber/30 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em]">
          Scout features unavailable in your state
        </div>
        <h1 className="mt-5 font-display text-[28px] sm:text-[34px] font-semibold tracking-tight">
          Rostr&apos;s scout tier isn&apos;t available where you are yet
        </h1>
        <p className="mt-4 text-[14.5px] text-ink-2 leading-relaxed">
          Rostr&apos;s scout / recruiter features are intentionally not offered
          in California and New York at this time. Both states have specific
          student-data privacy laws (California&apos;s SOPIPA and New York&apos;s
          Education Law 2-d) that require infrastructure we don&apos;t yet
          have in place. We&apos;ll open access state-by-state as we complete
          the corresponding compliance work.
        </p>
        <p className="mt-3 text-[13.5px] text-ink-3 leading-relaxed">
          Coaches and athletes in your state can still use Rostr&apos;s team
          operating system normally — roster, practice planner, tryouts, live
          scoring, schedules, and more. Only the scout / recruiter discovery
          and outreach features are restricted.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-hair bg-paper px-4 py-2.5 text-[14px] font-medium text-ink-2 hover:text-ink hover:bg-paper-deep transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-xl bg-ink text-paper px-4 py-2.5 text-[14px] font-bold transition active:scale-[0.97]"
          >
            See coach + athlete plans
          </Link>
        </div>
        <p className="mt-10 text-[11.5px] text-ink-3 leading-relaxed">
          If you believe this restriction is in error (you&apos;re traveling,
          using a VPN, etc.), email{" "}
          <a
            href="mailto:hello@rostr.app"
            className="text-red hover:underline"
          >
            hello@rostr.app
          </a>{" "}
          and we&apos;ll sort it out.
        </p>
      </div>
    </div>
  );
}
