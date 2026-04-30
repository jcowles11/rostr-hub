"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ShieldCheck,
  X,
  ChevronRight,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayerSearchResult } from "@/lib/services/recruiter";
import { Avatar } from "@/components/atoms/avatar";

/**
 * Pure helper inlined here so this client module doesn't drag in the
 * full recruiter.ts (which imports supabase/server, a server-only
 * module). Mirrors the server-side implementation exactly: grade 12
 * graduates in the current calendar year, lower grades shifted out by
 * (12 - grade) years.
 */
function classYearForGrade(grade: number, today: Date = new Date()): number {
  const nowYear = today.getFullYear();
  const yearsRemaining = Math.max(0, 12 - grade);
  return nowYear + yearsRemaining;
}

/**
 * Scout Discovery V1 — client view.
 *
 * "Search → scan → click" is the design target. Every interaction
 * reflects in the URL via `router.push(?q=...&pos=...)` so the page
 * is shareable + back-button friendly. The server runs the actual
 * search; the client just edits filter state.
 *
 * Verified-data-only is a query-string toggle (?verified=1) so the
 * server sees it on the next render. We do NOT filter client-side
 * after the fact because that splits truth between client + server
 * caches.
 */

const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "OF", "DH"];

interface DiscoverFilters {
  query: string;
  positions: string[];
  gradeYears: string[];
  verifiedOnly: boolean;
}

