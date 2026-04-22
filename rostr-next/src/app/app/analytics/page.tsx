"use client";

import { BarChart3, Bell } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { StatTile } from "@/components/molecules/stat-tile";
import { comingSoon } from "@/lib/coming-soon";

/**
 * /app/analytics — Season trends stub. Full charts come later.
 */
export default function AnalyticsPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "Lincoln HS" }, { label: "Analytics" }]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" />, onClick: () => comingSoon("Notifications") },
          { kind: "ghost", label: "Export", onClick: () => comingSoon("Export analytics", "PDF + CSV season report — next sprint.") },
          { kind: "primary", label: "Share report", onClick: () => comingSoon("Share report", "Public read-only link for parents/AD — next sprint.") },
        ]}
      />
      <div className="flex-1 overflow-auto px-8 pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div>
            <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
              Season analytics
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1">
              Team trends, player development, opponent breakdowns.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2.5 mt-7">
            <StatTile label="Record" value="12–4" delta="+3 vs last season" deltaDirection="up" />
            <StatTile label="Team BA" value=".298" delta="+.014 last 5" deltaDirection="up" />
            <StatTile label="ERA" value="3.42" delta="+0.21 last 5" deltaDirection="down" />
            <StatTile label="Run diff" value="+32" delta="+18 vs last season" deltaDirection="up" />
          </div>
          <div className="grid grid-cols-2 gap-5 mt-7">
            <div className="bg-card border border-hair rounded-lg p-6">
              <div className="flex items-baseline gap-2 mb-5">
                <div className="type-label">Team BA · trend</div>
                <div className="ml-auto font-mono text-[10px] text-ink-3 font-semibold">LAST 15 GAMES</div>
              </div>
              <svg viewBox="0 0 360 100" className="w-full h-[140px]">
                {[20, 40, 60, 80].map((y) => (
                  <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="var(--hair-2)" />
                ))}
                <polyline
                  points="10,80 30,70 60,65 90,60 120,55 150,50 180,48 210,42 240,38 270,30 300,25 330,20"
                  fill="none"
                  stroke="var(--red)"
                  strokeWidth="2.5"
                />
                <polygon
                  points="10,80 30,70 60,65 90,60 120,55 150,50 180,48 210,42 240,38 270,30 300,25 330,20 330,100 10,100"
                  fill="rgba(200,58,58,.08)"
                />
              </svg>
              <div className="flex justify-between text-[10px] text-ink-4 font-mono mt-1.5">
                <span>.254</span>
                <span>.298</span>
              </div>
            </div>
            <div className="bg-card border border-hair rounded-lg p-6">
              <div className="flex items-baseline gap-2 mb-5">
                <div className="type-label">Pitching · ERA trend</div>
                <div className="ml-auto font-mono text-[10px] text-ink-3 font-semibold">LAST 15 GAMES</div>
              </div>
              <svg viewBox="0 0 360 100" className="w-full h-[140px]">
                {[20, 40, 60, 80].map((y) => (
                  <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="var(--hair-2)" />
                ))}
                <polyline
                  points="10,30 30,32 60,28 90,32 120,36 150,42 180,40 210,48 240,52 270,58 300,62 330,65"
                  fill="none"
                  stroke="var(--sky)"
                  strokeWidth="2.5"
                />
                <polygon
                  points="10,30 30,32 60,28 90,32 120,36 150,42 180,40 210,48 240,52 270,58 300,62 330,65 330,100 10,100"
                  fill="rgba(58,110,168,.08)"
                />
              </svg>
              <div className="flex justify-between text-[10px] text-ink-4 font-mono mt-1.5">
                <span>3.12</span>
                <span>3.42</span>
              </div>
            </div>
          </div>
          <div className="mt-10 p-7 bg-card border border-hair rounded-lg text-center">
            <div className="w-14 h-14 rounded-xl bg-paper-deep text-ink-3 flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div className="font-display text-[18px] font-semibold tracking-tight">
              Player development cohorts, opponent breakdown, and season-over-season
              dashboards coming next.
            </div>
            <div className="text-[13px] text-ink-3 mt-2 max-w-[460px] mx-auto">
              The data exists — we just need to graph it. Next sprint.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
