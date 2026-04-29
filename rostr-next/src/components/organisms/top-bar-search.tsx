"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, ArrowRight, User, Calendar, ClipboardList, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/atoms/kbd";
import { MOCK_PLAYERS, MOCK_WEEK } from "@/lib/mock-data";
import { searchProgramAction } from "@/app/app/search/actions";

/**
 * TopBarSearchBox — the global app-bar search.
 *
 * Owns a popup overlay that filters across players, scheduled events,
 * and primary surfaces (Roster, Practice, Stats…) as the coach types.
 *
 * Keyboard:
 *   - ⌘K / Ctrl+K — focus + open
 *   - Enter — navigate to the top-highlighted result
 *   - ↑ ↓ — move highlight
 *   - Esc — close
 *
 * Data source:
 *   - On /demo, uses MOCK_PLAYERS + MOCK_WEEK so the tour works
 *     without auth or DB access.
 *   - On /app, currently falls back to MOCK_PLAYERS too — wiring in a
 *     real server action that fetches the coach's roster is a one-line
 *     swap (call into search-action.ts) once the backing data layer
 *     is in place. Today the tour is the priority.
 */

interface SearchResult {
  id: string;
  kind: "player" | "event" | "page";
  label: string;
  sub: string;
  href: string;
}

const PAGE_SHORTCUTS_DEMO: SearchResult[] = [
  { id: "p-hub", kind: "page", label: "Hub", sub: "Coach home", href: "/demo" },
  { id: "p-today", kind: "page", label: "Today", sub: "Daily standup", href: "/demo/today" },
  { id: "p-roster", kind: "page", label: "Roster", sub: "Players & levels", href: "/demo/roster" },
  { id: "p-practice", kind: "page", label: "Practice", sub: "Plan + AI assistant", href: "/demo/practice" },
  { id: "p-games", kind: "page", label: "Games", sub: "Schedule + scoring", href: "/demo/games" },
  { id: "p-schedule", kind: "page", label: "Schedule", sub: "Week view", href: "/demo/schedule" },
  { id: "p-stats", kind: "page", label: "Stats", sub: "Leaderboards", href: "/demo/stats" },
  { id: "p-tryouts", kind: "page", label: "Tryouts", sub: "Station-based scoring", href: "/demo/tryouts" },
  { id: "p-analytics", kind: "page", label: "Analytics", sub: "Season trends", href: "/demo/analytics" },
  { id: "p-messages", kind: "page", label: "Messages", sub: "Inbox", href: "/demo/messages" },
  { id: "p-settings", kind: "page", label: "Settings", sub: "Program config", href: "/demo/settings" },
  { id: "p-help", kind: "page", label: "Help", sub: "FAQ + getting started", href: "/demo/help" },
];

const PAGE_SHORTCUTS_APP: SearchResult[] = [
  { id: "p-hub", kind: "page", label: "Hub", sub: "Coach home", href: "/app" },
  { id: "p-today", kind: "page", label: "Today", sub: "Daily standup", href: "/app/today" },
  { id: "p-roster", kind: "page", label: "Roster", sub: "Players & levels", href: "/app/roster" },
  { id: "p-practice", kind: "page", label: "Practice", sub: "Plan + AI assistant", href: "/app/practice" },
  { id: "p-games", kind: "page", label: "Games", sub: "Schedule + scoring", href: "/app/games" },
  { id: "p-schedule", kind: "page", label: "Schedule", sub: "Week view", href: "/app/schedule" },
  { id: "p-stats", kind: "page", label: "Stats", sub: "Leaderboards", href: "/app/stats" },
  { id: "p-tryouts", kind: "page", label: "Tryouts", sub: "Station-based scoring", href: "/app/tryouts" },
  { id: "p-analytics", kind: "page", label: "Analytics", sub: "Season trends", href: "/app/analytics" },
  { id: "p-messages", kind: "page", label: "Messages", sub: "Inbox", href: "/app/messages" },
  { id: "p-settings", kind: "page", label: "Settings", sub: "Program config", href: "/app/settings" },
  { id: "p-help", kind: "page", label: "Help", sub: "FAQ + getting started", href: "/app/help" },
];

