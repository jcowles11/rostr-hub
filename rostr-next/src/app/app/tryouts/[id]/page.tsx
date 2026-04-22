"use client";

import { useState } from "react";
import {
  Settings,
  Users,
  BarChart3,
  CheckSquare,
  Bell,
  Filter,
  Download,
  Printer,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { comingSoon } from "@/lib/coming-soon";

/**
 * /app/tryouts/[id] — Live rankings view.
 * Pixel target: handoff/designs/05_Tryouts.html.
 * Spec: handoff/SCREENS.md §5.
 *
 * Tabs: Setup / Players / Live rankings (active) / Decide.
 * Station coaches score on phones; this laptop view is the live leaderboard.
 */
export default function TryoutPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Lincoln HS" },
          { label: "Spring tryout 2026" },
          { label: "Day 2 of 3" },
        ]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" />, onClick: () => comingSoon("Notifications") },
          { kind: "ghost", label: "Settings", onClick: () => comingSoon("Tryout settings", "Station config + cutoff + attendee list — next sprint.") },
          { kind: "ghost", label: "Add player", onClick: () => comingSoon("Add tryout attendee", "Walk-up registration — next sprint.") },
          { kind: "primary", label: "End tryout", onClick: () => comingSoon("End tryout", "Locks scoring + routes you to the Decide tab.") },
        ]}
      />
      <ViewTabs />
      <div className="flex-1 overflow-auto px-8 pt-6 pb-12">
        <div className="max-w-layout-app mx-auto">
          <PageHead />
          <StatStrip />
          <div className="grid grid-cols-[1fr_360px] gap-5 mt-5">
            <div className="flex flex-col gap-5">
              <StationsPanel />
              <RankingTable />
            </div>
            <div className="flex flex-col gap-5">
              <CutoffPanel />
              <ActivityPanel />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── View tabs ────────────────────────────────────────────────

