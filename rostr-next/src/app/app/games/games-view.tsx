"use client";

import { useState } from "react";
import Link from "next/link";
import { Swords, Plus, Bell, MapPin, Clock, ChevronRight, Trash2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TopBar } from "@/components/organisms/top-bar";
import { cn } from "@/lib/utils";
import { comingSoon } from "@/lib/coming-soon";
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
      <TopBar
        breadcrumbs={[{ label: "Lincoln HS" }, { label: "Games" }]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" />, onClick: () => comingSoon("Notifications") },
          { kind: "ghost", label: "Export schedule", onClick: () => comingSoon("Export schedule", "iCal + CSV + GC export — next sprint.") },
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
                Spring &apos;26 season · 12-4 record · 5 upcoming
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

          <div className="bg-card border border-hair rounded-lg overflow-hidden mt-6">
            <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-2">
              <h3 className="font-display text-[15px] font-semibold tracking-tight">Recent results</h3>
              <span className="font-mono text-[10.5px] text-ink-3 font-semibold ml-auto">
                W-L-D 2-1-0
              </span>
            </div>
            <div>
              {past.map((g) => (
                <GameRow key={g.id} game={g} />
              ))}
            </div>
          </div>

          <div className="mt-8 text-center text-[12px] text-ink-3">
            Game-day dugout console + lineup builder coming in the next build.
          </div>
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
        <RowActions
          items={[
            {
              label: "Edit game",
              icon: <Pencil className="w-3.5 h-3.5" />,
              onSelect: () => comingSoon("Edit game", "Inline edit modal ships with dugout console."),
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