export function TopBarSearchBox({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isDemo = pathname?.startsWith("/demo") ?? false;

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [serverResults, setServerResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Local-corpus search (always available): page shortcuts + mock
  // players + this week's events. Used in /demo and as instant
  // feedback in /app while the server fetch is in flight.
  const corpus = useMemo(() => buildCorpus(isDemo), [isDemo]);

  // Server-backed search runs on /app only — fetches the coach's real
  // roster + games + practices. Debounced 200ms so a typing burst
  // doesn't fire 12 round-trips. Demo stays local-only.
  useEffect(() => {
    if (isDemo) {
      setServerResults([]);
      return;
    }
    const trimmed = q.trim();
    if (!trimmed) {
      setServerResults([]);
      return;
    }
    const handle = setTimeout(() => {
      void searchProgramAction(trimmed)
        .then((r) => {
          setServerResults(
            r.results.map((sr) => ({
              id: sr.id,
              kind: sr.kind === "game" ? "event" : sr.kind === "practice" ? "event" : "player",
              label: sr.label,
              sub: sr.sub,
              href: sr.href,
            })),
          );
        })
        .catch(() => setServerResults([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [q, isDemo]);

  // Compose final results: server hits first (real player matches),
  // then page shortcuts + this week's events as a fallback. Empty
  // query → top 6 page shortcuts.
  const results = useMemo(() => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) {
      return corpus.slice(0, 6);
    }
    const tokens = trimmed.split(/\s+/);
    const localScored = corpus
      .map((r) => ({ r, score: scoreMatch(r, tokens) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r);

    // De-dupe: prefer server results (they're real data) over local
    // matches that overlap. Match by label rather than id since the
    // id namespaces differ.
    const seen = new Set(serverResults.map((r) => r.label.toLowerCase()));
    const localFiltered = localScored.filter((r) => !seen.has(r.label.toLowerCase()));
    return [...serverResults, ...localFiltered].slice(0, 8);
  }, [q, corpus, serverResults]);

  // ⌘K / Ctrl+K to focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset highlighted as results shift.
  useEffect(() => {
    setHighlighted(0);
  }, [results.length, q]);

  // Click outside closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const navigate = (href: string) => {
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
    router.push(href);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-[280px]">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((h) => Math.min(results.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const r = results[highlighted];
              if (r) navigate(r.href);
            }
          }}
          placeholder={placeholder ?? "Search players, drills, games…"}
          className="w-full h-9 pl-8 pr-12 bg-paper border border-hair rounded-md text-[13px] focus:outline-none focus:border-red placeholder:text-ink-4"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <Kbd>⌘K</Kbd>
        </span>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-hair rounded-lg shadow-lg z-popover overflow-hidden max-h-[420px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-ink-3">
              No matches for <b className="text-ink">&ldquo;{q}&rdquo;</b>.
            </div>
          ) : (
            <>
              {!q.trim() && (
                <div className="px-4 py-2 type-label border-b border-hair-2">
                  Quick jump
                </div>
              )}
              {results.map((r, i) => (
                <ResultRow
                  key={r.id}
                  result={r}
                  highlighted={i === highlighted}
                  onClick={() => navigate(r.href)}
                  onHover={() => setHighlighted(i)}
                />
              ))}
              <div className="px-4 py-2 border-t border-hair-2 flex items-center gap-3 text-[10.5px] text-ink-4">
                <span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
                <span><Kbd>↵</Kbd> open</span>
                <span><Kbd>Esc</Kbd> close</span>
                <span className="ml-auto">{results.length} result{results.length === 1 ? "" : "s"}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({
  result,
  highlighted,
  onClick,
  onHover,
}: {
  result: SearchResult;
  highlighted: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  const Icon =
    result.kind === "player" ? User
    : result.kind === "event" ? Calendar
    : result.label === "Practice" ? ClipboardList
    : result.label === "Tryouts" ? Trophy
    : Search;

  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
        highlighted ? "bg-paper" : "hover:bg-paper",
      )}
    >
      <span
        className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
          result.kind === "player" ? "bg-red-soft text-red"
          : result.kind === "event" ? "bg-sky-soft text-sky"
          : "bg-paper-deep text-ink-3",
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[13.5px] truncate">{result.label}</div>
        <div className="text-[11.5px] text-ink-3 truncate">{result.sub}</div>
      </div>
      {highlighted && <ArrowRight className="w-3.5 h-3.5 text-ink-3 shrink-0" />}
    </button>
  );
}

/** buildCorpus — flatten players + events + page shortcuts into a single
 *  searchable list. Page shortcuts come first (so empty-query state shows
 *  them as quick-jumps). */
function buildCorpus(isDemo: boolean): SearchResult[] {
  const pages = isDemo ? PAGE_SHORTCUTS_DEMO : PAGE_SHORTCUTS_APP;
  const players: SearchResult[] = MOCK_PLAYERS.map((p) => ({
    id: `pl-${p.id}`,
    kind: "player",
    label: `${p.firstName} ${p.lastName}`,
    sub: `#${p.jerseyNumber} · ${p.positions.join("/")} · ${p.classYear}`,
    href: `/p/${p.handle}`,
  }));
  const events: SearchResult[] = MOCK_WEEK.map((e, i) => ({
    id: `ev-${i}`,
    kind: "event",
    label: e.title,
    sub: `${e.date.month} ${e.date.day} · ${e.sub}`,
    href: e.tag === "GAME" ? (isDemo ? "/demo/games" : "/app/games") : (isDemo ? "/demo/practice" : "/app/practice"),
  }));
  return [...pages, ...players, ...events];
}

/**
 * scoreMatch — simple multi-token relevance:
 *   +6 if the label starts with the token
 *   +3 if any word in the label starts with the token
 *   +1 if the label or sub contains the token
 * 0 → no match (filtered out).
 */
function scoreMatch(r: SearchResult, tokens: string[]): number {
  let score = 0;
  const label = r.label.toLowerCase();
  const sub = r.sub.toLowerCase();
  const words = label.split(/[\s/·#]+/).filter(Boolean);
  for (const tok of tokens) {
    if (label.startsWith(tok)) {
      score += 6;
      continue;
    }
    let wordMatch = false;
    for (const w of words) {
      if (w.startsWith(tok)) {
        score += 3;
        wordMatch = true;
        break;
      }
    }
    if (wordMatch) continue;
    if (label.includes(tok) || sub.includes(tok)) {
      score += 1;
      continue;
    }
    return 0; // every token must match SOMETHING
  }
  return score;
}
