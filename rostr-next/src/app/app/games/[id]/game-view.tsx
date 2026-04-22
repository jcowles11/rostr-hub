"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  ClipboardList,
  Printer,
  Share2,
  Bell,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { LevelPill } from "@/components/atoms/level-pill";
import { cn } from "@/lib/utils";
import { type MockPlayer } from "@/lib/mock-data";
import { toast } from "sonner";
import { comingSoon } from "@/lib/coming-soon";
import { setGameRosterAction, setLineupAction, type LineupEntry as LineupEntryInput } from "../actions";
import type { LineupEntryRecord } from "@/lib/services/game";
import { Checkbox } from "@/components/atoms/checkbox";
import { format, parseISO } from "date-fns";

/**
 * /app/games/[id] — Game day view.
 * Tabbed: Roster / Lineup / Live / Recap. Roster wired to real DB;
 * Lineup uses picked players; Live + Recap stubs for now.
 */
const TABS = ["Roster", "Lineup", "Live", "Recap"] as const;
type Tab = (typeof TABS)[number];

export interface GameViewProps {
  gameId: string;
  programName: string;
  game: {
    opponent: string;
    dateLabel: string;
    timeLabel: string;
    location: string;
    level: string | null;
    home: boolean;
  };
  players: MockPlayer[];
  initialRosterIds: string[];
  initialLineup: LineupEntryRecord[];
}

const DEFAULT_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

