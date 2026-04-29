"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  ClipboardList,
  Printer,
  Share2,
  Bell,
  Trophy,
  Pencil,
  Radio,
} from "lucide-react";
import { RecordResultModal } from "@/components/organisms/record-result-modal";
import { LinkOpponentModal } from "@/components/organisms/link-opponent-modal";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { LevelPill } from "@/components/atoms/level-pill";
import { SavedPill } from "@/components/atoms/saved-pill";
import { cn } from "@/lib/utils";
import { type MockPlayer } from "@/lib/mock-data";
import { toast } from "sonner";
import { comingSoon } from "@/lib/coming-soon";
import {
  setGameRosterAction,
  setLineupAction,
  updateGamePrepAction,
  type LineupEntry as LineupEntryInput,
} from "../actions";
import type { LineupEntryRecord } from "@/lib/services/game";
import { Checkbox } from "@/components/atoms/checkbox";
import { format, parseISO } from "date-fns";

/**
 * /app/games/[id] — Game day view.
 * Tabbed: Roster / Lineup / Live / Recap. Roster wired to real DB;
 * Lineup uses picked players; Live + Recap stubs for now.
 */
const TABS = ["Prep", "Roster", "Lineup", "Live", "Recap"] as const;
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
    status: string;
    ourScore: number | null;
    opponentScore: number | null;
    result: "W" | "L" | "T" | null;
    recapNotes: string | null;
    opponentProgramId?: string | null;
    liveStatus?: "not_started" | "in_progress" | "final";
    reportTime?: string | null;
    releaseTime?: string | null;
    uniform?: string | null;
    equipmentNotes?: string | null;
    lineupPreview?: string | null;
    prepNotes?: string | null;
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
  const [tab, setTab] = useState<Tab>(
    game.status === "completed" ? "Recap" : "Prep",
  );
  const [rosterIds, setRosterIds] = useState<Set<string>>(new Set(initialRosterIds));
  // useTransition + saveState (driven below) replaces ad-hoc setSaving so
  // every game-page mutation gets the same Saving…→Saved trust signal.
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  useEffect(() => {
    if (isPending) setSaveState("saving");
    else if (saveState === "saving") setSaveState("saved");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);
  const saving = isPending;
  const [dirty, setDirty] = useState(false);
  const [lineup, setLineup] = useState<LineupEntryRecord[]>(initialLineup);
  const [lineupDirty, setLineupDirty] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const toggleRoster = (id: string) => {
    setRosterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDirty(true);
  };

  const saveRoster = () => {
    startTransition(async () => {
      const r = await setGameRosterAction(gameId, Array.from(rosterIds));
      if (r.error) toast.error("Couldn't save roster", { description: r.error });
      else {
        toast.success("Game roster saved");
        setDirty(false);
      }
    });
  };

  const rosterPlayers = players.filter((p) => rosterIds.has(p.id));

  const saveLineup = () => {
    const entries: LineupEntryInput[] = lineup.map((e) => ({
      playerId: e.playerId,
      battingOrder: e.battingOrder,
      position: e.position,
    }));
    startTransition(async () => {
      const r = await setLineupAction(gameId, entries);
      if (r.error) toast.error("Couldn't save lineup", { description: r.error });
      else {
        toast.success("Lineup saved");
        setLineupDirty(false);
      }
    });
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
      {/* Printable lineup card — hidden on screen, shown only in print. */}
      <PrintLineupCard
        programName={programName}
        game={game}
        lineup={lineup}
        rosterPlayers={rosterPlayers}
      />
      <RecordResultModal
        open={recordOpen}
        onOpenChange={setRecordOpen}
        gameId={gameId}
        opponent={game.opponent}
        homeAway={game.home ? "home" : "away"}
        initialOurScore={game.ourScore}
        initialOpponentScore={game.opponentScore}
        initialRecapNotes={game.recapNotes}
      />
      <LinkOpponentModal
        open={linkOpen}
        onOpenChange={setLinkOpen}
        gameId={gameId}
        opponent={game.opponent}
        currentlyLinked={Boolean(game.opponentProgramId)}
      />
      <TopBar
        breadcrumbs={[
          { label: programName },
          { label: "Games" },
          { label: game.opponent ? `${game.home ? "vs" : "@"} ${game.opponent}` : "Game" },
        ]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" />, onClick: () => comingSoon("Notifications") },
          {
            kind: "ghost",
            label: "Print card",
            icon: <Printer className="w-[15px] h-[15px]" />,
            onClick: () => {
              if (typeof window !== "undefined") window.print();
            },
          },
          game.status === "completed"
            ? {
                kind: "primary",
                label: "Edit final",
                icon: <Pencil className="w-[15px] h-[15px]" />,
                onClick: () => setRecordOpen(true),
              }
            : {
                kind: "primary",
                label: "Score live",
                icon: <Radio className="w-[15px] h-[15px]" />,
                href: `/app/games/${gameId}/score`,
              },
          {
            kind: "ghost",
            label: "Record final",
            icon: <Trophy className="w-[15px] h-[15px]" />,
            onClick: () => setRecordOpen(true),
          },
        ]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-8 pt-6 pb-12 print:hidden">
        <div className="max-w-layout-hub mx-auto">
          <Link href="/app/games" className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to games
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <div className="type-label !text-red mb-1.5 inline-flex items-center gap-2">
                {game.dateLabel}
                {game.level ? <>· {game.level}</> : null}
                {/* Trust signal: shows Saving…→Saved on every roster /
                    lineup mutation so coach never wonders "did that go?" */}
                {saveState !== "idle" && <SavedPill state={saveState} />}
                {game.status === "completed" && game.result && (
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-xs text-[10.5px] font-bold tracking-[0.06em]",
                      game.result === "W" && "bg-grass-dim text-grass",
                      game.result === "L" && "bg-red-soft text-red",
                      game.result === "T" && "bg-amber-soft text-amber",
                    )}
                  >
                    Final · {game.result}
                  </span>
                )}
              </div>
              <h1 className="font-display text-[32px] sm:text-[44px] font-semibold tracking-[-0.03em] leading-[1.05]">
                {game.opponent ? `${game.home ? "vs" : "@"} ${game.opponent}` : "Game"}
              </h1>
              {game.status === "completed" &&
                game.ourScore != null &&
                game.opponentScore != null && (
                  <div className="mt-2 font-mono text-[32px] sm:text-[40px] font-semibold tracking-[-0.04em] text-ink">
                    {game.ourScore}
                    <span className="text-ink-4 mx-2">–</span>
                    {game.opponentScore}
                  </div>
                )}
              {game.status !== "completed" && (
                <button
                  onClick={() => setLinkOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-3 hover:text-red"
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                  {game.opponentProgramId
                    ? "Opponent linked on Rostr"
                    : `Is ${game.opponent} on Rostr? Link them →`}
                </button>
              )}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-[13.5px] text-ink-2">
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

          {tab === "Prep" && (
            <PrepTab
              gameId={gameId}
              initial={{
                reportTime: game.reportTime ?? null,
                releaseTime: game.releaseTime ?? null,
                uniform: game.uniform ?? null,
                equipmentNotes: game.equipmentNotes ?? null,
                lineupPreview: game.lineupPreview ?? null,
                prepNotes: game.prepNotes ?? null,
              }}
            />
          )}
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
            <RecapTab
              game={game}
              onRecord={() => setRecordOpen(true)}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ── Prep tab ─────────────────────────────────────────────────
// Game-day prep info: report/release times, uniform, equipment,
// early lineup look, scouting notes. Coaches fill this in so players
// + parents know what to expect. Shown on /me and on each player's
// public schedule.

interface PrepState {
  reportTime: string | null;
  releaseTime: string | null;
  uniform: string | null;
  equipmentNotes: string | null;
  lineupPreview: string | null;
  prepNotes: string | null;
}

function toTimeInput(t: string | null): string {
  if (!t) return "";
  // t looks like "14:30:00" or "14:30"
  return t.slice(0, 5);
}

function PrepTab({ gameId, initial }: { gameId: string; initial: PrepState }) {
  const router = useRouter();
  const [reportTime, setReportTime] = useState(toTimeInput(initial.reportTime));
  const [releaseTime, setReleaseTime] = useState(toTimeInput(initial.releaseTime));
  const [uniform, setUniform] = useState(initial.uniform ?? "");
  const [equipmentNotes, setEquipmentNotes] = useState(initial.equipmentNotes ?? "");
  const [lineupPreview, setLineupPreview] = useState(initial.lineupPreview ?? "");
  const [prepNotes, setPrepNotes] = useState(initial.prepNotes ?? "");
  const [isPending, startTransition] = useTransition();
  const saving = isPending;
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(false);
    startTransition(async () => {
      const r = await updateGamePrepAction({
        gameId,
        reportTime: reportTime || null,
        releaseTime: releaseTime || null,
        uniform: uniform || null,
        equipmentNotes: equipmentNotes || null,
        lineupPreview: lineupPreview || null,
        prepNotes: prepNotes || null,
      });
      if (r.error) {
        toast.error("Couldn't save", { description: r.error });
        return;
      }
      setSaved(true);
      toast.success("Game prep saved · shared with your team");
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
      <div className="bg-card border border-hair rounded-lg overflow-hidden">
        <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-2">
          <h3 className="font-display text-[15px] font-semibold tracking-tight">
            Game-day prep
          </h3>
          <span className="text-[11.5px] text-ink-3 ml-2">
            Shared with every player on their /me page + public profile
          </span>
          {saved && (
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-grass-dim text-grass text-[10px] font-bold uppercase tracking-[0.04em]">
              ● Saved
            </span>
          )}
        </div>
        <div className="p-5 space-y-4">
          {/* Timing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="type-label mb-1.5 block">
                Report time
                <span className="text-ink-4 font-normal normal-case tracking-normal ml-1">
                  (field / bus pickup)
                </span>
              </label>
              <input
                type="time"
                value={reportTime}
                onChange={(e) => setReportTime(e.target.value)}
                className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] font-mono outline-none focus:border-red"
              />
            </div>
            <div>
              <label className="type-label mb-1.5 block">
                Released from class
                <span className="text-ink-4 font-normal normal-case tracking-normal ml-1">
                  (early release time)
                </span>
              </label>
              <input
                type="time"
                value={releaseTime}
                onChange={(e) => setReleaseTime(e.target.value)}
                className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] font-mono outline-none focus:border-red"
              />
            </div>
          </div>

          {/* Uniform */}
          <div>
            <label className="type-label mb-1.5 block">Uniform</label>
            <input
              type="text"
              value={uniform}
              onChange={(e) => setUniform(e.target.value)}
              placeholder="e.g. Home whites · gold belts · black cleats"
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red"
            />
          </div>

          {/* Equipment */}
          <div>
            <label className="type-label mb-1.5 block">Equipment reminders</label>
            <textarea
              value={equipmentNotes}
              onChange={(e) => setEquipmentNotes(e.target.value)}
              rows={2}
              placeholder="Bring own gloves · long sleeves · extra socks"
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red resize-none"
            />
          </div>

          {/* Early lineup preview */}
          <div>
            <label className="type-label mb-1.5 block">Starting lineup preview</label>
            <textarea
              value={lineupPreview}
              onChange={(e) => setLineupPreview(e.target.value)}
              rows={3}
              placeholder="Free text — e.g. 'Jack starting at CF, Marcus batting cleanup. Pitching: Brennan.' Finalize on the Lineup tab."
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red resize-none"
            />
            <p className="text-[10.5px] text-ink-3 mt-1">
              Use the <b>Lineup</b> tab when you&apos;re ready to save the final 9-slot batting order.
            </p>
          </div>

          {/* Free-form prep notes */}
          <div>
            <label className="type-label mb-1.5 block">Other notes</label>
            <textarea
              value={prepNotes}
              onChange={(e) => setPrepNotes(e.target.value)}
              rows={3}
              placeholder="Opponent scouting, travel directions, team dinner, anything else players should know."
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red resize-none"
            />
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button variant="red" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save prep"}
            </Button>
          </div>
        </div>
      </div>

      {/* Right rail: preview card showing what players will see */}
      <div className="flex flex-col gap-5">
        <div className="bg-ink text-white rounded-lg p-5">
          <div className="type-label !text-red mb-2">Player preview</div>
          <div className="font-display text-[14px] font-semibold">
            This is what your players see on /me.
          </div>
          <div className="mt-3 space-y-2 text-[13px]">
            {reportTime && (
              <div className="flex gap-2">
                <span className="text-white/60 w-[88px] shrink-0">Report</span>
                <span className="font-mono font-semibold">{formatTime12(reportTime)}</span>
              </div>
            )}
            {releaseTime && (
              <div className="flex gap-2">
                <span className="text-white/60 w-[88px] shrink-0">Released</span>
                <span className="font-mono font-semibold">{formatTime12(releaseTime)}</span>
              </div>
            )}
            {uniform && (
              <div className="flex gap-2">
                <span className="text-white/60 w-[88px] shrink-0">Uniform</span>
                <span className="font-semibold">{uniform}</span>
              </div>
            )}
            {equipmentNotes && (
              <div className="flex gap-2">
                <span className="text-white/60 w-[88px] shrink-0">Equipment</span>
                <span>{equipmentNotes}</span>
              </div>
            )}
            {lineupPreview && (
              <div className="flex flex-col gap-1">
                <span className="text-white/60">Lineup look</span>
                <span>{lineupPreview}</span>
              </div>
            )}
            {!reportTime && !releaseTime && !uniform && !equipmentNotes && !lineupPreview && (
              <div className="text-white/50 text-[12px] italic">
                Fill anything in on the left and it shows up here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime12(t24: string): string {
  // t24 like "14:30"
  const [hStr, mStr] = t24.split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return t24;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mStr ?? "00"} ${period}`;
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
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] sm:min-w-[560px]">
          <thead className="bg-paper border-b border-hair">
            <tr>
              <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[40px]">On</th>
              <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[48px]">#</th>
              <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Player</th>
              <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[70px] hidden sm:table-cell">Pos</th>
              <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[70px]">Level</th>
              <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 hidden md:table-cell">Class</th>
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
                  <td className="px-3.5 py-2.5 font-mono hidden sm:table-cell">{p.positions.join("/")}</td>
                  <td className="px-3.5 py-2.5">
                    <LevelPill level={p.levelName ?? p.level} />
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-[11.5px] text-ink-3 hidden md:table-cell">{p.classYear}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
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

  // Defensive pitcher = entry with battingOrder 0 (not in batting lineup)
  const defensivePitcherEntry = lineup.find((e) => e.battingOrder === 0) ?? null;
  const defensivePitcher = defensivePitcherEntry
    ? rosterPlayers.find((p) => p.id === defensivePitcherEntry.playerId)
    : null;
  // Does the current lineup use a DH?
  const hasDH = lineup.some((e) => e.battingOrder > 0 && e.position === "DH");

  // Auto-fill: populate 9 slots from the roster with sensible positions.
  // Respects each player's preferred position first, falls back to
  // standard 1-9 defensive assignments.
  const autoFill = () => {
    const take = rosterPlayers.slice(0, 9);
    const used = new Set<string>();
    take.forEach((player, i) => {
      const preferred = player.positions[0];
      let pos: string;
      if (preferred && preferred !== "UT" && preferred !== "OF" && !used.has(preferred)) {
        pos = preferred;
      } else {
        pos = DEFAULT_POSITIONS[i] ?? "DH";
      }
      used.add(pos);
      onUpdateSlot(i + 1, player.id, pos);
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
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
            {lineup.length === 0 && rosterPlayers.length >= 1 && (
              <div className="px-5 py-3 border-b border-hair-2 bg-red-soft/30 flex items-center gap-3">
                <div className="flex-1 text-[12.5px] text-ink-2">
                  Want a starting point?{" "}
                  <b className="text-ink">Auto-fill</b> uses each player&apos;s
                  preferred position — you can rearrange after.
                </div>
                <Button variant="red" size="sm" onClick={autoFill}>
                  Auto-fill lineup
                </Button>
              </div>
            )}
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
            {/* Defensive pitcher slot: shown whenever any batter is DH.
                Saved with batting_order=0 so it doesn't pollute the
                9-slot batting lineup but still persists. */}
            {hasDH && (
              <div className="flex items-center gap-3 px-5 py-2.5 bg-paper border-t-2 border-red/30">
                <div className="font-mono text-[11px] font-bold w-8 shrink-0 text-red uppercase tracking-widest">
                  P
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-red mb-0.5">
                    Defensive pitcher · not batting (DH hits for this slot)
                  </div>
                  <select
                    value={defensivePitcherEntry?.playerId ?? ""}
                    onChange={(e) => onUpdateSlot(0, e.target.value || null, "P")}
                    className="w-full bg-card border border-hair rounded-xs px-2.5 py-1.5 text-[13px] outline-none focus:border-red"
                  >
                    <option value="">— Select pitcher —</option>
                    {rosterPlayers.map((p) => {
                      const takenInLineup = usedPlayerIds.has(p.id);
                      return (
                        <option key={p.id} value={p.id} disabled={takenInLineup}>
                          {p.firstName} {p.lastName} (#{p.jerseyNumber || "—"}
                          {p.positions.length > 0 ? ` · ${p.positions.join("/")}` : ""})
                          {takenInLineup ? " — in batting lineup" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {defensivePitcher && (
                  <Avatar
                    size="sm"
                    color={defensivePitcher.avatarColor}
                    initials={defensivePitcher.initials}
                  />
                )}
              </div>
            )}
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
            AI Assistant Coach will propose a lineup once there&apos;s real game data — next sprint.
          </div>
        </div>
      </div>
    </div>
  );
}

function RecapTab({
  game,
  onRecord,
}: {
  game: GameViewProps["game"];
  onRecord: () => void;
}) {
  if (game.status !== "completed" || game.ourScore == null || game.opponentScore == null) {
    return (
      <div className="p-10 bg-card border border-dashed border-hair rounded-lg text-center">
        <div className="inline-flex w-12 h-12 rounded-full bg-red-soft text-red items-center justify-center mb-3">
          <Trophy className="w-6 h-6" />
        </div>
        <div className="font-display text-[22px] font-semibold tracking-tight mb-2">
          Record the final
        </div>
        <div className="text-[13.5px] text-ink-3 max-w-[440px] mx-auto mb-4">
          Once you enter the score, it flows into the team&apos;s record on
          your Hub and the Activity feed. Full per-player box score lands in a
          future sprint.
        </div>
        <Button variant="primary" size="md" onClick={onRecord}>
          <Trophy className="w-[15px] h-[15px]" /> Record final
        </Button>
      </div>
    );
  }

  const resultLabel = game.result === "W" ? "Win" : game.result === "L" ? "Loss" : "Tie";
  const resultBg =
    game.result === "W" ? "bg-grass-dim text-grass" :
    game.result === "L" ? "bg-red-soft text-red" :
    "bg-amber-soft text-amber";

  return (
    <div className="space-y-5">
      <div className="bg-card border border-hair rounded-lg p-6 sm:p-8 text-center">
        <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-xs text-[11px] font-bold tracking-[0.08em] uppercase", resultBg)}>
          <Trophy className="w-3 h-3" /> {resultLabel}
        </div>
        <div className="mt-4 flex items-baseline justify-center gap-6">
          <div className="text-center">
            <div className="font-mono text-[56px] sm:text-[72px] font-bold tracking-[-0.05em] leading-none">
              {game.ourScore}
            </div>
            <div className="text-[11px] font-bold text-ink-3 uppercase tracking-[0.08em] mt-2">
              {game.home ? "Home · Us" : "Us"}
            </div>
          </div>
          <div className="font-mono text-[28px] text-ink-4 self-center">–</div>
          <div className="text-center">
            <div className="font-mono text-[56px] sm:text-[72px] font-bold tracking-[-0.05em] leading-none text-ink-3">
              {game.opponentScore}
            </div>
            <div className="text-[11px] font-bold text-ink-3 uppercase tracking-[0.08em] mt-2">
              {game.opponent ?? "Opponent"}
            </div>
          </div>
        </div>
        <div className="mt-6 text-[11.5px] text-ink-3 font-mono">
          {game.dateLabel}
          {game.level ? ` · ${game.level}` : ""}
        </div>
      </div>

      {game.recapNotes && (
        <div className="bg-card border border-hair rounded-lg p-6">
          <div className="type-label mb-2">Coach notes</div>
          <div className="text-[13.5px] leading-relaxed text-ink whitespace-pre-wrap">
            {game.recapNotes}
          </div>
        </div>
      )}

      <div className="text-center">
        <button
          onClick={onRecord}
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-ink font-semibold px-2 py-1"
        >
          <Pencil className="w-3 h-3" /> Edit this final
        </button>
      </div>
    </div>
  );
}

/**
 * PrintLineupCard — dugout-friendly lineup sheet.
 * Hidden on screen; visible only when the user hits Cmd/Ctrl-P or the
 * Print card action in the top bar. Two copies per page — one for the
 * dugout wall and one for the home-plate meeting.
 */
function PrintLineupCard({
  programName,
  game,
  lineup,
  rosterPlayers,
}: {
  programName: string;
  game: GameViewProps["game"];
  lineup: LineupEntryRecord[];
  rosterPlayers: MockPlayer[];
}) {
  const slots = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const byOrder = new Map(lineup.map((e) => [e.battingOrder, e]));
  const playerMap = new Map(rosterPlayers.map((p) => [p.id, p]));
  const usedIds = new Set(lineup.map((e) => e.playerId));
  const bench = rosterPlayers.filter((p) => !usedIds.has(p.id));

  const Card = (
    <div className="print-card w-full border border-black p-4 mb-5 break-inside-avoid">
      <div className="flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold">
            {programName}
          </div>
          <div className="text-[22px] font-bold leading-tight mt-0.5">
            {game.home ? "vs" : "@"} {game.opponent || "Opponent"}
          </div>
          <div className="text-[11px] mt-0.5">
            {game.dateLabel}
            {game.timeLabel ? ` · ${game.timeLabel}` : ""}
            {game.location ? ` · ${game.location}` : ""}
            {game.level ? ` · ${game.level}` : ""}
          </div>
        </div>
        <div className="text-[9px] uppercase tracking-[0.15em] font-bold text-right">
          Lineup card
          <br />
          <span className="font-normal">
            {new Date().toLocaleDateString()}
          </span>
        </div>
      </div>

      <table className="w-full mt-3 text-[12px] border-collapse">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-1 w-[32px] font-bold">#</th>
            <th className="text-left py-1 w-[48px] font-bold">Jsy</th>
            <th className="text-left py-1 font-bold">Player</th>
            <th className="text-left py-1 w-[56px] font-bold">Pos</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => {
            const entry = byOrder.get(s);
            const p = entry ? playerMap.get(entry.playerId) : null;
            return (
              <tr key={s} className="border-b border-neutral-400">
                <td className="py-1.5 font-bold">{s}</td>
                <td className="py-1.5 font-mono">
                  {p?.jerseyNumber ?? ""}
                </td>
                <td className="py-1.5">
                  {p ? `${p.lastName}, ${p.firstName}` : "—"}
                </td>
                <td className="py-1.5 font-mono font-bold">
                  {entry?.position ?? ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {bench.length > 0 && (
        <div className="mt-3 pt-2 border-t border-black">
          <div className="text-[9px] uppercase tracking-[0.15em] font-bold mb-1">
            Bench ({bench.length})
          </div>
          <div className="text-[11px]">
            {bench
              .map((p) => `${p.lastName}${p.jerseyNumber ? ` #${p.jerseyNumber}` : ""}`)
              .join(" · ")}
          </div>
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-neutral-300 grid grid-cols-2 gap-2 text-[9px] uppercase tracking-[0.12em]">
        <div>
          Coach: ______________________
        </div>
        <div>
          Umpire: _____________________
        </div>
      </div>
    </div>
  );

  return (
    <div className="hidden print:block print-root fixed inset-0 bg-white text-black z-[9999] p-6 overflow-auto">
      {Card}
      {Card}
    </div>
  );
}
