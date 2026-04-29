import Link from "next/link";
import { Trophy, Plus, ChevronRight, CheckCircle2 } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { MOCK_TEAM } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/**
 * /demo/tryouts — read-only tryouts list for the product tour.
 *
 * Built parallel to /app/tryouts (rather than wrapping TryoutsListView)
 * because the real view owns the create modal + delete actions, both of
 * which would 404 in the demo. Static cards are simpler and convey the
 * same value: prospects see what a multi-day tryout looks like.
 */

export const metadata = {
  title: "Tryouts · Demo · Rostr",
  robots: { index: false, follow: false },
};

const MOCK_TRYOUTS = [
  {
    id: "demo-spring-2026",
    name: "Spring 2026 tryouts",
    dates: "Mar 4 – Mar 7",
    status: "complete" as const,
    summary: "62 attendees · 4 stations · Verdicts posted Mar 9",
    statBlocks: [
      { label: "On Varsity", value: "18" },
      { label: "JV", value: "16" },
      { label: "Cuts", value: "21" },
      { label: "Bubble", value: "7" },
    ],
  },
  {
    id: "demo-fall-2025",
    name: "Fall '25 prospect day",
    dates: "Oct 12",
    status: "complete" as const,
    summary: "34 attendees · 3 stations · Verdicts archived",
    statBlocks: [
      { label: "Invited back", value: "22" },
      { label: "Stations", value: "60-yd · EV · IF" },
      { label: "Top EV", value: "94 mph" },
      { label: "Eval coaches", value: "4" },
    ],
  },
];

export default function DemoTryoutsPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[{ label: MOCK_TEAM.name }, { label: "Tryouts" }]}
        actions={[
          {
            kind: "primary",
            label: "New tryout",
            icon: <Plus className="w-[15px] h-[15px]" />,
            href: "/signup",
          },
        ]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div>
            <h1 className="font-display text-[28px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
              Tryouts
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1">
              Multi-day tryouts with station-based scoring and live rankings.
              Verdicts flow into the roster and verified measurables land on
              each player&apos;s public profile.
            </p>
          </div>

          <div className="mt-7 space-y-3">
            {MOCK_TRYOUTS.map((t) => (
              <TryoutRow key={t.id} tryout={t} />
            ))}
          </div>

          <div className="mt-8 bg-paper-deep border border-dashed border-hair rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-card text-ink-3 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-display text-[15px] font-semibold tracking-tight">
                Run your next tryout in Rostr
              </div>
              <div className="text-[13px] text-ink-3 mt-1 leading-relaxed">
                Invite evaluators by email · QR check-in for attendees · live
                leaderboard while stations score · verdict picker grouped by
                team level. Every score is verified and stamped with the
                evaluator&apos;s name.
              </div>
            </div>
            <Link
              href="/signup"
              className="px-4 py-2 bg-red text-white rounded-sm text-[13px] font-semibold hover:bg-red/90 whitespace-nowrap"
            >
              Sign up to start →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function TryoutRow({
  tryout,
}: {
  tryout: (typeof MOCK_TRYOUTS)[number];
}) {
  return (
    <Link
      href={`/demo/tryouts/${tryout.id}`}
      className="block bg-card border border-hair rounded-lg p-4 hover:bg-paper hover:border-red transition-colors"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-md flex items-center justify-center shrink-0",
            tryout.status === "complete" ? "bg-grass-dim text-grass" : "bg-red-soft text-red",
          )}
        >
          {tryout.status === "complete" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Trophy className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-[15.5px] font-semibold tracking-tight">
              {tryout.name}
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-[0.06em]",
                tryout.status === "complete"
                  ? "bg-grass-dim text-grass"
                  : "bg-red-soft text-red",
              )}
            >
              {tryout.status}
            </span>
          </div>
          <div className="text-[12.5px] text-ink-3 mt-1 font-mono">
            {tryout.dates} · {tryout.summary}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {tryout.statBlocks.map((b) => (
              <div key={b.label} className="bg-paper rounded-md px-3 py-2">
                <div className="font-mono text-[16px] font-semibold tracking-tight">
                  {b.value}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-ink-3 mt-0.5">
                  {b.label}
                </div>
              </div>
            ))}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-ink-3 shrink-0 mt-2.5" />
      </div>
    </Link>
  );
}