export function ScoutDiscoverView({
  recruiterName,
  initialFilters,
  players,
}: {
  recruiterName: string;
  initialFilters: DiscoverFilters;
  players: PlayerSearchResult[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DiscoverFilters>(initialFilters);

  // Build the URL from a filter snapshot — used by the search-on-submit
  // and pill add/remove flows.
  function applyFilters(next: DiscoverFilters) {
    const params = new URLSearchParams();
    if (next.query.trim()) params.set("q", next.query.trim());
    if (next.positions.length > 0) params.set("pos", next.positions.join(","));
    if (next.gradeYears.length > 0)
      params.set("class", next.gradeYears.join(","));
    if (next.verifiedOnly) params.set("verified", "1");
    const qs = params.toString();
    setDraft(next);
    startTransition(() => {
      router.push(`/scout/discover${qs ? `?${qs}` : ""}`);
    });
  }

  function togglePosition(pos: string) {
    const next = { ...draft };
    if (next.positions.includes(pos)) {
      next.positions = next.positions.filter((p) => p !== pos);
    } else {
      next.positions = [...next.positions, pos];
    }
    applyFilters(next);
  }

  function toggleGradeYear(year: string) {
    const next = { ...draft };
    if (next.gradeYears.includes(year)) {
      next.gradeYears = next.gradeYears.filter((y) => y !== year);
    } else {
      next.gradeYears = [...next.gradeYears, year];
    }
    applyFilters(next);
  }

  function toggleVerifiedOnly() {
    applyFilters({ ...draft, verifiedOnly: !draft.verifiedOnly });
  }

  function clearAll() {
    applyFilters({
      query: "",
      positions: [],
      gradeYears: [],
      verifiedOnly: false,
    });
  }

  // Class-year options: current year + next 4 (covers grades 8-12).
  const gradeYearOptions = useMemo(() => {
    const thisYear = new Date().getFullYear();
    return [thisYear, thisYear + 1, thisYear + 2, thisYear + 3].map((y) =>
      String(y),
    );
  }, []);

  const hasAnyFilter =
    draft.query.trim() !== "" ||
    draft.positions.length > 0 ||
    draft.gradeYears.length > 0 ||
    draft.verifiedOnly;

  return (
    <div className="min-h-[100dvh] bg-paper">
      <header className="sticky top-0 z-topbar bg-paper/85 backdrop-blur-xl backdrop-saturate-150 border-b border-hair">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-[18px] font-bold tracking-tight">
                Discover players
              </h1>
              <p className="text-[11.5px] text-ink-3 mt-0.5">
                Welcome, {recruiterName}. Public profiles only.
              </p>
            </div>
            <span className="shrink-0 text-[10.5px] font-mono uppercase tracking-[0.06em] text-ink-3 px-2 py-1 rounded-full bg-paper-deep border border-hair">
              Scout · Beta
            </span>
          </div>

          {/* Search bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters(draft);
            }}
            className="mt-3 relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
            <input
              type="search"
              inputMode="search"
              value={draft.query}
              onChange={(e) => setDraft({ ...draft, query: e.target.value })}
              placeholder="Search by name…"
              className={cn(
                "w-full h-11 pl-10 pr-4 rounded-xl border border-hair bg-card text-[14px]",
                "focus:outline-none focus:border-red focus:ring-2 focus:ring-red-soft",
              )}
            />
            {draft.query && (
              <button
                type="button"
                onClick={() => applyFilters({ ...draft, query: "" })}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-ink-3 hover:text-ink hover:bg-paper-deep"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Filters strip */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 sm:-mx-6 px-4 sm:px-6 scrollbar-none">
            <span className="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-3 mr-1">
              <Filter className="w-3 h-3" />
              Filter
            </span>
            {/* Verified-only toggle */}
            <button
              type="button"
              onClick={toggleVerifiedOnly}
              disabled={pending}
              className={cn(
                "shrink-0 inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.06em] px-2 py-1 text-[10.5px] border",
                "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                "active:scale-[0.96] disabled:opacity-60",
                draft.verifiedOnly
                  ? "bg-grass text-white border-grass shadow-[0_2px_6px_-2px_rgba(47,125,79,0.4)]"
                  : "bg-card text-ink-2 border-hair hover:border-ink-3",
              )}
            >
              <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
              Verified only
            </button>
            {/* Position filters */}
            {POSITIONS.map((pos) => {
              const active = draft.positions.includes(pos);
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => togglePosition(pos)}
                  disabled={pending}
                  className={cn(
                    "shrink-0 rounded-full font-bold tracking-tight px-2 py-1 text-[11px] border",
                    "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                    "active:scale-[0.96] disabled:opacity-60",
                    active
                      ? "bg-ink text-paper border-ink"
                      : "bg-card text-ink-2 border-hair hover:border-ink-3",
                  )}
                >
                  {pos}
                </button>
              );
            })}
            {/* Grade-year filters */}
            {gradeYearOptions.map((year) => {
              const active = draft.gradeYears.includes(year);
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => toggleGradeYear(year)}
                  disabled={pending}
                  className={cn(
                    "shrink-0 rounded-full font-mono tracking-tight px-2 py-1 text-[11px] border",
                    "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                    "active:scale-[0.96] disabled:opacity-60",
                    active
                      ? "bg-ink text-paper border-ink"
                      : "bg-card text-ink-2 border-hair hover:border-ink-3",
                  )}
                >
                  &apos;{year.slice(2)}
                </button>
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
        </div>
      </header>

      {/* Result grid */}
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-5 pb-20">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[12.5px] text-ink-3">
            {pending ? "Searching…" : `${players.length} ${players.length === 1 ? "player" : "players"}`}
          </div>
        </div>
        {players.length === 0 ? (
          <EmptyState hasFilters={hasAnyFilter} onClear={clearAll} />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {players.map((p) => (
              <li key={p.id}>
                <PlayerCard player={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────

function PlayerCard({ player }: { player: PlayerSearchResult }) {
  const fullName = `${player.firstName} ${player.lastName}`.trim();
  const initials =
    `${player.firstName[0] ?? "?"}${player.lastName[0] ?? "?"}`.toUpperCase();
  const classYear = player.grade ? classYearForGrade(player.grade) : null;
  const positions = player.positions.join("/");

  // "Has verified data" — same definition as the server-side filter.
  // Players with at least one tryout measurable get a small Verified
  // chip on the card so a scout scanning the grid can see it instantly.
  const hasVerified = Boolean(
    player.best60yd != null ||
      player.bestEV != null ||
      player.bestVelo != null ||
      player.bestField != null ||
      player.bestBP != null,
  );

  // Primary "key stat" preview: pick the most-impressive populated
  // verified measurable, then fall back to BA / IP. Keeps the card
  // single-line at the bottom.
  const keyStat = pickKeyStat(player);

  return (
    <Link
      href={`/p/${player.profileSlug}`}
      className={cn(
        "block bg-card border border-hair rounded-xl p-3 sm:p-4",
        "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "hover:border-ink-3 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] active:scale-[0.99]",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar initials={initials} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-display text-[14.5px] font-semibold tracking-tight truncate">
              {fullName}
            </div>
            {hasVerified && (
              <span
                title="Has verified measurables"
                className="inline-flex items-center gap-0.5 rounded-full font-bold uppercase tracking-[0.06em] bg-grass-dim text-grass border border-grass/20 px-1.5 py-0 text-[9.5px]"
              >
                <ShieldCheck className="w-2.5 h-2.5" strokeWidth={2.5} />
                Verified
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-3">
            {positions && <span>{positions}</span>}
            {classYear && <span>· Class of {classYear}</span>}
          </div>
          {keyStat && (
            <div className="mt-1.5 text-[12px] text-ink-2 font-mono tabular-nums">
              {keyStat}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-ink-3 shrink-0 mt-0.5" />
      </div>
    </Link>
  );
}

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="bg-card border border-dashed border-hair rounded-2xl p-10 text-center">
      <h3 className="font-display text-[16px] font-semibold tracking-tight">
        {hasFilters ? "No matches" : "Start searching"}
      </h3>
      <p className="text-[12.5px] text-ink-3 mt-2 max-w-[360px] mx-auto leading-relaxed">
        {hasFilters
          ? "Try fewer filters or a broader search term. Only players with public profiles appear here."
          : "Type a name above, or tap a filter to narrow down. Only players who've opted into a public profile are visible to scouts."}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink hover:bg-paper-deep transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

/**
 * Pick the most-recruiter-relevant single stat to surface on the card.
 * Order of preference:
 *   1. Pitcher velo (FB) — the loudest signal for any pitcher.
 *   2. Exit velo (EV) — the loudest signal for any hitter.
 *   3. Season BA — fallback when no measurables exist.
 * Returns a formatted string like "Velo 88 mph", or null when nothing
 * worth surfacing is populated.
 */
function pickKeyStat(p: PlayerSearchResult): string | null {
  if (p.bestVelo != null) return `FB Velo ${p.bestVelo} mph`;
  if (p.bestEV != null) return `Exit Velo ${p.bestEV} mph`;
  if (p.best60yd != null) return `60yd ${p.best60yd.toFixed(2)}s`;
  if (p.ba != null && p.games != null && p.games > 0) {
    return `${p.ba.toFixed(3).replace(/^0/, "")} BA · ${p.games}G`;
  }
  if (p.intendedLevel) return `Targeting ${p.intendedLevel}`;
  return null;
}
