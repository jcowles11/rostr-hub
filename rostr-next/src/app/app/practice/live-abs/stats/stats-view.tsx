"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Filter, TrendingUp, Activity, Trophy } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { cn } from "@/lib/utils";
import type {
  HitterStatsRow,
  PitcherStatsRow,
  StatsKindFilter,
} from "@/lib/services/live-abs";

/**
 * Live AB stats dashboard.
 *
 * Shows team-wide hitter + pitcher aggregates pulled from
 * practice_at_bats, joined through practice_sessions to support a
 * filter-pill split between Live ABs and Intrasquad. Combined view
 * is the default — coaches usually want to see who's hot regardless
 * of context — but they can drill in to either kind.
 */

const FILTER_OPTIONS: Array<{ key: StatsKindFilter; label: string; sub: string }> = [
  { key: "all", label: "All sessions", sub: "Live ABs + Intrasquad" },
  { key: "live_abs", label: "Live ABs only", sub: "Cage + bullpen at-bats" },
  { key: "intrasquad", label: "Intrasquad only", sub: "Internal scrimmages" },
];

export function LiveAbsStatsView({
  programName,
  initialFilter,
  hittersAll,
  hittersLiveAbs,
  hittersIntrasquad,
  pitchersAll,
  pitchersLiveAbs,
  pitchersIntrasquad,
}: {
  programName: string;
  initialFilter: StatsKindFilter;
  hittersAll: HitterStatsRow[];
  hittersLiveAbs: HitterStatsRow[];
  hittersIntrasquad: HitterStatsRow[];
  pitchersAll: PitcherStatsRow[];
  pitchersLiveAbs: PitcherStatsRow[];
  pitchersIntrasquad: PitcherStatsRow[];
}) {
  const [filter, setFilter] = useState<StatsKindFilter>(initialFilter);

  const hitters = useMemo(() => {
    if (filter === "live_abs") return hittersLiveAbs;
    if (filter === "intrasquad") return hittersIntrasquad;
    return hittersAll;
  }, [filter, hittersAll, hittersLiveAbs, hittersIntrasquad]);

  const pitchers = useMemo(() => {
    if (filter === "live_abs") return pitchersLiveAbs;
    if (filter === "intrasquad") return pitchersIntrasquad;
    return pitchersAll;
  }, [filter, pitchersAll, pitchersLiveAbs, pitchersIntrasquad]);

  const totalABs = hitters.reduce((s, h) => s + h.pa, 0);
  const totalK = hitters.reduce((s, h) => s + h.k, 0);
  const totalHardContact = hitters.reduce((s, h) => s + h.hardContact, 0);
  const totalEvCount = hitters.reduce(
    (s, h) => s + (h.avgEv != null ? Math.round((h.hardPct > 0 ? h.hardContact / h.hardPct : 0)) : 0),
    0,
  );

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: programName },
          { label: "Practice", href: "/app/practice" },
          { label: "Live ABs", href: "/app/practice/live-abs" },
          { label: "Stats" },
        ]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          {/* Header */}
          <div className="flex items-start gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-md bg-red-soft text-red flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-[28px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
                Live AB stats
              </h1>
              <p className="text-[13.5px] text-ink-3 mt-0.5">
                Team-wide hitter + pitcher numbers from cage work and
                intrasquad scrimmages. Use the filter to slice by
                session type.
              </p>
            </div>
            <Link
              href="/app/practice/live-abs"
              className="px-3 py-2 text-[12.5px] text-ink-3 hover:text-ink rounded-sm inline-flex items-center gap-1.5 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sessions
            </Link>
          </div>

          {/* Filter pills */}
          <div className="mt-7 flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-ink-3 shrink-0" />
            <div className="flex gap-1 flex-wrap">
              {FILTER_OPTIONS.map((opt) => {
                const active = filter === opt.key;
                const count =
                  opt.key === "all" ? hittersAll.length + pitchersAll.length :
                  opt.key === "live_abs" ? hittersLiveAbs.length + pitchersLiveAbs.length :
                  hittersIntrasquad.length + pitchersIntrasquad.length;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setFilter(opt.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-[12.5px] font-semibold transition-colors",
                      active
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card text-muted-foreground border-border hover:text-foreground",
                    )}
                  >
                    {opt.label}
                    <span className="ml-1.5 font-mono text-[10px] opacity-70">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="text-[11.5px] text-ink-3 ml-1">
              {FILTER_OPTIONS.find((o) => o.key === filter)?.sub}
            </span>
          </div>

          {/* Summary tiles */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryTile label="At-bats" value={String(totalABs)} sub={`${hitters.length} hitter${hitters.length === 1 ? "" : "s"}`} />
            <SummaryTile
              label="Team K%"
              value={totalABs > 0 ? `${Math.round((totalK / totalABs) * 100)}%` : "—"}
              sub={`${totalK} K`}
            />
            <SummaryTile
              label="Hard%"
              value={totalEvCount > 0 ? `${Math.round((totalHardContact / totalEvCount) * 100)}%` : "—"}
              sub={`EV ≥ 85`}
            />
            <SummaryTile
              label="Pitchers tracked"
              value={String(pitchers.length)}
              sub={`${pitchers.reduce((s, p) => s + p.bf, 0)} BF`}
            />
          </div>

          {/* Hitter leaderboard */}
          <Section icon={<Trophy className="w-3.5 h-3.5" />} title="Hitters" subtitle={`Sorted by AVG · ${hitters.length} player${hitters.length === 1 ? "" : "s"}`}>
            {hitters.length === 0 ? (
              <EmptyState filter={filter} kind="hitter" />
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3 border-b border-hair-2">
                    <th className="text-left px-4 py-3 w-8">#</th>
                    <th className="text-left px-3 py-3">Player</th>
                    <th className="text-right px-3 py-3 hidden sm:table-cell">PA</th>
                    <th className="text-right px-3 py-3">AB</th>
                    <th className="text-right px-3 py-3">H</th>
                    <th className="text-right px-3 py-3">AVG</th>
                    <th className="text-right px-3 py-3 hidden md:table-cell">HR</th>
                    <th className="text-right px-3 py-3 hidden md:table-cell">BB</th>
                    <th className="text-right px-3 py-3">K%</th>
                    <th className="text-right px-3 py-3 hidden lg:table-cell">Avg EV</th>
                    <th className="text-right px-3 py-3 hidden lg:table-cell">Max EV</th>
                  </tr>
                </thead>
                <tbody>
                  {hitters.map((h, i) => (
                    <tr key={h.playerId} className="border-b border-hair-2 last:border-b-0 hover:bg-paper transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[12px] font-semibold text-ink-3">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <PlayerCell row={h} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono hidden sm:table-cell">{h.pa}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{h.ab}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{h.h}</td>
                      <td className={cn("px-3 py-2.5 text-right font-mono", h.avg >= 0.3 && "text-red font-semibold")}>
                        {formatAvg(h.avg)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono hidden md:table-cell">{h.hr}</td>
                      <td className="px-3 py-2.5 text-right font-mono hidden md:table-cell">{h.bb}</td>
                      <td className={cn("px-3 py-2.5 text-right font-mono", h.kPct > 0.30 && "text-red")}>
                        {formatPct(h.kPct)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono hidden lg:table-cell">
                        {h.avgEv != null ? h.avgEv.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono hidden lg:table-cell">
                        {h.maxEv != null ? h.maxEv.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Pitcher leaderboard */}
          <Section icon={<Activity className="w-3.5 h-3.5" />} title="Pitchers" subtitle={`Sorted by opponent AVG · ${pitchers.length} player${pitchers.length === 1 ? "" : "s"}`}>
            {pitchers.length === 0 ? (
              <EmptyState filter={filter} kind="pitcher" />
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3 border-b border-hair-2">
                    <th className="text-left px-4 py-3 w-8">#</th>
                    <th className="text-left px-3 py-3">Player</th>
                    <th className="text-right px-3 py-3 hidden sm:table-cell">BF</th>
                    <th className="text-right px-3 py-3">H</th>
                    <th className="text-right px-3 py-3">K</th>
                    <th className="text-right px-3 py-3 hidden md:table-cell">BB</th>
                    <th className="text-right px-3 py-3">BAA</th>
                    <th className="text-right px-3 py-3">K%</th>
                    <th className="text-right px-3 py-3 hidden lg:table-cell">Avg velo</th>
                    <th className="text-right px-3 py-3 hidden lg:table-cell">Max velo</th>
                    <th className="text-right px-3 py-3 hidden lg:table-cell">Hard%</th>
                  </tr>
                </thead>
                <tbody>
                  {pitchers.map((p, i) => (
                    <tr key={p.playerId} className="border-b border-hair-2 last:border-b-0 hover:bg-paper transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[12px] font-semibold text-ink-3">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <PlayerCell row={p} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono hidden sm:table-cell">{p.bf}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{p.h}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{p.k}</td>
                      <td className="px-3 py-2.5 text-right font-mono hidden md:table-cell">{p.bb}</td>
                      <td className={cn("px-3 py-2.5 text-right font-mono", p.baa < 0.2 && "text-red font-semibold")}>
                        {formatAvg(p.baa)}
                      </td>
                      <td className={cn("px-3 py-2.5 text-right font-mono", p.kPct > 0.30 && "text-red font-semibold")}>
                        {formatPct(p.kPct)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono hidden lg:table-cell">
                        {p.avgPitchVelo != null ? p.avgPitchVelo.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono hidden lg:table-cell">
                        {p.maxPitchVelo != null ? p.maxPitchVelo.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono hidden lg:table-cell">
                        {formatPct(p.hardPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function PlayerCell({ row }: { row: HitterStatsRow | PitcherStatsRow }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-ink-3 w-8 shrink-0">
        {row.jerseyNumber !== null ? `#${row.jerseyNumber}` : ""}
      </span>
      <span className="font-semibold">
        {row.firstName} {row.lastName}
      </span>
      {row.positions[0] && (
        <span className="text-[10px] text-ink-3 ml-1">{row.positions[0]}</span>
      )}
      {row.classYearShort && (
        <span className="text-[10px] text-ink-3 font-mono">· {row.classYearShort}</span>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-hair rounded-lg p-4">
      <div className="type-label">{label}</div>
      <div className="font-mono text-[24px] font-semibold tracking-[-0.02em] mt-1.5 leading-none">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-ink-3 mt-1.5 font-mono">{sub}</div>
      )}
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

function EmptyState({ filter, kind }: { filter: StatsKindFilter; kind: "hitter" | "pitcher" }) {
  const ctx =
    filter === "live_abs" ? "live ABs" :
    filter === "intrasquad" ? "intrasquad scrimmages" :
    "live ABs or intrasquad scrimmages";
  return (
    <div className="px-5 py-10 text-center">
      <div className="font-display text-[15px] font-semibold tracking-tight">
        No {kind} data yet
      </div>
      <p className="text-[12.5px] text-ink-3 mt-1.5 max-w-[400px] mx-auto leading-relaxed">
        Score a few {ctx} from{" "}
        <Link href="/app/practice/live-abs" className="text-red font-semibold hover:underline">
          Live ABs
        </Link>{" "}
        and the leaderboard fills in automatically.
      </p>
    </div>
  );
}

function formatAvg(n: number): string {
  return n.toFixed(3).replace(/^0/, "");
}

function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
