import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  CheckCircle2,
  XCircle,
  Activity,
  Clock,
  AlertCircle,
  Users,
  Sparkles,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { MOCK_TEAM, MOCK_PLAYERS, MOCK_MEASURABLES_BY_PLAYER } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/**
 * /demo/tryouts/[id] — read-only tryout detail mirror.
 *
 * Shows what a finished tryout looks like in Rostr: stations + scores +
 * verdicts + final placements. Built parallel to /app/tryouts/[id]
 * because the real TryoutView has mutation hooks (record score, set
 * verdict, start/end live mode) that don't make sense in demo mode.
 *
 * The single demo tryout is "Spring 2026 — Verdicts posted", a finished
 * tryout from earlier in the season. Coaches see what the verdict
 * dashboard, the stations breakdown, and the per-attendee score grid
 * all look like.
 */

export const metadata = {
  title: "Tryout · Demo · Rostr",
  robots: { index: false, follow: false },
};

const STATIONS = [
  { code: "60YD", name: "60-yard dash",      unit: "s",  scoreType: "lower_better" as const,  coach: "Coach Martinez" },
  { code: "EV",   name: "Exit velocity",     unit: "mph", scoreType: "higher_better" as const, coach: "Coach Rivera"   },
  { code: "FBV",  name: "Fastball velocity", unit: "mph", scoreType: "higher_better" as const, coach: "Coach Morales"  },
  { code: "VJ",   name: "Vert jump",         unit: "in",  scoreType: "higher_better" as const, coach: "Coach Martinez" },
];

// Verdict assignment for the 15 mock players. Mix of Varsity / JV /
// Bubble / Cut so the dashboard shows realistic distribution.
const VERDICTS: Record<string, "Varsity" | "JV" | "Bubble" | "Cut"> = {
  p1:  "Varsity",  // Marcus Johnson — Sr CF, .372 BA
  p2:  "Varsity",  // Jordan Kim — Jr SS
  p3:  "Varsity",  // Alex Riggs — Sr P/1B
  p4:  "Varsity",  // DeAndre Brooks — Jr 2B/3B
  p5:  "JV",       // Tre Mbeki — So C
  p6:  "Varsity",  // Noah Patel — Sr RF
  p7:  "Varsity",  // Sean Hale — Jr SS/3B
  p8:  "JV",       // Ty Okafor — So P
  p9:  "Varsity",  // Omar Ruiz — Jr LF
  p10: "Varsity",  // Kai Nakamura — Sr P/DH
  p11: "Varsity",  // Jaylen Carter — Jr 1B
  p12: "JV",       // Mateo Vasquez — Sr 3B
  p13: "Bubble",   // Ethan Murphy — So SS
  p14: "Varsity",  // Zayd Hassan — Jr CF
  p15: "JV",       // Caleb Foster — So P
};

