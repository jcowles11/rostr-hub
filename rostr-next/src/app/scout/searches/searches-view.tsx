"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Bell, BellOff, ArrowRight } from "lucide-react";
import type { SavedSearch, SearchFilters } from "@/lib/services/recruiter";
import { formatAvg, formatERA, formatWHIP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteSavedSearchAction } from "../actions";

export function SavedSearchesView({
  searches,
  newMatchesById = {},
  currentTotalById = {},
}: {
  searches: SavedSearch[];
  newMatchesById?: Record<string, number>;
  currentTotalById?: Record<string, number>;
}) {
  const router = useRouter();

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const r = await deleteSavedSearchAction(id);
    if (r.error) toast.error("Couldn't delete", { description: r.error });
    else {
      toast.success("Deleted");
      router.refresh();
    }
  };

  return (
    <div className="space-y-3">
      {searches.map((s) => {
        const newCount = newMatchesById[s.id] ?? 0;
        const totalCount = currentTotalById[s.id] ?? s.lastResultCount ?? 0;
        return (
        <div
          key={s.id}
          className="group bg-card border border-hair rounded-lg p-5 hover:border-ink transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-display text-[17px] font-semibold tracking-tight">
                  {s.name}
                </div>
                {newCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-red px-2 py-0.5 rounded-xs uppercase tracking-[0.06em]">
                    {newCount} new
                  </span>
                )}
                {s.alertEmail ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red bg-red-soft px-1.5 py-0.5 rounded-xs uppercase tracking-[0.06em]">
                    <Bell className="w-3 h-3" /> Alerts on
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-3 px-1.5 py-0.5 rounded-xs uppercase tracking-[0.06em]">
                    <BellOff className="w-3 h-3" /> Alerts off
                  </span>
                )}
              </div>
              <FilterSummary filters={s.filters} />
              <div className="mt-2 font-mono text-[10.5px] text-ink-3">
                Saved {new Date(s.createdAt).toLocaleDateString()}
                {" · "}
                {totalCount} match{totalCount === 1 ? "" : "es"} now
                {s.lastViewedAt && ` · last checked ${new Date(s.lastViewedAt).toLocaleDateString()}`}
              </div>
            </div>
            <div className="flex gap-1">
              <Link
                href={`/scout?${new URLSearchParams(filtersToQuery(s.filters)).toString()}&fromSaved=${s.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[12.5px] font-semibold",
                  newCount > 0
                    ? "bg-red hover:bg-red/90 text-white"
                    : "bg-ink hover:bg-red text-white",
                )}
              >
                {newCount > 0 ? `See ${newCount} new` : "Run"}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => remove(s.id, s.name)}
                className="p-2 rounded-sm text-ink-3 hover:text-red hover:bg-red-soft"
                aria-label="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}

function FilterSummary({ filters }: { filters: SearchFilters }) {
  const parts: string[] = [];
  if (filters.query) parts.push(`"${filters.query}"`);
  if (filters.positions?.length) parts.push(`Pos: ${filters.positions.join("/")}`);
  if (filters.gradeYears?.length) parts.push(`Class: ${filters.gradeYears.join(", ")}`);
  if (filters.max60yd != null) parts.push(`60yd ≤ ${filters.max60yd}s`);
  if (filters.minEV != null) parts.push(`EV ≥ ${filters.minEV}`);
  if (filters.minVelo != null) parts.push(`Velo ≥ ${filters.minVelo}`);
  if (filters.minField != null) parts.push(`Field ≥ ${filters.minField}`);
  if (filters.minBP != null) parts.push(`BP ≥ ${filters.minBP}`);
  if (filters.minBA != null) parts.push(`BA ≥ ${formatAvg(filters.minBA)}`);
  if (filters.minOPS != null) parts.push(`OPS ≥ ${formatAvg(filters.minOPS)}`);
  if (filters.minHR != null) parts.push(`HR ≥ ${filters.minHR}`);
  if (filters.minIP != null) parts.push(`IP ≥ ${filters.minIP}`);
  if (filters.maxERA != null) parts.push(`ERA ≤ ${formatERA(filters.maxERA)}`);
  if (filters.maxWHIP != null) parts.push(`WHIP ≤ ${formatWHIP(filters.maxWHIP)}`);
  if (filters.minK9 != null) parts.push(`K/9 ≥ ${filters.minK9}`);
  if (parts.length === 0) return <div className="text-[12px] text-ink-3 mt-1">No filters</div>;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {parts.map((p, i) => (
        <span
          key={i}
          className="inline-flex px-2 py-0.5 rounded-xs bg-paper-deep text-ink-2 text-[11px] font-mono"
        >
          {p}
        </span>
      ))}
    </div>
  );
}

function filtersToQuery(f: SearchFilters): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.query) q.q = f.query;
  if (f.positions && f.positions.length > 0) q.pos = f.positions.join(",");
  if (f.gradeYears && f.gradeYears.length > 0) q.class = f.gradeYears.join(",");
  if (f.max60yd != null) q.max60 = String(f.max60yd);
  if (f.minEV != null) q.minEV = String(f.minEV);
  if (f.minVelo != null) q.minVelo = String(f.minVelo);
  if (f.minField != null) q.minField = String(f.minField);
  if (f.minBP != null) q.minBP = String(f.minBP);
  if (f.minBA != null) q.minBA = String(f.minBA);
  if (f.minOPS != null) q.minOPS = String(f.minOPS);
  if (f.minHR != null) q.minHR = String(f.minHR);
  if (f.minIP != null) q.minIP = String(f.minIP);
  if (f.maxERA != null) q.maxERA = String(f.maxERA);
  if (f.maxWHIP != null) q.maxWHIP = String(f.maxWHIP);
  if (f.minK9 != null) q.minK9 = String(f.minK9);
  if (f.sort && f.sort !== "best_ev_desc") q.sort = f.sort;
  return q;
}
