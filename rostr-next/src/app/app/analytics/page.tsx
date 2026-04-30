"use client";

import { BarChart3 } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";

/**
 * /app/analytics — Season trends stub. Full charts come later.
 */
export default function AnalyticsPage() {
  return (
    <>
      {/* PHASE 5 — removed Notifications bell + Export + Share report
          comingSoon buttons. Hardcoded "Lincoln HS" breadcrumb removed. */}
      <TopBar breadcrumbs={[{ label: "Analytics" }]} actions={[]} />
      <div className="flex-1 overflow-auto px-4 sm:px-6 md:px-8 pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div>
            <h1 className="font-display text-[28px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
              Season analytics
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1">
              Team trends, player development, opponent breakdowns.
            </p>
          </div>
          {/* PHASE 2.3 — removed the fake "12-4 / .298 / 3.42 / +32"
              StatTiles and the two trend SVGs that drew imaginary lines.
              Real coaches were seeing those numbers and assuming they
              were their team's. The empty state below is honest. */}
          <div className="mt-10 p-8 bg-card border border-dashed border-hair rounded-lg text-center">
            <div className="w-14 h-14 rounded-xl bg-paper-deep text-ink-3 flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div className="font-display text-[17px] sm:text-[18px] font-semibold tracking-tight">
              Analytics dashboards arrive once you&apos;ve scored a few games.
            </div>
            <div className="text-[13px] text-ink-3 mt-2 max-w-[460px] mx-auto leading-relaxed">
              Team BA / ERA trends, player development cohorts, opponent
              breakdowns, and season-over-season comparisons are computed live
              from your Live scoring + tryout data — no separate import. Once
              you&apos;ve got 5+ scored games on the books, this page lights
              up.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