function ViewTabs() {
  const tabs = [
    { icon: <Settings className="w-[15px] h-[15px]" />, label: "Setup" },
    { icon: <Users className="w-[15px] h-[15px]" />, label: "Players", count: 52 },
    { icon: <BarChart3 className="w-[15px] h-[15px]" />, label: "Live rankings", count: 47, active: true },
    { icon: <CheckSquare className="w-[15px] h-[15px]" />, label: "Decide", count: "0 / 52" },
  ];
  return (
    <div className="px-8 pt-4 bg-card border-b border-hair flex gap-0.5 items-end sticky top-14 z-sticky">
      {tabs.map((t) => (
        <button
          key={t.label}
          onClick={() => {
            if (!t.active) comingSoon(`${t.label} tab`, "Tab content wires up as each section's data model lands.");
          }}
          className={cn(
            "px-[18px] py-2.5 -mb-px text-[13px] font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap",
            t.active ? "text-ink border-red" : "text-ink-3 border-transparent hover:text-ink",
          )}
        >
          {t.icon}
          {t.label}
          {t.count != null && (
            <span
              className={cn(
                "font-mono text-[10.5px] px-1.5 py-0.5 rounded-[4px] font-semibold",
                t.active ? "bg-red text-white" : "bg-paper-deep text-ink-2",
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
      <div className="flex-1" />
      <div className="mb-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-soft text-red rounded-full text-[11px] font-bold uppercase tracking-[0.06em]">
        <span className="w-2 h-2 rounded-full bg-red animate-pulse-live" />
        Live · 3 coaches scoring
      </div>
    </div>
  );
}

// ── Page head ────────────────────────────────────────────────

function PageHead() {
  return (
    <div className="flex justify-between items-end mb-6">
      <div>
        <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
          Live rankings
        </h1>
        <div className="text-[13.5px] text-ink-3 mt-1">
          Updated the moment a score is saved. Sort, filter, or tap any player to see
          full detail.
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="md" onClick={() => comingSoon("Filter rankings", "Position, class, station-filter — next sprint.")}>
          <Filter className="w-[15px] h-[15px]" /> Filter
        </Button>
        <Button variant="secondary" size="md" onClick={() => comingSoon("Export", "CSV of full rankings + verdicts — next sprint.")}>
          <Download className="w-[15px] h-[15px]" /> Export
        </Button>
        <Button variant="primary" size="md" onClick={() => toast.success("Tryout cards printed", { description: "Station scoring cards queued for the coach printer." })}>
          <Printer className="w-[15px] h-[15px]" /> Print cards
        </Button>
      </div>
    </div>
  );
}

// ── Stat strip ──────────────────────────────────────────────

function StatStrip() {
  const stats = [
    { l: "Players", v: "52", d: "registered" },
    { l: "Scored", v: "47", d: "90% complete", dColor: "text-grass" },
    { l: "Stations live", v: "4", vSub: "/ 5", d: "BP paused" },
    { l: "Top 60yd", v: "6.74", vSub: "s", d: "Peña, C · #9", mono: true },
    { l: "Top exit velo", v: "94", vSub: "mph", d: "Johnson, M · #21", mono: true },
  ];
  return (
    <div className="grid grid-cols-5 gap-2.5">
      {stats.map((s, i) => (
        <div key={i} className="bg-card border border-hair rounded-md p-4">
          <div className="type-label">{s.l}</div>
          <div
            className={cn(
              "mt-1.5 text-[26px] font-semibold leading-none",
              s.mono ? "font-mono tracking-[-0.02em]" : "font-mono",
            )}
          >
            {s.v}
            {s.vSub && (
              <span className="text-[14px] text-ink-3 font-normal ml-0.5">{s.vSub}</span>
            )}
          </div>
          <div className={cn("text-[11px] font-semibold mt-1", s.dColor ?? "text-ink-3")}>
            {s.d}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Stations ────────────────────────────────────────────────

function StationsPanel() {
  const stations = [
    { badge: "60", bg: "bg-red", name: "60-yard dash", coach: "Coach Park · Field A", progress: 47, total: 52, fill: "bg-red", live: true },
    { badge: "EV", bg: "bg-sky", name: "Exit velo", coach: "Coach Hendricks · Cage 2", progress: 41, total: 52, fill: "bg-sky", live: true },
    { badge: "F", bg: "bg-grass", name: "Fielding · IF", coach: "Coach Ruiz · Infield", progress: 28, total: 34, fill: "bg-grass", live: true },
    { badge: "P", bg: "bg-amber", name: "Pitching velo", coach: "Coach Vega · Bullpen", progress: 12, total: 18, fill: "bg-amber", live: true },
    { badge: "BP", bg: "bg-ink-4", name: "Batting practice", coach: "Paused · starts 4:30 PM", progress: 0, total: 52, fill: "bg-ink-4", live: false },
  ];
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-3">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Stations</h3>
        <div className="ml-auto flex gap-1.5">
          <button className="text-[11.5px] px-2.5 py-1 bg-paper text-ink font-semibold rounded-xs">
            Live
          </button>
          <button className="text-[11.5px] px-2.5 py-1 text-ink-3 hover:text-ink">
            Today&apos;s plan
          </button>
        </div>
      </div>
      <div className="p-[18px] grid grid-cols-5 gap-3.5">
        {stations.map((s, i) => (
          <div
            key={i}
            className={cn(
              "rounded-md p-3.5 border",
              s.live
                ? "bg-card border-red shadow-[0_0_0_3px_var(--red-soft)]"
                : "bg-paper border-hair-2 opacity-60",
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className={cn(
                  "w-6 h-6 rounded-xs flex items-center justify-center text-[10.5px] font-bold text-white",
                  s.bg,
                )}
              >
                {s.badge}
              </div>
              <h4 className="font-display text-[13.5px] font-semibold">{s.name}</h4>
            </div>
            <div className="font-mono text-[11px] text-ink-3 mb-2.5">{s.coach}</div>
            <div className="flex justify-between text-[10px] font-bold text-ink-3 uppercase tracking-[0.05em] mb-1">
              <span>PROGRESS</span>
              <span className="font-mono">
                {s.progress} / {s.total}
              </span>
            </div>
            <div className="h-1.5 bg-paper-deep rounded-full overflow-hidden">
              <div
                className={cn("h-full", s.fill)}
                style={{ width: `${Math.round((s.progress / s.total) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ranking table ──────────────────────────────────────────

type Verdict = "LOCK" | "KEEP · V" | "KEEP · JV" | "BUBBLE" | "CUT" | "UNDECIDED";

interface RankRow {
  rank: number;
  delta: string;
  deltaDir: "up" | "down" | "flat";
  player: { initials: string; color: "red" | "sky" | "grass" | "dirt" | "gold" | "amber" | "ink" | "ink2"; name: string; tag: string };
  pos: string;
  sixty: { v: string; level: "hot" | "ok" | "pending" | "cold" };
  ev: { v: string; level: "hot" | "ok" | "pending" | "cold" };
  field: { v: string; level: "hot" | "ok" | "pending" | "cold" };
  velo: { v: string; level: "hot" | "ok" | "pending" | "cold" };
  overall: string;
  overallLevel: "hot" | "ok" | "warn";
  verdict: Verdict;
}

const ROWS: RankRow[] = [
  { rank: 1, delta: "↑ 2", deltaDir: "up", player: { initials: "MJ", color: "ink", name: "Marcus Johnson", tag: "Sr · CF · R/R" }, pos: "CF",
    sixty: { v: "6.78", level: "hot" }, ev: { v: "94 mph", level: "hot" }, field: { v: "4.6 / 5", level: "ok" }, velo: { v: "—", level: "pending" },
    overall: "94.8", overallLevel: "hot", verdict: "LOCK" },
  { rank: 2, delta: "↑ 1", deltaDir: "up", player: { initials: "CP", color: "sky", name: "Carlos Peña", tag: "So · P/OF · L/L" }, pos: "P",
    sixty: { v: "6.74", level: "hot" }, ev: { v: "89 mph", level: "ok" }, field: { v: "4.2 / 5", level: "ok" }, velo: { v: "87 mph", level: "hot" },
    overall: "91.4", overallLevel: "hot", verdict: "KEEP · V" },
  { rank: 3, delta: "↑ 4", deltaDir: "up", player: { initials: "AR", color: "dirt", name: "Alex Riggs", tag: "Sr · P/1B · R/R" }, pos: "P",
    sixty: { v: "7.04", level: "ok" }, ev: { v: "88 mph", level: "ok" }, field: { v: "4.4 / 5", level: "ok" }, velo: { v: "87 mph", level: "hot" },
    overall: "89.2", overallLevel: "ok", verdict: "KEEP · V" },
  { rank: 4, delta: "—", deltaDir: "flat", player: { initials: "JK", color: "sky", name: "Jordan Kim", tag: "Jr · SS · R/R" }, pos: "SS",
    sixty: { v: "6.91", level: "hot" }, ev: { v: "86 mph", level: "ok" }, field: { v: "4.8 / 5", level: "hot" }, velo: { v: "—", level: "pending" },
    overall: "88.5", overallLevel: "ok", verdict: "KEEP · V" },
  { rank: 5, delta: "↓ 1", deltaDir: "down", player: { initials: "DB", color: "grass", name: "DeAndre Brooks", tag: "Jr · 2B/3B · R/R" }, pos: "2B",
    sixty: { v: "6.92", level: "hot" }, ev: { v: "84 mph", level: "ok" }, field: { v: "4.3 / 5", level: "ok" }, velo: { v: "—", level: "pending" },
    overall: "86.7", overallLevel: "ok", verdict: "KEEP · V" },
  { rank: 6, delta: "↑ 2", deltaDir: "up", player: { initials: "TM", color: "amber", name: "Tre Mbeki", tag: "So · C · R/R" }, pos: "C",
    sixty: { v: "7.18", level: "ok" }, ev: { v: "82 mph", level: "ok" }, field: { v: "4.0 / 5", level: "ok" }, velo: { v: "—", level: "pending" },
    overall: "83.4", overallLevel: "ok", verdict: "KEEP · V" },
  { rank: 7, delta: "↓ 2", deltaDir: "down", player: { initials: "NP", color: "red", name: "Noah Patel", tag: "Sr · RF · L/L" }, pos: "RF",
    sixty: { v: "7.05", level: "ok" }, ev: { v: "81 mph", level: "ok" }, field: { v: "3.9 / 5", level: "ok" }, velo: { v: "—", level: "pending" },
    overall: "82.1", overallLevel: "ok", verdict: "BUBBLE" },
];

const VARSITY_BUBBLE_AT = 7;

function RankingTable() {
  const [posFilter, setPosFilter] = useState("All positions");
  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-3">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Overall ranking</h3>
        <div className="ml-auto flex gap-1">
          {["All positions", "Pitchers", "Infield", "Outfield", "Catchers"].map((f) => (
            <button
              key={f}
              onClick={() => setPosFilter(f)}
              className={cn(
                "text-[11.5px] px-2.5 py-1 rounded-xs font-semibold transition-colors",
                posFilter === f ? "bg-paper text-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <table className="w-full border-collapse text-[13px]">
        <thead className="bg-paper border-b border-hair">
          <tr>
            <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[70px]">Rank</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Player</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[60px]">Pos</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">60yd</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">EV max</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Fielding</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Velo</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Overall</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <>
              <RankTableRow key={r.rank} row={r} />
              {r.rank === VARSITY_BUBBLE_AT - 1 && <BubbleRow key={`bubble-${r.rank}`} />}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BubbleRow() {
  return (
    <tr>
      <td colSpan={9} className="px-3 py-2 bg-amber-soft text-amber font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-center">
        Varsity bubble · 6 above · 2 on the line · 3 below
      </td>
    </tr>
  );
}

function RankTableRow({ row: r }: { row: RankRow }) {
  const rankColor =
    r.rank === 1 ? "text-gold" :
    r.rank === 2 ? "text-ink-3" :
    r.rank === 3 ? "text-dirt" : "text-ink";
  return (
    <tr className="border-b border-hair-2 last:border-b-0 hover:bg-paper cursor-pointer">
      <td className="px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <span className={cn("font-display text-[18px] font-bold tracking-[-0.02em] leading-none", rankColor)}>
            {String(r.rank).padStart(2, "0")}
          </span>
          <span
            className={cn(
              "font-mono text-[10px] font-semibold",
              r.deltaDir === "up" && "text-grass",
              r.deltaDir === "down" && "text-red",
              r.deltaDir === "flat" && "text-ink-3",
            )}
          >
            {r.delta}
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar size="md" color={r.player.color} initials={r.player.initials} />
          <div>
            <div className="font-semibold text-[13px]">{r.player.name}</div>
            <div className="font-mono text-[10.5px] text-ink-3">{r.player.tag}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 font-mono">{r.pos}</td>
      <td className="px-3 py-2.5 text-right"><ScoreCell {...r.sixty} /></td>
      <td className="px-3 py-2.5 text-right"><ScoreCell {...r.ev} /></td>
      <td className="px-3 py-2.5 text-right"><ScoreCell {...r.field} /></td>
      <td className="px-3 py-2.5 text-right"><ScoreCell {...r.velo} /></td>
      <td className="px-3 py-2.5 text-right">
        <span
          className={cn(
            "font-mono text-[15px] font-bold",
            r.overallLevel === "hot" && "text-red",
            r.overallLevel === "ok" && "text-ink",
            r.overallLevel === "warn" && "text-amber",
          )}
        >
          {r.overall}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <VerdictPill v={r.verdict} />
      </td>
    </tr>
  );
}

function ScoreCell({
  v,
  level,
}: {
  v: string;
  level: "hot" | "ok" | "pending" | "cold";
}) {
  return (
    <span
      className={cn(
        "inline-block font-mono text-[12.5px] font-semibold",
        level === "hot" && "text-red",
        level === "ok" && "text-ink",
        level === "pending" && "text-ink-4",
        level === "cold" && "text-ink-3",
      )}
    >
      {v}
    </span>
  );
}

function VerdictPill({ v }: { v: Verdict }) {
  const map: Record<Verdict, string> = {
    LOCK: "bg-grass-dim text-grass",
    "KEEP · V": "bg-grass-dim text-grass",
    "KEEP · JV": "bg-grass-dim text-grass",
    BUBBLE: "bg-amber-soft text-amber",
    CUT: "bg-red-soft text-red",
    UNDECIDED: "bg-paper-deep text-ink-3",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-xs text-[10.5px] font-bold tracking-[0.04em]",
        map[v],
      )}
    >
      {v}
    </span>
  );
}

// ── Side column ────────────────────────────────────────────

function CutoffPanel() {
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-[18px] py-3.5 border-b border-hair-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Roster cutoff</h3>
        <p className="text-[11.5px] text-ink-3 mt-0.5">
          Drag the line to adjust Varsity target. Verdicts auto-suggest.
        </p>
      </div>
      <div className="p-[18px]">
        <div className="flex justify-between items-baseline mb-1">
          <span className="type-label">Varsity target</span>
          <span className="font-mono text-[20px] font-semibold">18</span>
        </div>
        <div className="relative h-2.5 bg-paper-deep rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-red rounded-full"
            style={{ width: "65%" }}
          />
          <div
            className="absolute inset-y-0 bg-amber-soft"
            style={{ left: "65%", width: "10%" }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-ink-3 font-mono font-semibold mt-1.5">
          <span>0</span>
          <span>18</span>
          <span>28</span>
          <span>52</span>
        </div>
        <div className="mt-4 space-y-2 text-[12.5px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-grass" />
            <span className="text-ink-2 flex-1">Locks (6)</span>
            <span className="font-mono font-semibold">·01 — ·06</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber" />
            <span className="text-ink-2 flex-1">Bubble (4)</span>
            <span className="font-mono font-semibold">·07 — ·10</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red" />
            <span className="text-ink-2 flex-1">Cut risk (12)</span>
            <span className="font-mono font-semibold">·11 — ·22</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityPanel() {
  const activity = [
    { who: "Coach Park", did: "saved 60yd", who2: "Peña, C", time: "just now", color: "red" as const },
    { who: "Coach Hendricks", did: "saved EV", who2: "Johnson, M", time: "36s ago", color: "sky" as const },
    { who: "Coach Ruiz", did: "flagged", who2: "Brooks, D", time: "2m ago", color: "grass" as const, note: "attention: footwork" },
    { who: "Coach Vega", did: "logged velo", who2: "Riggs, A", time: "4m ago", color: "amber" as const },
    { who: "Coach Park", did: "saved 60yd", who2: "Kim, J", time: "6m ago", color: "red" as const },
  ];
  return (
    <div className="bg-card border border-hair rounded-lg">
      <div className="px-[18px] py-3.5 border-b border-hair-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Scoring activity</h3>
        <p className="text-[11.5px] text-ink-3 mt-0.5">Live feed from station coaches.</p>
      </div>
      <div>
        {activity.map((a, i) => (
          <div key={i} className="flex gap-2.5 px-[18px] py-3 border-b border-hair-2 last:border-b-0 items-start">
            <Avatar size="sm" color={a.color} initials={a.who.slice(0, 2).toUpperCase()} />
            <div className="flex-1 text-[12.5px]">
              <div>
                <b className="font-semibold">{a.who}</b>{" "}
                <span className="text-ink-3">{a.did}</span>{" "}
                <b className="font-semibold">{a.who2}</b>
              </div>
              {a.note && (
                <div className="text-[11px] text-amber font-semibold mt-0.5">{a.note}</div>
              )}
              <div className="font-mono text-[10.5px] text-ink-3 mt-0.5">{a.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
