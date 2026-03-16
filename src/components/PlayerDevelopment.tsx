/**
 * PlayerDevelopment — Metric trend visualization for a single player.
 *
 * Shows per-metric trends across evaluation sessions with:
 * - Mini sparkline (SVG) showing values over time
 * - Directional indicator (↑ improving, ↓ regressing, → stable)
 * - First → latest value comparison with delta
 * - Handles incomplete data honestly (shows "N sessions" count)
 *
 * Receives all data as props — no data fetching.
 * Sport-agnostic: uses metric_type to determine direction (timed = lower is better).
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────

interface Evaluation {
  id: string;
  value: number;
  metric_id: string;
  coach_id: string;
  created_at: string;
  session_id: string | null;
}

interface SessionInfo {
  id: string;
  name: string;
  session_date: string;
}

interface Metric {
  id: string;
  name: string;
  unit: string;
  metric_type: string;
  aggregation: string;
}

export interface PlayerDevelopmentProps {
  evals: Evaluation[];
  metrics: Metric[];
  sessionInfos: SessionInfo[];
}

// ── Helpers ────────────────────────────────────────────────────────

interface MetricTrend {
  metric: Metric;
  /** Session-aggregated data points, chronologically ordered. */
  points: { sessionName: string; sessionDate: string; value: number }[];
  /** First data point value. */
  first: number;
  /** Latest data point value. */
  latest: number;
  /** Absolute change. */
  delta: number;
  /** "improving" | "regressing" | "stable" */
  direction: "improving" | "regressing" | "stable";
}

function computeTrends(
  evals: Evaluation[],
  metrics: Metric[],
  sessionInfos: SessionInfo[]
): MetricTrend[] {
  const sessionMap = new Map(sessionInfos.map((s) => [s.id, s]));

  // Build chronologically ordered session list
  const orderedSessions = [...sessionInfos].sort(
    (a, b) => a.session_date.localeCompare(b.session_date)
  );

  const trends: MetricTrend[] = [];

  for (const metric of metrics) {
    const metricEvals = evals.filter((e) => e.metric_id === metric.id && e.session_id);

    // Group by session
    const bySession = new Map<string, number[]>();
    metricEvals.forEach((e) => {
      if (!e.session_id) return;
      const arr = bySession.get(e.session_id) || [];
      arr.push(e.value);
      bySession.set(e.session_id, arr);
    });

    // Need at least 2 sessions to show a trend
    if (bySession.size < 2) continue;

    // Build data points in chronological order
    const points: MetricTrend["points"] = [];
    for (const session of orderedSessions) {
      const vals = bySession.get(session.id);
      if (!vals || vals.length === 0) continue;

      // Aggregate per session: use best for timed (min), best for measured/rated (max), or average
      let value: number;
      if (metric.aggregation === "average") {
        value = vals.reduce((a, b) => a + b, 0) / vals.length;
      } else if (metric.metric_type === "timed") {
        value = Math.min(...vals);
      } else {
        value = Math.max(...vals);
      }

      points.push({
        sessionName: session.name,
        sessionDate: session.session_date,
        value,
      });
    }

    if (points.length < 2) continue;

    const first = points[0].value;
    const latest = points[points.length - 1].value;
    const delta = latest - first;
    const threshold = Math.abs(first) * 0.02; // 2% change threshold for "stable"

    const lowerIsBetter = metric.metric_type === "timed";

    let direction: MetricTrend["direction"];
    if (Math.abs(delta) <= threshold) {
      direction = "stable";
    } else if (lowerIsBetter) {
      direction = delta < 0 ? "improving" : "regressing";
    } else {
      direction = delta > 0 ? "improving" : "regressing";
    }

    trends.push({ metric, points, first, latest, delta, direction });
  }

  return trends;
}

// ── Sparkline SVG ──────────────────────────────────────────────────

function Sparkline({
  points,
  direction,
  width = 80,
  height = 28,
}: {
  points: number[];
  direction: MetricTrend["direction"];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const padding = 2;

  const coords = points.map((v, i) => ({
    x: padding + (i / (points.length - 1)) * (width - padding * 2),
    y: padding + (1 - (v - min) / range) * (height - padding * 2),
  }));

  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

  const strokeColor =
    direction === "improving"
      ? "#22c55e"
      : direction === "regressing"
        ? "#ef4444"
        : "#94a3b8";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
    >
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dots on first and last */}
      <circle cx={coords[0].x} cy={coords[0].y} r={2.5} fill={strokeColor} opacity={0.5} />
      <circle
        cx={coords[coords.length - 1].x}
        cy={coords[coords.length - 1].y}
        r={2.5}
        fill={strokeColor}
      />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────

export default function PlayerDevelopment({
  evals,
  metrics,
  sessionInfos,
}: PlayerDevelopmentProps) {
  const trends = useMemo(
    () => computeTrends(evals, metrics, sessionInfos),
    [evals, metrics, sessionInfos]
  );

  if (trends.length === 0) return null;

  const improvingCount = trends.filter((t) => t.direction === "improving").length;
  const regressingCount = trends.filter((t) => t.direction === "regressing").length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3 text-xs">
        <span className="font-semibold text-muted-foreground">
          {trends.length} metric{trends.length !== 1 ? "s" : ""} tracked
        </span>
        {improvingCount > 0 && (
          <span className="flex items-center gap-1 text-green-600 font-semibold">
            <TrendingUp className="h-3 w-3" />
            {improvingCount} improving
          </span>
        )}
        {regressingCount > 0 && (
          <span className="flex items-center gap-1 text-red-500 font-semibold">
            <TrendingDown className="h-3 w-3" />
            {regressingCount} regressing
          </span>
        )}
      </div>

      {/* Trend rows */}
      {trends.map((t) => {
        const DirIcon =
          t.direction === "improving"
            ? TrendingUp
            : t.direction === "regressing"
              ? TrendingDown
              : Minus;

        const dirColor =
          t.direction === "improving"
            ? "text-green-600"
            : t.direction === "regressing"
              ? "text-red-500"
              : "text-muted-foreground";

        const absDelta = Math.abs(t.delta);
        const sign =
          t.direction === "stable"
            ? ""
            : t.delta > 0
              ? "+"
              : "";

        return (
          <div
            key={t.metric.id}
            className="rounded-xl bg-muted/40 p-3 flex items-center gap-3"
          >
            {/* Icon + name */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{t.metric.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {t.points.length} sessions · {t.points[0].sessionName} → {t.points[t.points.length - 1].sessionName}
              </p>
            </div>

            {/* Sparkline */}
            <Sparkline
              points={t.points.map((p) => p.value)}
              direction={t.direction}
            />

            {/* Values + delta */}
            <div className="text-right shrink-0 min-w-[4.5rem]">
              <p className="text-sm font-extrabold tabular-nums">
                {t.latest.toFixed(1)}
                <span className="text-[10px] font-medium text-muted-foreground ml-0.5">
                  {t.metric.unit}
                </span>
              </p>
              <div className={cn("flex items-center justify-end gap-0.5 text-[10px] font-semibold", dirColor)}>
                <DirIcon className="h-3 w-3" />
                <span className="tabular-nums">
                  {sign}{t.delta.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
