"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Filter,
  Trophy,
  ChevronRight,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  RankingsResponse,
  ScoringMode,
  RankedPlayerEntry,
  MetricScore,
} from "@/lib/services/rankings";

/**
 * /app/rankings — client view.
 *
 * Filter state lives in the URL. Every interaction calls
 * `applyFilters` which serializes the next state into a query
 * string and pushes it; the server component re-runs the engine
 * with the new filters and we re-render.
 *
 * Layout: mobile-first stack of player cards. Desktop≥md gets a
 * compact table side by side with the cards (≥lg). The metric
 * detail row inside each card always renders inline so coaches can
 * scan without an extra tap.
 */

interface DraftFilters {
  scoringMode: ScoringMode;
  tryoutId: string | null;
  metricShortCodes: string[];
  gradYears: string[];
  positions: string[];
  teamLevels: string[];
}

const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "OF", "DH"];

export function RankingsView({
  response,
  initialFilters,
  programName,
}: {
  response: RankingsResponse;
  initialFilters: DraftFilters;
  programName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DraftFilters>(initialFilters);

  function applyFilters(next: DraftFilters) {
    setDraft(next);
    const params = new URLSearchParams();
    if (next.scoringMode === "benchmark") params.set("mode", "benchmark");
    if (next.tryoutId) params.set("tryout", next.tryoutId);
    if (next.metricShortCodes.length > 0)
      params.set("metrics", next.metricShortCodes.join(","));
    if (next.gradYears.length > 0)
      params.set("class", next.gradYears.join(","));
    if (next.positions.length > 0) params.set("pos", next.positions.join(","));
    if (next.teamLevels.length > 0)
      params.set("level", next.teamLevels.join(","));
    const qs = params.toString();
    startTransition(() => {
      router.push(`/app/rankings${qs ? `?${qs}` : ""}`);
    });
  }

  function setScoringMode(mode: ScoringMode) {
    applyFilters({ ...draft, scoringMode: mode });
  }

  function toggleSet<T extends string>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
  }

  // Build class-year options from the players we got back, so the
  // chips reflect actual roster shape rather than guessing.
  const classYearOptions = useMemo(() => {
    const set = new Set<number>();
    for (const p of response.players) {
      if (p.classYear != null) set.add(p.classYear);
    }
    for (const p of response.unrankedPlayers) {
      if (p.classYear != null) set.add(p.classYear);
    }
    return Array.from(set).sort();
  }, [response]);

  const metricsForChips = response.metricsInScope;

  const hasAnyFilter =
    draft.tryoutId != null ||
    draft.metricShortCodes.length > 0 ||
    draft.gradYears.length > 0 ||
    draft.positions.length > 0 ||
    draft.teamLevels.length > 0;

  function clearAll() {
    applyFilters({
      scoringMode: draft.scoringMode,
      tryoutId: null,
      metricShortCodes: [],
      gradYears: [],
      positions: [],
      teamLevels: [],
    });
  }

  return (
    <div className="min-h-[100dvh] bg-paper">
      <header className="sticky top-0 z-topbar bg-paper/85 backdrop-blur-xl backdrop-saturate-150 border-b border-hair">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2">
            <Link
              href="/app"
              className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-hair-2 active:scale-[0.92] transition"
              aria-label="Back to Hub"
            >
              <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2.25} />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-[18px] font-bold tracking-tight">
                Rankings
              </h1>
              <p className="text-[11.5px] text-ink-3 mt-0.5 truncate">
                {programName} · {response.players.length} ranked
                {response.unrankedPlayers.length > 0 && (
                  <> · {response.unrankedPlayers.length} unranked</>
                )}
              </p>
            </div>
          </div>

          {/* Scoring mode toggle */}
          <div className="mt-3 inline-flex p-0.5 rounded-full bg-paper-deep border border-hair">
            <ModeButton
              active={draft.scoringMode === "percentile"}
              onClick={() => setScoringMode("percentile")}
              disabled={pending}
            >
              Program Percentile
            </ModeButton>
            <ModeButton
              active={draft.scoringMode === "benchmark"}
              onClick={() => setScoringMode("benchmark")}
              disabled={pending}
            >
              Benchmark Grade
            </ModeButton>
          </div>

          {/* Filters strip */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 sm:-mx-6 px-4 sm:px-6 scrollbar-none">
            <span className="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-3 mr-1">
              <Filter className="w-3 h-3" />
              Filter
            </span>

            {/* Class year chips */}
            {classYearOptions.map((year) => {
              const active = draft.gradYears.includes(String(year));
              return (
                <Pill
                  key={year}
                  label={`'${String(year).slice(2)}`}
                  active={active}
                  disabled={pending}
                  onClick={() =>
                    applyFilters({
                      ...draft,
                      gradYears: toggleSet(draft.gradYears, String(year)),
                    })
                  }
                />
              );
            })}

            {/* Position chips */}
            {POSITIONS.map((pos) => {
              const active = draft.positions.includes(pos);
              return (
                <Pill
                  key={pos}
                  label={pos}
                  active={active}
                  disabled={pending}
                  onClick={() =>
                    applyFilters({
                      ...draft,
                      positions: toggleSet(draft.positions, pos),
                    })
                  }
                />
              );
            })}

            {/* Team level chips */}
            {response.availableLevels.map((level) => {
              const active = draft.teamLevels.includes(level);
              return (
                <Pill
                  key={level}
                  label={level}
                  active={active}
                  disabled={pending}
                  onClick={() =>
                    applyFilters({
                      ...draft,
                      teamLevels: toggleSet(draft.teamLevels, level),
                    })
                  }
                />
              );
            })}

            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAll}
                disabled={pending}
                className="shrink-0 ml-1 rounded-full text-[10.5px] font-medium px-2 py-1 text-ink-3 hover:text-red hover:bg-red-soft transition-colors disabled:opacity-60"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Tryout / metric selectors — secondary row, only show when
              tryouts or metrics exist to avoid clutter. */}
          {(response.availableTryouts.length > 0 || metricsForChips.length > 0) && (
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 sm:-mx-6 px-4 sm:px-6 scrollbar-none">
              {response.availableTryouts.length > 0 && (
                <select
                  value={draft.tryoutId ?? ""}
                  onChange={(e) =>
                    applyFilters({
                      ...draft,
                      tryoutId: e.target.value || null,
                    })
                  }
                  disabled={pending}
                  className="shrink-0 h-7 rounded-full border border-hair bg-card text-[11.5px] font-medium px-2.5"
                >
                  <option value="">All tryouts</option>
                  {response.availableTryouts.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              {metricsForChips.length > 0 && (
                <span className="shrink-0 text-[10.5px] font-mono uppercase tracking-[0.06em] text-ink-3 ml-2">
                  Metrics
                </span>
              )}
              {metricsForChips.map((m) => {
                const active = draft.metricShortCodes.includes(m.shortCode);
                return (
                  <Pill
                    key={m.shortCode}
                    label={m.shortCode}
                    active={active}
                    disabled={pending || (draft.scoringMode === "benchmark" && !m.hasBenchmark)}
                    onClick={() =>
                      applyFilters({
                        ...draft,
                        metricShortCodes: toggleSet(
                          draft.metricShortCodes,
                          m.shortCode,
                        ),
                      })
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* Result region */}
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-5 pb-24">
        {response.players.length === 0 ? (
          <EmptyState
            hasFilters={hasAnyFilter}
            unrankedCount={response.unrankedPlayers.length}
            onClear={clearAll}
          />
        ) : (
          <>
            <div className="text-[10.5px] font-mono uppercase tracking-[0.06em] text-ink-3 mb-2">
              {pending ? "Recomputing…" : "Sorted by overall score"}
            </div>
            <ul className="space-y-2">
              {response.players.map((p) => (
                <PlayerRankRow key={p.playerId} entry={p} />
              ))}
            </ul>
          </>
        )}

        {response.unrankedPlayers.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-2 flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              No scored metrics yet · {response.unrankedPlayers.length}
            </h2>
            <ul className="space-y-1">
              {response.unrankedPlayers.map((p) => (
                <li
                  key={p.playerId}
                  className="bg-card border border-dashed border-hair rounded-xl px-3 py-2 flex items-center gap-2 text-[12.5px]"
                >
                  <span className="font-display font-semibold tracking-tight truncate flex-1">
                    {p.firstName} {p.lastName}
                  </span>
                  {p.classYear && (
                    <span className="font-mono text-[10.5px] text-ink-3">
                      &apos;{String(p.classYear).slice(2)}
                    </span>
                  )}
                  {p.positions.length > 0 && (
                    <span className="text-[11px] text-ink-3 truncate max-w-[80px]">
                      {p.positions.join("/")}
                    </span>
                  )}
                  {p.teamLevel && (
                    <span className="text-[11px] text-ink-2 px-1.5 py-0.5 rounded-full bg-paper-deep">
                      {p.teamLevel}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────

function ModeButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3 py-1 text-[11.5px] font-bold tracking-tight transition-all",
        active
          ? "bg-ink text-paper shadow-[0_2px_6px_-2px_rgba(0,0,0,0.3)]"
          : "text-ink-2 hover:text-ink",
        "disabled:opacity-60",
      )}
    >
      {children}
    </button>
  );
}

function Pill({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "shrink-0 rounded-full font-bold tracking-tight px-2 py-1 text-[11px] border",
        "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "active:scale-[0.96] disabled:opacity-50",
        active
          ? "bg-ink text-paper border-ink"
          : "bg-card text-ink-2 border-hair hover:border-ink-3",
      )}
    >
      {label}
    </button>
  );
}

/**
 * One player's row. Shows rank + name + overall score on the left,
 * and a horizontal scrollable strip of metric chips below. Tap any
 * row → /p/[handle] doesn't apply (no slug here, this is the coach
 * surface) — instead links to a future per-player rankings detail
 * once we add it. For v1 the row stays informational.
 */
function PlayerRankRow({ entry }: { entry: RankedPlayerEntry }) {
  const score = entry.overallScore != null ? entry.overallScore : "—";
  const tone = entry.overallScore != null
    ? scoreToneClass(entry.overallScore)
    : "bg-paper-deep text-ink-3 border-hair";
  return (
    <li className="bg-card border border-hair rounded-xl p-3 sm:p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-display font-bold text-[15px] tabular-nums",
            "bg-paper-deep text-ink-2 border border-hair",
          )}
          aria-label={`Rank ${entry.rank}`}
        >
          {entry.rank ?? "—"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-display text-[14.5px] font-semibold tracking-tight truncate">
              {entry.firstName} {entry.lastName}
            </div>
            {entry.classYear && (
              <Badge>&apos;{String(entry.classYear).slice(2)}</Badge>
            )}
            {entry.positions.length > 0 && (
              <Badge>{entry.positions.join("/")}</Badge>
            )}
            {entry.teamLevel && <Badge>{entry.teamLevel}</Badge>}
          </div>
          <div className="mt-0.5 text-[10.5px] text-ink-3">
            {entry.metricsIncluded} metric{entry.metricsIncluded === 1 ? "" : "s"} included
            {entry.missingMetrics.length > 0 && (
              <> · {entry.missingMetrics.length} missing</>
            )}
          </div>
        </div>
        <div
          className={cn(
            "shrink-0 inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.04em] px-2.5 py-1 text-[11px] border",
            tone,
          )}
          title="Overall score"
        >
          <Trophy className="w-3 h-3" strokeWidth={2.5} />
          {typeof score === "number" ? score.toFixed(1) : score}
        </div>
      </div>

      {entry.perMetric.length > 0 && (
        <ul className="mt-2 -mb-1 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {entry.perMetric.map((m) => (
            <MetricChip key={m.shortCode} metric={m} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-paper-deep border border-hair text-ink-2 px-1.5 py-0 text-[10px] font-bold uppercase tracking-[0.06em] shrink-0">
      {children}
    </span>
  );
}

function MetricChip({ metric }: { metric: MetricScore }) {
  const tone = scoreToneClass(metric.score);
  return (
    <li className="shrink-0">
      <span
        title={`${metric.displayName} — raw ${metric.rawValue}${metric.unit ? metric.unit : ""}${
          metric.rank ? ` · rank ${metric.rank}/${metric.rankOf}` : ""
        }`}
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-mono tabular-nums px-2 py-0.5 text-[10.5px] border",
          tone,
        )}
      >
        <span className="font-bold uppercase tracking-[0.06em] text-[9.5px]">
          {metric.shortCode}
        </span>
        <span className="font-bold">{metric.score.toFixed(0)}</span>
        <span className="text-ink-3">·</span>
        <span>
          {metric.rawValue}
          {metric.unit ? metric.unit : ""}
        </span>
      </span>
    </li>
  );
}

/**
 * Map a 0-100 score to a tonal pill class. Bands:
 *   ≥ 85 → grass (elite)
 *   ≥ 70 → sky (above average)
 *   ≥ 50 → amber (average)
 *   <  50 → muted (below)
 */
function scoreToneClass(score: number): string {
  if (score >= 85) {
    return "bg-grass-dim text-grass border-grass/20";
  }
  if (score >= 70) {
    return "bg-sky-soft text-sky border-sky/25";
  }
  if (score >= 50) {
    return "bg-amber-soft text-amber border-amber/25";
  }
  return "bg-paper-deep text-ink-3 border-hair";
}

function EmptyState({
  hasFilters,
  unrankedCount,
  onClear,
}: {
  hasFilters: boolean;
  unrankedCount: number;
  onClear: () => void;
}) {
  return (
    <div className="bg-card border border-dashed border-hair rounded-2xl p-10 text-center">
      <h3 className="font-display text-[16px] font-semibold tracking-tight">
        {hasFilters ? "No ranked players match" : "No tryout scores yet"}
      </h3>
      <p className="text-[12.5px] text-ink-3 mt-2 max-w-[420px] mx-auto leading-relaxed">
        {hasFilters ? (
          <>
            Try removing filters or switching scoring mode.{" "}
            {unrankedCount > 0 && (
              <>
                {unrankedCount} player{unrankedCount === 1 ? "" : "s"} on the
                roster don&apos;t have any scored metrics yet — they&apos;re
                listed below.
              </>
            )}
          </>
        ) : (
          <>
            Rankings appear here once players have scores recorded in a tryout.
            Run a tryout under{" "}
            <Link href="/app/tryouts" className="text-red hover:underline">
              Tryouts
            </Link>{" "}
            and the engine will pick them up automatically.
          </>
        )}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink hover:bg-paper-deep transition-colors"
        >
          Clear all filters
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
