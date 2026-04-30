"use client";

import { useState } from "react";
import Link from "next/link";
import { Swords, Plus, MapPin, Clock, ChevronRight, Trash2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TopBar } from "@/components/organisms/top-bar";
import { cn } from "@/lib/utils";
import { AddEventModal } from "@/components/organisms/add-event-modal";
import { RowActions } from "@/components/molecules/row-actions";
import { deleteGameAction } from "./actions";

export interface Game {
  id: string;
  date: { day: number; month: string; year?: number };
  time: string;
  opponent: string;
  home: boolean;
  location: string;
  status: "upcoming" | "final" | "live" | "postponed";
  result?: { us: number; them: number };
  tag?: "conference" | "tournament" | "scrimmage";
}

export function GamesView({ games: GAMES }: { games: Game[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const upcoming = GAMES.filter((g) => g.status === "upcoming");
  const past = GAMES.filter((g) => g.status === "final");

  return (
    <>
      {/* PHASE 5 — removed Notifications bell (no real notifications
          feature) and "Export schedule" comingSoon button. Hardcoded
          "Lincoln HS" breadcrumb removed too — was leaking demo data
          into real coaches' headers. */}
      <TopBar
        breadcrumbs={[{ label: "Games" }]}
        actions={[
          { kind: "primary", label: "Add game", icon: <Plus className="w-[15px] h-[15px]" />, onClick: () => setAddOpen(true) },
        ]}
      />
      <div className="flex-1 overflow-auto px-8 pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div className="flex items-end justify-between mb-7">
            <div>
              <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
                Games
              </h1>
              <p className="text-[13.5px] text-ink-3 mt-1">
                {summarizeHeader(GAMES, upcoming, past)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-paper-deep p-1 rounded-sm">
                <button className="px-3 py-1.5 bg-card text-ink rounded-xs shadow-card text-[12px] font-semibold">
                  Upcoming
                </button>
                <button className="px-3 py-1.5 text-ink-3 hover:text-ink rounded-xs text-[12px] font-semibold">
                  Past
                </button>
                <button className="px-3 py-1.5 text-ink-3 hover:text-ink rounded-xs text-[12px] font-semibold">
                  All
                </button>
              </div>
            </div>
          </div>

          {GAMES.length === 0 ? (
            <div className="bg-card border border-dashed border-hair rounded-lg p-10 text-center">
              <h3 className="font-display text-[18px] font-semibold tracking-tight">
                No games scheduled yet
              </h3>
              <p className="text-[13px] text-ink-3 mt-2 max-w-[440px] mx-auto leading-relaxed">
                Add your first game and you&apos;ll be able to set the
                roster, build the lineup, post game-day prep notes, and
                score the game live from the dugout.
              </p>
              <button
                onClick={() => setAddOpen(true)}
                className="mt-5 px-4 py-2 bg-red text-white rounded-sm text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-red/90"
              >
                <Plus className="w-3.5 h-3.5" /> Schedule your first game
              </button>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div className="bg-card border border-hair rounded-lg overflow-hidden">
                  <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-2">
                    <h3 className="font-display text-[15px] font-semibold tracking-tight">Upcoming</h3>
                    <span className="font-mono text-[10.5px] text-ink-3 font-semibold ml-auto">
                      {upcoming.length} GAMES
                    </span>
                  </div>
                  <div>
                    {upcoming.map((g) => (
                      <GameRow key={g.id} game={g} />
                    ))}
                  </div>
                </div>
              )}

              {past.length > 0 && (
                <div className={cn("bg-card border border-hair rounded-lg overflow-hidden", upcoming.length > 0 && "mt-6")}>
                  <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-2">
                    <h3 className="font-display text-[15px] font-semibold tracking-tight">Recent results</h3>
                    <span className="font-mono text-[10.5px] text-ink-3 font-semibold ml-auto">
                      {summarizeRecord(past)}
                    </span>
                  </div>
                  <div>
                    {past.map((g) => (
                      <GameRow key={g.id} game={g} />
                    ))}
                  </div>
                </div>
              )}

              {/* Edge case: only upcoming + zero finals (or vice versa) — show
                  a soft hint for the missing half so the page never looks broken. */}
              {upcoming.length === 0 && past.length > 0 && (
                <div className="mt-6 bg-paper-deep border border-dashed border-hair rounded-lg p-4 text-center text-[12.5px] text-ink-3">
                  No upcoming games. Add the next one when you&apos;re ready.
                </div>
              )}
              {past.length === 0 && upcoming.length > 0 && (
                <div className="mt-6 bg-paper-deep border border-dashed border-hair rounded-lg p-4 text-center text-[12.5px] text-ink-3">
                  No completed games yet. Scores show up here after you record results.
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <AddEventModal open={addOpen} onOpenChange={setAddOpen} initialKind="game" />
    </>
  );
}

function GameRow({ game }: { game: Game }) {
  const router = useRouter();
  const isFinal = game.status === "final";
  const won = isFinal && game.result && game.result.us > game.result.them;
  const lost = isFinal && game.result && game.result.us < game.result.them;

  return (
    <Link
      href={`/app/games/${game.id}`}
      className="flex items-center gap-4 px-[18px] py-3 border-b border-hair-2 last:border-b-0 hover:bg-paper transition-colors"
    >
      <div className="w-[52px] text-center shrink-0">
        <div className="font-display text-[22px] font-semibold tracking-[-0.02em] leading-none">
          {game.date.day}
        </div>
        <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.08em] mt-0.5">
          {game.date.month}
        </div>
      </div>
      <div className="w-7 h-7 rounded-xs bg-red-soft text-red flex items-center justify-center shrink-0">
        <Swords className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold flex items-center gap-2">
          {game.home ? "vs" : "@"} {game.opponent}
          {game.tag === "conference" && (
            <span className="text-[10px] font-bold text-red tracking-[0.06em] uppercase">
              · Conference
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2.5 text-[11.5px] text-ink-3">
          {game.time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {game.time}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {game.location}
          </span>
        </div>
      </div>
      {isFinal && game.result && (
        <div
          className={cn(
            "px-3 py-1.5 rounded-xs text-[13px] font-bold font-mono",
            won && "bg-grass-dim text-grass",
            lost && "bg-red-soft text-red",
            !won && !lost && "bg-paper-deep text-ink-2",
          )}
        >
          {won ? "W " : lost ? "L " : "T "}
          {game.result.us}-{game.result.them}
        </div>
      )}
      <div onClick={(e) => e.stopPropagation()}>
        {/* PHASE 5 — replaced "Edit game" comingSoon with a route to
            /app/schedule, which has the working EditEventModal. Avoids
            duplicating the modal here while keeping a clear path. */}
        <RowActions
          items={[
            {
              label: "Edit on Schedule",
              icon: <Pencil className="w-3.5 h-3.5" />,
              onSelect: () => router.push("/app/schedule"),
            },
            {
              label: "Delete game",
              icon: <Trash2 className="w-3.5 h-3.5" />,
              danger: true,
              onSelect: async () => {
                if (!confirm(`Delete ${game.home ? "vs" : "@"} ${game.opponent}?`)) return;
                const r = await deleteGameAction(game.id);
                if (r.error) toast.error("Couldn't delete", { description: r.error });
                else {
                  toast.success("Game deleted");
                  router.refresh();
                }
              },
            },
          ]}
        />
      </div>
      <ChevronRight className="w-4 h-4 text-ink-4 shrink-0" />
    </Link>
  );
}

/**
 * summarizeRecord — "W-L-D 8-3-0" from a list of finalized games.
 * Replaces the previous hardcoded "W-L-D 2-1-0" placeholder so a real
 * coach's record reflects what they've actually played.
 */
function summarizeRecord(past: Game[]): string {
  let w = 0, l = 0, d = 0;
  for (const g of past) {
    if (!g.result) continue;
    if (g.result.us > g.result.them) w++;
    else if (g.result.us < g.result.them) l++;
    else d++;
  }
  return `W-L-D ${w}-${l}-${d}`;
}

/**
 * summarizeHeader — page-title sub-line. Computes the season + record +
 * upcoming count from the actual games array. Replaces the previously
 * hardcoded "Spring '26 season · 12-4 record · 5 upcoming" string that
 * a real coach with a fresh account would have seen as a confusing lie.
 */
function summarizeHeader(all: Game[], upcoming: Game[], past: Game[]): string {
  if (all.length === 0) return "No games scheduled yet";
  let w = 0, l = 0, d = 0;
  for (const g of past) {
    if (!g.result) continue;
    if (g.result.us > g.result.them) w++;
    else if (g.result.us < g.result.them) l++;
    else d++;
  }
  const recordPart = past.length > 0 ? `${w}-${l}${d > 0 ? `-${d}` : ""} record` : null;
  const upcomingPart =
    upcoming.length === 0 ? "no upcoming" : `${upcoming.length} upcoming`;
  return [recordPart, upcomingPart].filter(Boolean).join(" · ");
}