export default function DemoTryoutDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const _ = params.id; // placeholder; demo always renders the same tryout
  void _;

  // Build attendees + scores from MOCK_PLAYERS + their measurables.
  type AttendeeRow = {
    playerId: string;
    name: string;
    jersey: number;
    positions: string[];
    classYearShort: string;
    verdict: "Varsity" | "JV" | "Bubble" | "Cut";
    scores: Record<string, { value: number; rank: number }>;
  };

  const attendees: AttendeeRow[] = MOCK_PLAYERS.map((p) => {
    const measurables = MOCK_MEASURABLES_BY_PLAYER[p.id] ?? [];
    const scoreMap: Record<string, { value: number; rank: number }> = {};
    for (const stn of STATIONS) {
      const m = measurables.find((m) => m.shortCode === stn.code);
      if (m) {
        scoreMap[stn.code] = { value: m.bestValue, rank: 0 };
      }
    }
    return {
      playerId: p.id,
      name: `${p.firstName} ${p.lastName}`,
      jersey: p.jerseyNumber,
      positions: p.positions,
      classYearShort: p.classYearShort,
      verdict: VERDICTS[p.id] ?? "Bubble",
      scores: scoreMap,
    };
  });

  // Compute per-station rank.
  for (const stn of STATIONS) {
    const ranked = attendees
      .filter((a) => stn.code in a.scores)
      .sort((a, b) => {
        const av = a.scores[stn.code].value;
        const bv = b.scores[stn.code].value;
        return stn.scoreType === "lower_better" ? av - bv : bv - av;
      });
    ranked.forEach((a, i) => {
      a.scores[stn.code].rank = i + 1;
    });
  }

  const verdictCounts = {
    Varsity: attendees.filter((a) => a.verdict === "Varsity").length,
    JV: attendees.filter((a) => a.verdict === "JV").length,
    Bubble: attendees.filter((a) => a.verdict === "Bubble").length,
    Cut: attendees.filter((a) => a.verdict === "Cut").length,
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: MOCK_TEAM.name },
          { label: "Tryouts", href: "/demo/tryouts" },
          { label: "Spring 2026" },
        ]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          {/* Header */}
          <div className="flex items-start gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-md bg-grass-dim text-grass flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="font-display text-[28px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.05]">
                  Spring 2026 tryouts
                </h1>
                <span className="px-2 py-0.5 rounded-xs bg-grass-dim text-grass text-[10px] font-bold uppercase tracking-[0.06em]">
                  <CheckCircle2 className="w-3 h-3 inline -mt-0.5" /> Complete
                </span>
              </div>
              <p className="text-[13.5px] text-ink-3">
                March 4 – March 7 · 62 attendees · 4 stations · Verdicts
                posted March 9
              </p>
            </div>
            <Link
              href="/demo/tryouts"
              className="px-3 py-2 text-[12.5px] text-ink-3 hover:text-ink rounded-sm inline-flex items-center gap-1.5 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All tryouts
            </Link>
          </div>

          {/* Verdict summary tiles */}
          <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <VerdictTile tone="grass" label="Varsity" count={verdictCounts.Varsity} hint="Top-team locks" />
            <VerdictTile tone="sky" label="JV" count={verdictCounts.JV} hint="Junior varsity" />
            <VerdictTile tone="amber" label="Bubble" count={verdictCounts.Bubble} hint="Decision deferred" />
            <VerdictTile tone="red" label="Cut" count={verdictCounts.Cut} hint="Released" />
          </div>

          {/* Stations */}
          <Section
            icon={<Activity className="w-3.5 h-3.5" />}
            title="Stations"
            subtitle="Tap a station name in the real app to drill into per-evaluator scoring"
          >
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3 border-b border-hair-2">
                  <th className="text-left px-4 py-3 w-12">Code</th>
                  <th className="text-left px-3 py-3">Station</th>
                  <th className="text-left px-3 py-3 hidden sm:table-cell">Coach</th>
                  <th className="text-right px-3 py-3">Scored</th>
                  <th className="text-right px-3 py-3 hidden md:table-cell">Best</th>
                </tr>
              </thead>
              <tbody>
                {STATIONS.map((stn) => {
                  const scored = attendees.filter((a) => stn.code in a.scores).length;
                  const best = attendees
                    .filter((a) => stn.code in a.scores)
                    .map((a) => a.scores[stn.code].value)
                    .sort((a, b) =>
                      stn.scoreType === "lower_better" ? a - b : b - a,
                    )[0];
                  const bestPlayer = attendees.find(
                    (a) => stn.code in a.scores && a.scores[stn.code].rank === 1,
                  );
                  return (
                    <tr
                      key={stn.code}
                      className="border-b border-hair-2 last:border-b-0 hover:bg-paper transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-ink-3">
                        {stn.code}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold">{stn.name}</div>
                        <div className="text-[11px] text-ink-3 mt-0.5">
                          {stn.scoreType === "lower_better" ? "Lower is better" : "Higher is better"}
                          {stn.unit && ` · ${stn.unit}`}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-ink-3 hidden sm:table-cell">
                        {stn.coach}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {scored} / {attendees.length}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono hidden md:table-cell">
                        {best !== undefined ? (
                          <>
                            <span className="text-red font-semibold">{best}</span>
                            <span className="text-ink-3 ml-1">{stn.unit}</span>
                            {bestPlayer && (
                              <div className="text-[10px] text-ink-3 mt-0.5 font-sans">
                                {bestPlayer.name.split(" ").slice(-1)[0]}
                              </div>
                            )}
                          </>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          {/* Attendee table with per-station scores + verdicts */}
          <Section
            icon={<Users className="w-3.5 h-3.5" />}
            title="Attendees + verdicts"
            subtitle={`${attendees.length} players · sorted by verdict`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3 border-b border-hair-2">
                    <th className="text-left px-3 py-3">Player</th>
                    <th className="text-left px-2 py-3">Verdict</th>
                    {STATIONS.map((stn) => (
                      <th key={stn.code} className="text-right px-2 py-3 font-mono">
                        {stn.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...attendees]
                    .sort((a, b) => {
                      const order = { Varsity: 0, JV: 1, Bubble: 2, Cut: 3 };
                      return order[a.verdict] - order[b.verdict];
                    })
                    .map((a) => (
                      <AttendeeRow key={a.playerId} attendee={a} />
                    ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Pilot CTA */}
          <div className="mt-8 bg-paper-deep border border-dashed border-hair rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-card text-ink-3 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-display text-[15px] font-semibold tracking-tight">
                Run your next tryout in Rostr
              </div>
              <div className="text-[13px] text-ink-3 mt-1 leading-relaxed">
                The real version is fully interactive: invite evaluators by
                email, QR check-in for attendees, live leaderboard while
                stations score, drag verdict pills to set placements. Every
                score is verified and stamped with the evaluator&apos;s name.
              </div>
            </div>
            <Link
              href="/signup"
              className="px-4 py-2 bg-red text-white rounded-sm text-[13px] font-semibold hover:bg-red/90 whitespace-nowrap"
            >
              Sign up to run yours →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function VerdictTile({
  tone,
  label,
  count,
  hint,
}: {
  tone: "grass" | "sky" | "amber" | "red";
  label: string;
  count: number;
  hint: string;
}) {
  const toneClass = {
    grass: "bg-grass-dim text-grass",
    sky: "bg-sky-soft text-sky",
    amber: "bg-amber-soft text-amber",
    red: "bg-red-soft text-red",
  }[tone];
  return (
    <div className="bg-card border border-hair rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded-xs", toneClass)}>
          {label === "Cut" ? (
            <XCircle className="w-3 h-3" />
          ) : label === "Bubble" ? (
            <AlertCircle className="w-3 h-3" />
          ) : label === "Varsity" ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <Clock className="w-3 h-3" />
          )}
        </span>
        <div className="type-label">{label}</div>
      </div>
      <div className="font-mono text-[26px] font-semibold tracking-tight leading-none">
        {count}
      </div>
      <div className="text-[11px] text-ink-3 mt-1.5">{hint}</div>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-7 bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2 flex-wrap">
        <span className="text-ink-3">{icon}</span>
        <h3 className="font-display text-[15px] font-semibold tracking-tight">{title}</h3>
        {subtitle && <span className="text-[11.5px] text-ink-3 ml-2">{subtitle}</span>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function AttendeeRow({
  attendee,
}: {
  attendee: {
    playerId: string;
    name: string;
    jersey: number;
    positions: string[];
    classYearShort: string;
    verdict: "Varsity" | "JV" | "Bubble" | "Cut";
    scores: Record<string, { value: number; rank: number }>;
  };
}) {
  const verdictTone = {
    Varsity: "bg-grass-dim text-grass",
    JV: "bg-sky-soft text-sky",
    Bubble: "bg-amber-soft text-amber",
    Cut: "bg-red-soft text-red",
  }[attendee.verdict];

  return (
    <tr className="border-b border-hair-2 last:border-b-0 hover:bg-paper transition-colors">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-ink-3 w-7 shrink-0">
            #{attendee.jersey}
          </span>
          <div className="min-w-0">
            <div className="font-semibold truncate">{attendee.name}</div>
            <div className="text-[10px] text-ink-3 font-mono">
              {attendee.positions.join("/")} · {attendee.classYearShort}
            </div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2.5">
        <span
          className={cn(
            "inline-flex px-1.5 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-[0.06em]",
            verdictTone,
          )}
        >
          {attendee.verdict}
        </span>
      </td>
      {STATIONS.map((stn) => {
        const s = attendee.scores[stn.code];
        if (!s) {
          return (
            <td key={stn.code} className="px-2 py-2.5 text-right font-mono text-ink-3">
              —
            </td>
          );
        }
        // Top-3 ranks get a subtle highlight.
        const isTop3 = s.rank <= 3;
        return (
          <td
            key={stn.code}
            className={cn(
              "px-2 py-2.5 text-right font-mono",
              isTop3 && "text-red font-semibold",
            )}
          >
            {s.value}
            {isTop3 && (
              <span className="text-[9px] text-ink-3 ml-0.5 font-sans">
                #{s.rank}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
