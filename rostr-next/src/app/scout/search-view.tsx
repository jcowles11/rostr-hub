"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { toast } from "sonner";
import {
  Search,
  Sparkles,
  X,
  Plus,
  SlidersHorizontal,
  BookmarkPlus,
  Heart,
  ChevronDown,
  Filter,
} from "lucide-react";
import { Avatar, avatarColorFromSeed } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import { formatAvg, formatIP, formatERA, formatWHIP } from "@/lib/format";
import type {
  PlayerSearchResult,
  RecruiterContext,
  RecruiterList,
  SavedSearch,
  SearchFilters,
} from "@/lib/services/recruiter";
import {
  createListAction,
  saveSearchAction,
  togglePlayerInListAction,
} from "./actions";

/**
 * ScoutSearchView — the recruiter's search surface.
 *
 * Layout principles (explicit anti-LinkedIn-Recruiter patterns):
 *   - Start with zero filters. Add them as chips; each chip explains
 *     itself without a modal.
 *   - Big, breathable player cards with verified measurables at the
 *     top and one-tap save-to-list.
 *   - Filter popover is a single compact panel, not a sidebar wall.
 */

type PlayerWithClass = PlayerSearchResult & { classYear: number | null };

const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "DH"];
const PRESETS: Array<{ label: string; filters: Partial<SearchFilters> }> = [
  { label: "Pitchers · 85+ mph", filters: { positions: ["P"], minVelo: 85 } },
  { label: "Infield · 6.9 or faster", filters: { positions: ["SS", "2B", "3B"], max60yd: 6.9 } },
  { label: "Power bats · 90+ EV", filters: { minEV: 90 } },
  { label: "2027 class", filters: { gradeYears: [2027] } },
  { label: "2026 class", filters: { gradeYears: [2026] } },
];

export interface ScoutSearchViewProps {
  recruiter: RecruiterContext;
  filters: SearchFilters;
  total: number;
  players: PlayerWithClass[];
  lists: RecruiterList[];
  savedSearches: SavedSearch[];
  hasAnyFilter: boolean;
}