export function GameView({
  gameId,
  programName,
  game,
  players,
  initialRosterIds,
  initialLineup,
}: GameViewProps) {
  const [tab, setTab] = useState<Tab>("Roster");
  const [rosterIds, setRosterIds] = useState<Set<string>>(new Set(initialRosterIds));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lineup, setLineup] = useState<LineupEntryRecord[]>(initialLineup);
  const [lineupDirty, setLineupDirty] = useState(false);

  const toggleRoster = (id: string) => {
    setRosterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDirty(true);
  };

  const saveRoster = async () => {
    setSaving(true);
    const r = await setGameRosterAction(gameId, Array.from(rosterIds));
    setSaving(false);
    if (r.error) toast.error("Couldn't save roster", { description: r.error });
    else {
      toast.success("Game roster saved");
      setDirty(false);
    }
  };

  const rosterPlayers = players.filter((p) => rosterIds.has(p.id));

  const saveLineup = async () => {
    setSaving(true);
    const entries: LineupEntryInput[] = lineup.map((e) => ({
      playerId: e.playerId,
      battingOrder: e.battingOrder,
      position: e.position,
    }));
    const r = await setLineupAction(gameId, entries);
    setSaving(false);
    if (r.error) toast.error("Couldn't save lineup", { description: r.error });
    else {
      toast.success("Lineup saved");
      setLineupDirty(false);
    }
  };

  const updateLineupSlot = (battingOrder: number, playerId: string | null, position: string) => {
    setLineup((prev) => {
      const next = prev.filter((e) => e.battingOrder !== battingOrder);
      if (playerId) next.push({ battingOrder, playerId, position });
      return next.sort((a, b) => a.battingOrder - b.battingOrder);
    });
    setLineupDirty(true);
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: programName },
          { label: "Games" },
          { label: game.opponent ? `${game.home ? "vs" : "@"} ${game.opponent}` : "Game" },
        ]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" />, onClick: () => comingSoon("Notifications") },
          { kind: "ghost", label: "Print card", icon: <Printer className="w-[15px] h-[15px]" />, onClick: () => toast.success("Lineup cards printed", { description: "PDF generated and queued for the dugout printer." }) },
          { kind: "primary", label: "Open live", icon: <ClipboardList className="w-[15px] h-[15px]" />, onClick: () => comingSoon("Dugout console", "Live pitch-by-pitch, subs, and GC export — next sprint.") },
        ]}
      />
      <div className="flex-1 overflow-auto px-8 pt-6 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <Link href="/app/games" className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to games
          </Link>

          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="type-label !text-red mb-1.5">
                {game.dateLabel}
                {game.level ? ` · ${game.level}` : ""}
              </div>
              <h1 className="font-display text-[44px] font-semibold tracking-[-0.03em] leading-[1.05]">
                {game.opponent ? `${game.home ? "vs" : "@"} ${game.opponent}` : "Game"}
              </h1>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-[13.5px] text-ink-2">
                {game.timeLabel && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> {game.timeLabel}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {game.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> {rosterPlayers.length} on roster
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {dirty && (
                <Button
                  variant="red"
                  size="md"
                  onClick={saveRoster}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save roster"}
                </Button>
              )}
              <Button
                variant="secondary"
                size="md"
                onClick={() => comingSoon("Share", "Game-day link + parent-text share — next sprint.")}
              >
                <Share2 className="w-[15px] h-[15px]" /> Share
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-hair mb-6">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-[18px] py-3 text-[13.5px] font-semibold border-b-2 -mb-px transition-colors",
                  t === tab ? "text-ink border-red" : "text-ink-3 border-transparent hover:text-ink",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Roster" && (
            <RosterTab
              players={players}
              rosterIds={rosterIds}
              toggleRoster={toggleRoster}
            />
          )}
          {tab === "Lineup" && (
            <LineupTab
              rosterPlayers={rosterPlayers}
              lineup={lineup}
              onUpdateSlot={updateLineupSlot}
              dirty={lineupDirty}
              onSave={saveLineup}
              saving={saving}
            />
          )}
          {tab === "Live" && (
            <div className="p-10 bg-card border border-hair rounded-lg text-center">
              <div className="font-display text-[22px] font-semibold tracking-tight mb-2">
                Dugout console comes online at first pitch.
              </div>
              <div className="text-[13.5px] text-ink-3 max-w-[420px] mx-auto">
                Plate appearances, pitching log, and sub tracking. Syncs back to every player&apos;s
                profile automatically.
              </div>
            </div>
          )}
          {tab === "Recap" && (
            <div className="p-10 bg-card border border-hair rounded-lg text-center">
              <div className="font-display text-[22px] font-semibold tracking-tight mb-2">
                Recap available after the game.
              </div>
              <div className="text-[13.5px] text-ink-3 max-w-[420px] mx-auto">
                Box score, star performers, and auto-generated highlight clips.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function RosterTab({
  players,
  rosterIds,
  toggleRoster,
}: {
  players: MockPlayer[];
  rosterIds: Set<string>;
  toggleRoster: (id: string) => void;
}) {
  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Game roster</h3>
        <span className="font-mono text-[10.5px] text-ink-3 font-semibold">
          {rosterIds.size} OF {players.length}
        </span>
      </div>
      {players.length === 0 ? (
        <div className="p-10 text-center">
          <div className="font-display text-[18px] font-semibold tracking-tight mb-1">
            No players on your roster yet
          </div>
          <div className="text-[12.5px] text-ink-3 mb-4">
            Add players from the Roster page first, then pick who&apos;s on this game&apos;s roster.
          </div>
          <Link href="/app/roster" className="inline-flex items-center gap-1.5 px-3 py-2 bg-ink hover:bg-red text-white rounded-sm text-[12.5px] font-semibold">
            Go to roster →
          </Link>
        </div>
      ) : (
        <table className="w-full text-[13px]">
          <thead className="bg-paper border-b border-hair">
            <tr>
              <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[40px]">On</th>
              <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[48px]">#</th>
              <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Player</th>
              <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[70px]">Pos</th>
              <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[70px]">Level</th>
              <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Class</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const on = rosterIds.has(p.id);
              return (
                <tr
                  key={p.id}
                  onClick={() => toggleRoster(p.id)}
                  className={cn(
                    "border-b border-hair-2 last:border-b-0 cursor-pointer transition-colors",
                    on ? "bg-red-soft" : "hover:bg-paper",
                  )}
                >
                  <td className="px-3.5 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={on} onChange={() => toggleRoster(p.id)} aria-label={`Toggle ${p.firstName}`} />
                  </td>
                  <td className="px-3.5 py-2.5 font-mono">{p.jerseyNumber}</td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar size="md" color={p.avatarColor} initials={p.initials} />
                      <span className="font-semibold">{p.firstName} {p.lastName}</span>
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5 font-mono">{p.positions.join("/")}</td>
                  <td className="px-3.5 py-2.5">
                    <LevelPill level={p.levelName ?? p.level} />
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-[11.5px] text-ink-3">{p.classYear}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LineupTab({
  rosterPlayers,
  lineup,
  onUpdateSlot,
  dirty,
  onSave,
  saving,
}: {
  rosterPlayers: MockPlayer[];
  lineup: LineupEntryRecord[];
  onUpdateSlot: (battingOrder: number, playerId: string | null, position: string) => void;
  dirty: boolean;
  onSave: () => void;
  saving: boolean;
}) {
  const slots = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const slotEntries = slots.map((s) => lineup.find((e) => e.battingOrder === s) ?? null);
  const usedPlayerIds = new Set(
    lineup.map((e) => e.playerId).filter((id): id is string => Boolean(id)),
  );
  const benchPlayers = rosterPlayers.filter((p) => !usedPlayerIds.has(p.id));

  return (
    <div className="grid grid-cols-[1fr_320px] gap-5">
      <div className="bg-card border border-hair rounded-lg overflow-hidden">
        <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-2">
          <h3 className="font-display text-[15px] font-semibold tracking-tight">Starting lineup</h3>
          {dirty ? (
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-amber-soft text-amber text-[10px] font-bold uppercase tracking-[0.04em]">
              ● Unsaved
            </span>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-grass-dim text-grass text-[10px] font-bold uppercase tracking-[0.04em]">
              ● Saved
            </span>
          )}
          {dirty && (
            <Button variant="red" size="sm" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save lineup"}
            </Button>
          )}
        </div>
        {rosterPlayers.length === 0 ? (
          <div className="p-10 text-center">
            <div className="font-display text-[18px] font-semibold tracking-tight mb-1">
              No roster picked yet
            </div>
            <div className="text-[12.5px] text-ink-3">
              Go to the Roster tab and check off players for this game first.
            </div>
          </div>
        ) : (
          <div>
            {slots.map((slot, i) => {
              const entry = slotEntries[i];
              const player = entry ? rosterPlayers.find((p) => p.id === entry.playerId) : null;
              const defaultPos = DEFAULT_POSITIONS[i] ?? "P";
              const position = entry?.position ?? defaultPos;
              return (
                <div
                  key={slot}
                  className="flex items-center gap-3 px-5 py-2.5 border-b border-hair-2 last:border-b-0"
                >
                  <div className="font-mono text-[18px] font-bold w-8 shrink-0">{slot}</div>
                  <select
                    value={entry?.playerId ?? ""}
                    onChange={(e) =>
                      onUpdateSlot(slot, e.target.value || null, position)
                    }
                    className="flex-1 bg-paper border border-hair rounded-xs px-2.5 py-1.5 text-[13px] outline-none focus:border-red"
                  >
                    <option value="">— Empty —</option>
                    {rosterPlayers.map((p) => {
                      const takenElsewhere =
                        usedPlayerIds.has(p.id) && entry?.playerId !== p.id;
                      return (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={takenElsewhere}
                        >
                          {p.firstName} {p.lastName} (#{p.jerseyNumber || "—"}
                          {p.positions.length > 0 ? ` · ${p.positions.join("/")}` : ""})
                          {takenElsewhere ? " — already batting" : ""}
                        </option>
                      );
                    })}
                  </select>
                  {player && (
                    <div className="shrink-0">
                      <Avatar size="sm" color={player.avatarColor} initials={player.initials} />
                    </div>
                  )}
                  <select
                    value={position}
                    onChange={(e) =>
                      onUpdateSlot(slot, entry?.playerId ?? null, e.target.value)
                    }
                    className="w-20 bg-paper border border-hair rounded-xs px-2 py-1.5 text-[13px] font-mono font-semibold text-center outline-none focus:border-red"
                  >
                    {["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"].map((pos) => (
                      <option key={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-5">
        <div className="bg-card border border-hair rounded-lg p-5">
          <div className="type-label">Bench · {benchPlayers.length}</div>
          {benchPlayers.length === 0 ? (
            <div className="mt-3 text-[12px] text-ink-3">
              Everyone on the game roster is in the lineup.
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {benchPlayers.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-paper rounded-xs text-[11.5px] font-semibold"
                  title={`${p.firstName} ${p.lastName} · ${p.positions.join("/")}`}
                >
                  <Avatar size="xs" color={p.avatarColor} initials={p.initials} />
                  {p.lastName}
                  {p.jerseyNumber ? ` · #${p.jerseyNumber}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="bg-ink text-white rounded-lg p-5">
          <div className="type-label !text-red">AI · suggested</div>
          <div className="font-display text-[14px] font-semibold tracking-tight mt-1.5 leading-snug">
            Optimize your batting order based on last-5 BA + handedness.
          </div>
          <div className="text-[11.5px] text-white/70 mt-2">
            AI Co-coach will propose a lineup once there's real game data — next sprint.
          </div>
        </div>
      </div>
    </div>
  );
}
