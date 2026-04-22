"use client";

import Link from "next/link";
import { Trophy, Plus, Bell, ChevronRight, Users, CheckCircle2 } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { cn } from "@/lib/utils";
import { comingSoon } from "@/lib/coming-soon";

/**
 * /app/tryouts — Tryouts list.
 * Links into /app/tryouts/[id] for the live rankings view.
 */
const TRYOUTS = [
  { id: "spring-2026", name: "Spring tryout 2026", status: "live", when: "Apr 20–22 · Day 2 of 3", roster: "52 players · 47 scored · 0 decided", badge: "LIVE" },
  { id: "fall-2025", name: "Fall ball placement", status: "complete", when: "Sep 8–10, 2025", roster: "28 players · 20 kept · 8 cut", badge: "COMPLETE" },
  { id: "spring-2025", name: "Spring tryout 2025", status: "complete", when: "Feb 24–26, 2025", roster: "48 players · 22 kept · 18 cut · 8 JV", badge: "COMPLETE" },
];

export default function TryoutsListPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "Lincoln HS" }, { label: "Tryouts" }]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" />, onClick: () => comingSoon("Notifications") },
          { kind: "primary", label: "New tryout", icon: <Plus className="w-[15px] h-[15px]" />, onClick: () => comingSoon("New tryout", "Create form: attendees, stations, target level — next sprint.") },
        ]}
      />
      <div className="flex-1 overflow-auto px-8 pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div>
            <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
              Tryouts
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1">
              Seasonal tryouts with station-based scoring and live rankings.
            </p>
          </div>

          <div className="mt-7 space-y-3">
            {TRYOUTS.map((t) => (
              <Link
                key={t.id}
                href={`/app/tryouts/${t.id}`}
                className="flex items-center gap-4 p-5 bg-card border border-hair rounded-lg hover:border-ink transition-colors"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-md flex items-center justify-center shrink-0",
                    t.status === "live" ? "bg-red text-white" : "bg-paper-deep text-ink-2",
                  )}
                >
                  {t.status === "live" ? (
                    <Trophy className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-display text-[18px] font-semibold tracking-tight">
                      {t.name}
                    </div>
                    {t.status === "live" && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-soft text-red rounded-xs text-[9.5px] font-bold uppercase tracking-[0.06em]">
                        <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse-live" />
                        Live now
                      </span>
                    )}
                  </div>
                  <div className="text-[12.5px] text-ink-3 mt-0.5 font-mono">{t.when}</div>
                  <div className="text-[12px] text-ink-2 mt-1 flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    {t.roster}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-ink-3" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
