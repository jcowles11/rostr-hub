import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { MOCK_TEAM } from "@/lib/mock-data";

/**
 * /demo/[...rest] — catch-all for demo paths that don't have a
 * dedicated mirror page yet.
 *
 * Reached via two paths:
 *   1. The middleware rewrites /app/* clicks (when the visitor came
 *      from /demo) to /demo/* equivalents. If the equivalent doesn't
 *      exist (e.g. /app/practice/live-abs has no demo mirror), this
 *      catch-all handles it.
 *   2. A coach types a random /demo/foo URL by hand.
 *
 * Either way the visitor sees a friendly "not in the demo tour" card
 * with a back-to-demo button + a sign-up CTA — never a 404 and never
 * the login wall.
 */

export const metadata = {
  title: "Demo · Rostr",
  robots: { index: false, follow: false },
};

// Map the missing-route slug back to a human label so the message
// reads naturally instead of just showing the URL.
const FRIENDLY_NAME: Record<string, string> = {
  "practice/live-abs": "Live at-bat tracking",
  "games": "Game detail",
  "tryouts": "Tryout detail + station scoring",
  "messages": "Message thread detail",
  "score": "Live game scoring",
  "setup": "Program setup",
  "players": "Player detail (coach view)",
};

function friendlyFor(rest: string[]): { name: string; closestHref: string } {
  const path = rest.join("/");
  // Try exact match, then progressively shorter prefixes.
  for (let i = rest.length; i > 0; i--) {
    const key = rest.slice(0, i).join("/");
    if (FRIENDLY_NAME[key]) {
      // Suggest the closest existing demo section as a "go here instead" link.
      const top = "/demo/" + (rest[0] ?? "");
      return { name: FRIENDLY_NAME[key], closestHref: top };
    }
  }
  return { name: "This screen", closestHref: "/demo" };
}

export default function DemoCatchAllPage({
  params,
}: {
  params: { rest: string[] };
}) {
  const { name, closestHref } = friendlyFor(params.rest);
  const path = "/demo/" + params.rest.join("/");
  return (
    <>
      <TopBar
        breadcrumbs={[{ label: MOCK_TEAM.name }, { label: "Demo" }]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12 flex items-start justify-center">
        <div className="max-w-md text-center mt-12 bg-card border border-hair rounded-lg p-8">
          <div className="w-12 h-12 rounded-md bg-amber-soft text-amber inline-flex items-center justify-center mb-4">
            <Sparkles className="w-5 h-5" />
          </div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight">
            {name} isn&apos;t in the demo tour yet
          </h1>
          <p className="text-[13.5px] text-ink-3 mt-2 leading-relaxed">
            <code className="font-mono text-[11.5px] bg-paper-deep px-1.5 py-0.5 rounded">{path}</code>{" "}
            is part of the full coach app. Sign up free to use it on
            your real roster — or jump back into the rest of the demo.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
            <Link
              href={closestHref}
              className="px-4 py-2.5 bg-paper border border-hair text-ink rounded-sm text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-paper-deep"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to demo
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2.5 bg-red text-white rounded-sm text-[13px] font-semibold hover:bg-red/90"
            >
              Sign up to use it →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