export function ScoutSearchView({
  recruiter: _recruiter,
  filters,
  total,
  players,
  lists,
  savedSearches,
  hasAnyFilter,
}: ScoutSearchViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.query ?? "");

  /**
   * Rebuild the URL with a new filter state. The SSR page re-runs the
   * search on navigation. We keep the URL canonical so saved searches
   * are just bookmarked URLs (+ metadata).
   */
  const pushFilters = (next: SearchFilters) => {
    const params = new URLSearchParams();
    if (next.query) params.set("q", next.query);
    if (next.positions && next.positions.length > 0) params.set("pos", next.positions.join(","));
    if (next.gradeYears && next.gradeYears.length > 0) params.set("class", next.gradeYears.join(","));
    if (next.max60yd != null) params.set("max60", String(next.max60yd));
    if (next.minEV != null) params.set("minEV", String(next.minEV));
    if (next.minVelo != null) params.set("minVelo", String(next.minVelo));
    if (next.minField != null) params.set("minField", String(next.minField));
    if (next.minBP != null) params.set("minBP", String(next.minBP));
    if (next.minBA != null) params.set("minBA", String(next.minBA));
    if (next.minOPS != null) params.set("minOPS", String(next.minOPS));
    if (next.minHR != null) params.set("minHR", String(next.minHR));
    if (next.minIP != null) params.set("minIP", String(next.minIP));
    if (next.maxERA != null) params.set("maxERA", String(next.maxERA));
    if (next.maxWHIP != null) params.set("maxWHIP", String(next.maxWHIP));
    if (next.minK9 != null) params.set("minK9", String(next.minK9));
    if (next.sort && next.sort !== "best_ev_desc") params.set("sort", next.sort);
    startTransition(() => {
      router.push(`/scout${params.size > 0 ? `?${params}` : ""}`);
    });
  };

  const clearAll = () => pushFilters({ sort: filters.sort });

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    pushFilters({ ...filters, ...preset.filters });
  };

  const removeFilter = (key: keyof SearchFilters, value?: string | number) => {
    const next: SearchFilters = { ...filters };
    if (key === "positions" && value) {
      next.positions = (filters.positions ?? []).filter((p) => p !== value);
      if (next.positions.length === 0) delete next.positions;
    } else if (key === "gradeYears" && value != null) {
      next.gradeYears = (filters.gradeYears ?? []).filter((p) => p !== Number(value));
      if (next.gradeYears.length === 0) delete next.gradeYears;
    } else {
      delete (next as Record<string, unknown>)[key];
    }
    pushFilters(next);
  };

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    pushFilters({ ...filters, query: query.trim() || undefined });
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{
      key: string;
      label: string;
      onRemove: () => void;
    }> = [];
    if (filters.query) {
      chips.push({
        key: "query",
        label: `"${filters.query}"`,
        onRemove: () => {
          setQuery("");
          removeFilter("query");
        },
      });
    }
    for (const p of filters.positions ?? []) {
      chips.push({
        key: `pos-${p}`,
        label: `Pos: ${p}`,
        onRemove: () => removeFilter("positions", p),
      });
    }
    for (const cy of filters.gradeYears ?? []) {
      chips.push({
        key: `cy-${cy}`,
        label: `Class of ${cy}`,
        onRemove: () => removeFilter("gradeYears", cy),
      });
    }
    if (filters.max60yd != null) {
      chips.push({
        key: "max60",
        label: `60yd ≤ ${filters.max60yd}s`,
        onRemove: () => removeFilter("max60yd"),
      });
    }
    if (filters.minEV != null) {
      chips.push({
        key: "minEV",
        label: `EV ≥ ${filters.minEV} mph`,
        onRemove: () => removeFilter("minEV"),
      });
    }
    if (filters.minVelo != null) {
      chips.push({
        key: "minVelo",
        label: `Velo ≥ ${filters.minVelo} mph`,
        onRemove: () => removeFilter("minVelo"),
      });
    }
    if (filters.minField != null) {
      chips.push({
        key: "minField",
        label: `Fielding ≥ ${filters.minField}`,
        onRemove: () => removeFilter("minField"),
      });
    }
    if (filters.minBP != null) {
      chips.push({
        key: "minBP",
        label: `BP ≥ ${filters.minBP}`,
        onRemove: () => removeFilter("minBP"),
      });
    }
    if (filters.minBA != null) {
      chips.push({
        key: "minBA",
        label: `BA ≥ ${formatAvg(filters.minBA)}`,
        onRemove: () => removeFilter("minBA"),
      });
    }
    if (filters.minOPS != null) {
      chips.push({
        key: "minOPS",
        label: `OPS ≥ ${formatAvg(filters.minOPS)}`,
        onRemove: () => removeFilter("minOPS"),
      });
    }
    if (filters.minHR != null) {
      chips.push({
        key: "minHR",
        label: `HR ≥ ${filters.minHR}`,
        onRemove: () => removeFilter("minHR"),
      });
    }
    if (filters.minIP != null) {
      chips.push({
        key: "minIP",
        label: `IP ≥ ${filters.minIP}`,
        onRemove: () => removeFilter("minIP"),
      });
    }
    if (filters.maxERA != null) {
      chips.push({
        key: "maxERA",
        label: `ERA ≤ ${formatERA(filters.maxERA)}`,
        onRemove: () => removeFilter("maxERA"),
      });
    }
    if (filters.maxWHIP != null) {
      chips.push({
        key: "maxWHIP",
        label: `WHIP ≤ ${formatWHIP(filters.maxWHIP)}`,
        onRemove: () => removeFilter("maxWHIP"),
      });
    }
    if (filters.minK9 != null) {
      chips.push({
        key: "minK9",
        label: `K/9 ≥ ${filters.minK9}`,
        onRemove: () => removeFilter("minK9"),
      });
    }
    return chips;
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveThisSearch = async () => {
    const name = prompt("Name this search (e.g. TX SS 2027):");
    if (!name) return;
    const r = await saveSearchAction({ name, filters });
    if (r.error) toast.error("Couldn't save", { description: r.error });
    else {
      toast.success(`Saved search: ${name}`);
      router.refresh();
    }
  };

  return (
    <>
      {/* Sticky filter bar */}
      <div className="sticky top-0 z-topbar bg-card border-b border-hair">
        <div className="max-w-layout-app mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center gap-3 mb-3">
            <form onSubmit={runSearch} className="flex-1 max-w-md">
              <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2 focus-within:border-red">
                <Search className="w-4 h-4 text-ink-3" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name…"
                  className="flex-1 bg-transparent outline-none text-[13.5px]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      removeFilter("query");
                    }}
                    className="text-ink-3 hover:text-ink"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>
            <SortMenu
              current={filters.sort ?? "best_ev_desc"}
              onChange={(sort) => pushFilters({ ...filters, sort })}
            />
            <FilterMenu filters={filters} onApply={pushFilters} />
          </div>

          {/* Active chips + presets */}
          <div className="flex items-center gap-2 flex-wrap">
            {activeFilterChips.map((c) => (
              <FilterChip key={c.key} label={c.label} onRemove={c.onRemove} />
            ))}
            {activeFilterChips.length > 0 && (
              <>
                <button
                  onClick={clearAll}
                  className="text-[11.5px] text-ink-3 hover:text-ink px-1.5"
                >
                  Clear all
                </button>
                <button
                  onClick={saveThisSearch}
                  className="inline-flex items-center gap-1 text-[11.5px] text-red hover:text-red/80 font-semibold px-1.5"
                >
                  <BookmarkPlus className="w-3 h-3" /> Save search
                </button>
                <span className="h-4 w-px bg-hair" />
              </>
            )}
            {!hasAnyFilter && (
              <>
                <span className="text-[11px] text-ink-3 uppercase tracking-[0.08em] font-bold">
                  Quick start
                </span>
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className="text-[11.5px] px-2.5 py-1 rounded-xs bg-paper hover:bg-paper-deep text-ink-2 font-medium border border-hair-2"
                  >
                    {p.label}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Saved searches strip (when any exist) */}
          {savedSearches.length > 0 && (
            <div className="mt-3 pt-3 border-t border-hair-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-ink-3 uppercase tracking-[0.08em] font-bold">
                Your saved
              </span>
              {savedSearches.slice(0, 6).map((s) => (
                <Link
                  key={s.id}
                  href={`/scout?${new URLSearchParams(filtersToQuery(s.filters)).toString()}`}
                  className="inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-xs bg-red-soft text-red font-semibold"
                >
                  <BookmarkPlus className="w-3 h-3" />
                  {s.name}
                </Link>
              ))}
              {savedSearches.length > 6 && (
                <Link href="/scout/searches" className="text-[11.5px] text-ink-3 hover:text-ink">
                  +{savedSearches.length - 6} more →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-layout-app mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-baseline gap-3 mb-5">
            <h1 className="font-display text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em] leading-[1.1]">
              {hasAnyFilter ? "Filtered prospects" : "All prospects"}
            </h1>
            <span className="font-mono text-[13px] text-ink-3">
              {total} {total === 1 ? "match" : "matches"}
            </span>
            {isPending && (
              <span className="text-[11.5px] text-red font-semibold animate-pulse">
                searching…
              </span>
            )}
          </div>

          {players.length === 0 ? (
            <EmptyState hasAnyFilter={hasAnyFilter} onClear={clearAll} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map((p) => (
                <PlayerCard key={p.id} player={p} lists={lists} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
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

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-ink text-white text-[11.5px] font-semibold">
      {label}
      <button
        onClick={onRemove}
        className="text-white/60 hover:text-white"
        aria-label={`Remove ${label}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ── Sort + filter menus ──────────────────────────────────────────

function SortMenu({
  current,
  onChange,
}: {
  current: NonNullable<SearchFilters["sort"]>;
  onChange: (s: NonNullable<SearchFilters["sort"]>) => void;
}) {
  const options = [
    { value: "best_ev_desc", label: "Best EV" },
    { value: "best_60yd_asc", label: "Fastest 60yd" },
    { value: "best_velo_desc", label: "Highest velo" },
    { value: "ops_desc", label: "OPS (season)" },
    { value: "ba_desc", label: "Batting avg (season)" },
    { value: "era_asc", label: "ERA (season)" },
    { value: "k9_desc", label: "K/9 (season)" },
    { value: "grade_asc", label: "Class (oldest first)" },
    { value: "name_asc", label: "Name A–Z" },
  ] as const;
  const currentLabel = options.find((o) => o.value === current)?.label ?? "Best EV";
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-paper border border-hair rounded-sm text-[12.5px] font-semibold hover:border-ink">
          <span className="text-ink-3">Sort:</span>
          {currentLabel}
          <ChevronDown className="w-3.5 h-3.5 text-ink-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="z-[110] bg-card border border-hair rounded-md shadow-modal min-w-[220px] py-1"
        >
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              className={cn(
                "w-full text-left px-3 py-2 text-[13px] hover:bg-paper",
                o.value === current && "bg-paper font-semibold",
              )}
            >
              {o.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function FilterMenu({
  filters,
  onApply,
}: {
  filters: SearchFilters;
  onApply: (f: SearchFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [positions, setPositions] = useState<string[]>(filters.positions ?? []);
  const [classes, setClasses] = useState<number[]>(filters.gradeYears ?? []);
  const [max60, setMax60] = useState<string>(filters.max60yd != null ? String(filters.max60yd) : "");
  const [minEV, setMinEV] = useState<string>(filters.minEV != null ? String(filters.minEV) : "");
  const [minVelo, setMinVelo] = useState<string>(filters.minVelo != null ? String(filters.minVelo) : "");
  const [minField, setMinField] = useState<string>(filters.minField != null ? String(filters.minField) : "");
  const [minBP, setMinBP] = useState<string>(filters.minBP != null ? String(filters.minBP) : "");
  const [minBA, setMinBA] = useState<string>(filters.minBA != null ? String(filters.minBA) : "");
  const [minOPS, setMinOPS] = useState<string>(filters.minOPS != null ? String(filters.minOPS) : "");
  const [minHR, setMinHR] = useState<string>(filters.minHR != null ? String(filters.minHR) : "");
  const [minIP, setMinIP] = useState<string>(filters.minIP != null ? String(filters.minIP) : "");
  const [maxERA, setMaxERA] = useState<string>(filters.maxERA != null ? String(filters.maxERA) : "");
  const [maxWHIP, setMaxWHIP] = useState<string>(filters.maxWHIP != null ? String(filters.maxWHIP) : "");
  const [minK9, setMinK9] = useState<string>(filters.minK9 != null ? String(filters.minK9) : "");

  const apply = () => {
    onApply({
      ...filters,
      positions: positions.length > 0 ? positions : undefined,
      gradeYears: classes.length > 0 ? classes : undefined,
      max60yd: max60 ? Number(max60) : null,
      minEV: minEV ? Number(minEV) : null,
      minVelo: minVelo ? Number(minVelo) : null,
      minField: minField ? Number(minField) : null,
      minBP: minBP ? Number(minBP) : null,
      minBA: minBA ? Number(minBA) : null,
      minOPS: minOPS ? Number(minOPS) : null,
      minHR: minHR ? Number(minHR) : null,
      minIP: minIP ? Number(minIP) : null,
      maxERA: maxERA ? Number(maxERA) : null,
      maxWHIP: maxWHIP ? Number(maxWHIP) : null,
      minK9: minK9 ? Number(minK9) : null,
    });
    setOpen(false);
  };

  const togglePosition = (p: string) =>
    setPositions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  const toggleClass = (y: number) =>
    setClasses((prev) => (prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]));

  const CURRENT_YEARS = [2025, 2026, 2027, 2028, 2029];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="inline-flex items-center gap-1.5 px-3 py-2 bg-ink hover:bg-red text-white rounded-sm text-[12.5px] font-semibold">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="z-[110] bg-card border border-hair rounded-md shadow-modal w-[360px] p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-ink-3" />
            <h3 className="font-display text-[14px] font-semibold tracking-tight">
              Refine search
            </h3>
          </div>

          {/* Positions */}
          <div className="mb-4">
            <div className="type-label mb-2">Positions</div>
            <div className="flex flex-wrap gap-1.5">
              {POSITIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePosition(p)}
                  className={cn(
                    "px-2.5 py-1 rounded-xs text-[11.5px] font-semibold font-mono border",
                    positions.includes(p)
                      ? "bg-red text-white border-red"
                      : "bg-paper text-ink-2 border-hair hover:border-ink-3",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Class years */}
          <div className="mb-4">
            <div className="type-label mb-2">Class year</div>
            <div className="flex gap-1.5">
              {CURRENT_YEARS.map((y) => (
                <button
                  key={y}
                  onClick={() => toggleClass(y)}
                  className={cn(
                    "px-2.5 py-1 rounded-xs text-[11.5px] font-semibold font-mono border",
                    classes.includes(y)
                      ? "bg-red text-white border-red"
                      : "bg-paper text-ink-2 border-hair hover:border-ink-3",
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Measurables */}
          <div className="mb-4 space-y-2.5">
            <div className="type-label">Measurables</div>
            <NumInput label="60yd ≤" unit="s" placeholder="e.g. 6.9" value={max60} onChange={setMax60} step="0.01" />
            <NumInput label="EV ≥" unit="mph" placeholder="e.g. 85" value={minEV} onChange={setMinEV} />
            <NumInput label="Pitching velo ≥" unit="mph" placeholder="e.g. 85" value={minVelo} onChange={setMinVelo} />
            <NumInput label="Fielding ≥" unit="/5" placeholder="e.g. 3.5" value={minField} onChange={setMinField} step="0.1" />
            <NumInput label="BP ≥" unit="/5" placeholder="e.g. 3.5" value={minBP} onChange={setMinBP} step="0.1" />
          </div>

          {/* Game performance — from live-scoring event log */}
          <div className="mb-4 space-y-2.5">
            <div className="type-label flex items-center gap-1.5">
              Game performance
              <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-red bg-red-soft px-1.5 py-0.5 rounded-xs">
                Live
              </span>
            </div>
            <NumInput label="Batting avg ≥" unit="" placeholder="e.g. .300" value={minBA} onChange={setMinBA} step="0.01" />
            <NumInput label="OPS ≥" unit="" placeholder="e.g. .800" value={minOPS} onChange={setMinOPS} step="0.01" />
            <NumInput label="Home runs ≥" unit="" placeholder="e.g. 3" value={minHR} onChange={setMinHR} step="1" />
            <p className="text-[10.5px] text-ink-3 leading-snug pl-[130px]">
              Verified from in-app live scoring. Strict — excludes players with no games played.
            </p>
          </div>

          {/* Pitching — derives from the same event log */}
          <div className="mb-4 space-y-2.5">
            <div className="type-label flex items-center gap-1.5">
              Pitching
              <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-red bg-red-soft px-1.5 py-0.5 rounded-xs">
                Live
              </span>
            </div>
            <NumInput label="IP ≥" unit="" placeholder="e.g. 10" value={minIP} onChange={setMinIP} step="1" />
            <NumInput label="ERA ≤" unit="" placeholder="e.g. 3.00" value={maxERA} onChange={setMaxERA} step="0.05" />
            <NumInput label="WHIP ≤" unit="" placeholder="e.g. 1.20" value={maxWHIP} onChange={setMaxWHIP} step="0.01" />
            <NumInput label="K/9 ≥" unit="" placeholder="e.g. 9" value={minK9} onChange={setMinK9} step="0.1" />
          </div>

          <div className="flex gap-2 pt-3 border-t border-hair-2">
            <button
              onClick={() => {
                setPositions([]);
                setClasses([]);
                setMax60("");
                setMinEV("");
                setMinVelo("");
                setMinField("");
                setMinBP("");
                setMinBA("");
                setMinOPS("");
                setMinHR("");
                setMinIP("");
                setMaxERA("");
                setMaxWHIP("");
                setMinK9("");
              }}
              className="px-3 py-2 text-[12.5px] text-ink-3 hover:text-ink"
            >
              Reset
            </button>
            <button
              onClick={apply}
              className="ml-auto px-3 py-2 bg-ink hover:bg-red text-white rounded-sm text-[12.5px] font-semibold"
            >
              Apply
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NumInput({
  label,
  unit,
  placeholder,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  unit: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-ink-2 w-[130px]">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-paper border border-hair rounded-sm px-2.5 py-1.5 text-[12.5px] font-mono outline-none focus:border-red"
      />
      <span className="text-[11px] text-ink-3 w-[30px]">{unit}</span>
    </div>
  );
}

// ── Player card ──────────────────────────────────────────────────

function PlayerCard({
  player,
  lists,
}: {
  player: PlayerWithClass;
  lists: RecruiterList[];
}) {
  const initials = (player.firstName[0] ?? "") + (player.lastName[0] ?? "");
  const color = avatarColorFromSeed(player.id);

  return (
    <div className="group bg-card border border-hair rounded-lg p-4 sm:p-5 hover:border-ink transition-colors relative">
      <div className="flex items-start gap-3">
        <Avatar size="lg" color={color} initials={initials.toUpperCase()} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/p/${player.profileSlug}`}
              className="font-display text-[17px] sm:text-[18px] font-semibold tracking-tight leading-tight hover:underline truncate"
            >
              {player.firstName} {player.lastName}
            </Link>
            {player.jersey && (
              <span className="font-mono text-[13px] text-ink-3">#{player.jersey}</span>
            )}
          </div>
          <div className="font-mono text-[11.5px] text-ink-3 mt-0.5 truncate">
            {player.classYear ? `Class of ${player.classYear}` : "—"}
            {player.positions.length > 0 && ` · ${player.positions.join("/")}`}
            {player.bats && player.throws && ` · ${player.bats}/${player.throws}`}
          </div>
          {player.schoolName && (
            <div className="text-[11.5px] text-ink-2 mt-0.5 truncate">{player.schoolName}</div>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <SaveToListButton player={player} lists={lists} />
        </div>
      </div>

      {/* Measurables grid */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Measurable label="EV" value={player.bestEV} unit="mph" hot={player.bestEV != null && player.bestEV >= 88} />
        <Measurable label="60yd" value={player.best60yd} unit="s" hot={player.best60yd != null && player.best60yd <= 6.9} lowerBetter />
        <Measurable label="Velo" value={player.bestVelo} unit="mph" hot={player.bestVelo != null && player.bestVelo >= 85} />
        <Measurable label="Field" value={player.bestField} unit="/5" hot={player.bestField != null && player.bestField >= 4} />
      </div>

      {/* Real game stats (if any) — proves the recruiter isn't just looking at tryout numbers */}
      {player.games != null && player.games > 0 && (
        <div className="mt-3 flex items-center gap-3 px-3 py-2 bg-paper border border-hair-2 rounded-sm">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-red">
            Bat
          </span>
          <StatPair label="G" value={String(player.games)} />
          <StatPair label="AVG" value={formatAvg(player.ba)} />
          <StatPair label="OPS" value={formatAvg(player.ops)} highlight={player.ops != null && player.ops >= 0.8} />
          {player.hr != null && player.hr > 0 && (
            <StatPair label="HR" value={String(player.hr)} />
          )}
        </div>
      )}
      {player.pitchingGames != null && player.pitchingGames > 0 && (
        <div className="mt-2 flex items-center gap-3 px-3 py-2 bg-paper border border-hair-2 rounded-sm">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-red">
            Pit
          </span>
          <StatPair label="IP" value={formatIP(player.ip)} />
          <StatPair label="ERA" value={formatERA(player.era)} highlight={player.era != null && player.era > 0 && player.era < 3.0} />
          <StatPair label="WHIP" value={formatWHIP(player.whip)} highlight={player.whip != null && player.whip > 0 && player.whip < 1.2} />
          <StatPair label="K/9" value={player.k9 != null && player.k9 > 0 ? player.k9.toFixed(1) : "—"} highlight={player.k9 != null && player.k9 >= 10} />
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Link
          href={`/p/${player.profileSlug}`}
          className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-ink hover:bg-red text-white rounded-sm text-[12.5px] font-semibold transition-colors"
        >
          View profile →
        </Link>
      </div>
    </div>
  );
}

function StatPair({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3">{label}</span>
      <span className={cn("font-mono text-[12.5px] font-semibold tracking-[-0.02em]", highlight && "text-red")}>
        {value}
      </span>
    </div>
  );
}

function Measurable({
  label,
  value,
  unit,
  hot,
  lowerBetter: _lower,
}: {
  label: string;
  value: number | null;
  unit: string;
  hot?: boolean;
  lowerBetter?: boolean;
}) {
  if (value == null) {
    return (
      <div className="px-2 py-2 bg-paper rounded-sm text-center">
        <div className="font-mono text-[15px] text-ink-4">—</div>
        <div className="text-[9.5px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-0.5">{label}</div>
      </div>
    );
  }
  const formatted = unit === "s" ? value.toFixed(2) : unit === "/5" ? value.toFixed(1) : value.toFixed(1).replace(/\.0$/, "");
  return (
    <div className={cn(
      "px-2 py-2 rounded-sm text-center border",
      hot ? "bg-red-soft border-red/30 text-red" : "bg-paper border-transparent",
    )}>
      <div className="font-mono text-[15px] font-bold tracking-[-0.02em]">
        {formatted}
        {unit !== "/5" && <span className="text-[10px] text-ink-3 ml-0.5 font-normal">{unit}</span>}
      </div>
      <div className="text-[9.5px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-0.5">{label}</div>
    </div>
  );
}

// ── Save-to-list button ──────────────────────────────────────────

function SaveToListButton({
  player,
  lists,
}: {
  player: PlayerWithClass;
  lists: RecruiterList[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  const saveTo = (listId: string) => {
    startTransition(async () => {
      const r = await togglePlayerInListAction(listId, player.id, true);
      if (r.error) toast.error("Couldn't save", { description: r.error });
      else {
        toast.success(`Saved ${player.firstName} ${player.lastName}`);
        router.refresh();
      }
    });
  };

  const createAndSave = async () => {
    if (!newListName.trim()) return;
    const r = await createListAction({ name: newListName });
    if (r.error || !r.listId) return toast.error("Couldn't create list");
    await togglePlayerInListAction(r.listId, player.id, true);
    toast.success(`Saved to ${newListName}`);
    setNewListName("");
    setNewListOpen(false);
    router.refresh();
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[12px] font-semibold border transition-colors",
            "bg-paper hover:bg-red-soft hover:border-red hover:text-red border-hair text-ink-2",
            isPending && "opacity-50",
          )}
          aria-label="Save to list"
          title="Save to list"
        >
          <Heart className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Save</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="z-[110] bg-card border border-hair rounded-md shadow-modal min-w-[220px] py-1"
        >
          <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Save to list
          </div>
          {lists.length === 0 && !newListOpen && (
            <div className="px-3 py-2 text-[11.5px] text-ink-3">No lists yet.</div>
          )}
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => saveTo(l.id)}
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-paper flex items-center gap-2"
            >
              <span className="text-[13px]">{l.emoji ?? "•"}</span>
              <span className="flex-1 truncate">{l.name}</span>
              <span className="font-mono text-[10px] text-ink-3">{l.playerCount}</span>
            </button>
          ))}
          {newListOpen ? (
            <div className="px-3 py-2 border-t border-hair-2">
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createAndSave();
                }}
                placeholder="New list name…"
                className="w-full bg-paper border border-hair rounded-sm px-2 py-1.5 text-[12.5px] outline-none focus:border-red"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setNewListOpen(false)}
                  className="text-[11.5px] text-ink-3 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={createAndSave}
                  disabled={!newListName.trim()}
                  className="text-[11.5px] bg-red text-white px-2.5 py-1 rounded-xs font-semibold disabled:opacity-50"
                >
                  Create + save
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setNewListOpen(true)}
              className="w-full text-left px-3 py-2 text-[12.5px] text-red font-semibold hover:bg-red-soft border-t border-hair-2 flex items-center gap-2"
            >
              <Plus className="w-3 h-3" /> New list
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function EmptyState({
  hasAnyFilter,
  onClear,
}: {
  hasAnyFilter: boolean;
  onClear: () => void;
}) {
  return (
    <div className="p-10 bg-card border border-dashed border-hair rounded-lg text-center">
      <div className="w-12 h-12 rounded-full bg-red-soft text-red inline-flex items-center justify-center mb-3">
        <Sparkles className="w-6 h-6" />
      </div>
      <h2 className="font-display text-[20px] font-semibold tracking-tight">
        {hasAnyFilter ? "No prospects match yet" : "No prospects in the database yet"}
      </h2>
      <p className="text-[13px] text-ink-3 mt-2 max-w-[440px] mx-auto leading-relaxed">
        {hasAnyFilter
          ? "Loosen your filters, or save this search and we'll notify you when matching players get added."
          : "As coaches onboard their rosters and verify measurables at tryouts, prospects show up here automatically."}
      </p>
      {hasAnyFilter && (
        <button
          onClick={onClear}
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 bg-ink hover:bg-red text-white rounded-sm text-[13px] font-semibold transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
