"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Settings,
  Users,
  BarChart3,
  CheckSquare,
  Bell,
  Download,
  Play,
  Pause,
  Trash2,
  Plus,
  ArrowLeft,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { Checkbox } from "@/components/atoms/checkbox";
import { cn } from "@/lib/utils";
import { comingSoon } from "@/lib/coming-soon";
import type {
  Tryout,
  TryoutStation,
  TryoutAttendee,
  TryoutScore,
  Verdict,
} from "@/lib/services/tryouts";
import type { RealPlayer } from "@/lib/services/players";
import {
  setAttendeesAction,
  createStationAction,
  deleteStationAction,
  toggleStationStatusAction,
  setVerdictAction,
  applyVerdictsToRosterAction,
  setTryoutStatusAction,
} from "../actions";

/**
 * TryoutView — client view for /app/tryouts/[id].
 * 4 tabs: Setup, Players, Live rankings, Decide.
 * Scores flow in from station coaches on phones.
 */
const TABS = [
  { key: "setup", label: "Setup", icon: Settings },
  { key: "players", label: "Players", icon: Users },
  { key: "live", label: "Live rankings", icon: BarChart3 },
  { key: "decide", label: "Decide", icon: CheckSquare },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export interface TryoutViewProps {
  programName: string;
  programLevels: string[];
  tryout: Tryout;
  stations: TryoutStation[];
  attendees: TryoutAttendee[];
  scores: TryoutScore[];
  roster: RealPlayer[];
}

export function TryoutView({
  programName,
  programLevels,
  tryout,
  stations,
  attendees,
  scores,
  roster,
}: TryoutViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(
    tryout.status === "complete" ? "decide" : tryout.status === "live" ? "live" : "setup",
  );

  const attendeeMap = useMemo(
    () => new Map(attendees.map((a) => [a.playerId, a])),
    [attendees],
  );
  const attendeePlayers = useMemo(
    () => roster.filter((p) => attendeeMap.has(p.id) && attendeeMap.get(p.id)!.attended),
    [roster, attendeeMap],
  );

  const decidedCount = attendees.filter((a) => a.verdict).length;
  const cutCount = attendees.filter((a) => a.verdict === "cut").length;
  // "Keep" = any verdict that places the player on a team (lock or a
  // non-special team name — not cut, not bubble, not null).
  const keepCount = attendees.filter((a) => {
    const v = a.verdict?.toLowerCase();
    return Boolean(v) && v !== "cut" && v !== "bubble";
  }).length;

  const toggleLive = async () => {
    const next = tryout.status === "live" ? "complete" : "live";
    const r = await setTryoutStatusAction(tryout.id, next);
    if (r.error) toast.error("Couldn't update status", { description: r.error });
    else {
      toast.success(next === "live" ? "Tryout is live" : "Tryout closed");
      router.refresh();
    }
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: programName },
          { label: "Tryouts" },
          { label: tryout.name },
        ]}
        actions={[
          // PHASE 5 — removed Notifications bell + Export comingSoon
          // (no real CSV export wired yet).
          tryout.status === "scheduled"
            ? {
                kind: "primary",
                label: "Start tryout",
                icon: <Play className="w-[15px] h-[15px]" />,
                onClick: toggleLive,
              }
            : tryout.status === "live"
              ? {
                  kind: "primary",
                  label: "End tryout",
                  icon: <CheckCircle2 className="w-[15px] h-[15px]" />,
                  onClick: toggleLive,
                }
              : {
                  kind: "primary",
                  label: "Reopen",
                  icon: <Play className="w-[15px] h-[15px]" />,
                  onClick: async () => {
                    const r = await setTryoutStatusAction(tryout.id, "live");
                    if (!r.error) router.refresh();
                  },
                },
        ]}
      />

      {/* Tabs row */}
      <div className="px-4 sm:px-8 pt-4 bg-card border-b border-hair flex gap-0.5 items-end sticky top-14 z-sticky overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const count =
            t.key === "players"
              ? attendees.length
              : t.key === "live"
                ? `${scores.length} scores`
                : t.key === "decide"
                  ? `${decidedCount} / ${attendees.length}`
                  : stations.length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-3 sm:px-[18px] py-2.5 -mb-px text-[13px] font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0",
                t.key === tab
                  ? "text-ink border-red"
                  : "text-ink-3 border-transparent hover:text-ink",
              )}
            >
              <Icon className="w-[15px] h-[15px]" />
              <span className="hidden sm:inline">{t.label}</span>
              <span
                className={cn(
                  "font-mono text-[10.5px] px-1.5 py-0.5 rounded-[4px] font-semibold",
                  t.key === tab ? "bg-red text-white" : "bg-paper-deep text-ink-2",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
        <div className="flex-1" />
        {tryout.status === "live" && (
          <div className="mb-2 hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-soft text-red rounded-full text-[11px] font-bold uppercase tracking-[0.06em]">
            <span className="w-2 h-2 rounded-full bg-red animate-pulse-live" />
            Live
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-12">
        <div className="max-w-layout-app mx-auto">
          <Link
            href="/app/tryouts"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to tryouts
          </Link>

          {tab === "setup" && (
            <SetupTab tryout={tryout} stations={stations} onChange={() => router.refresh()} />
          )}
          {tab === "players" && (
            <PlayersTab
              tryout={tryout}
              roster={roster}
              attendees={attendees}
              onSaved={() => router.refresh()}
            />
          )}
          {tab === "live" && (
            <LiveRankingsTab
              tryout={tryout}
              stations={stations}
              scores={scores}
              attendeePlayers={attendeePlayers}
            />
          )}
          {tab === "decide" && (
            <DecideTab
              tryout={tryout}
              stations={stations}
              scores={scores}
              attendees={attendees}
              attendeePlayers={attendeePlayers}
              keepCount={keepCount}
              cutCount={cutCount}
              programLevels={programLevels}
              onChange={() => router.refresh()}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Setup tab
// ─────────────────────────────────────────────────────────────────

function SetupTab({
  tryout,
  stations,
  onChange,
}: {
  tryout: Tryout;
  stations: TryoutStation[];
  onChange: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [unit, setUnit] = useState("");
  const [scoreType, setScoreType] = useState<"lower_better" | "higher_better" | "rating">(
    "higher_better",
  );
  const [isPending, startTransition] = useTransition();
  const saving = isPending;

  const addStation = () => {
    if (!name.trim() || !shortCode.trim()) return;
    startTransition(async () => {
      const r = await createStationAction({
        tryoutId: tryout.id,
        name,
        shortCode,
        unit: unit || null,
        scoreType,
      });
      if (r.error) {
        toast.error("Couldn't add station", { description: r.error });
        return;
      }
      toast.success(`Added ${name}`);
      setName("");
      setShortCode("");
      setUnit("");
      setScoreType("higher_better");
      setShowAdd(false);
      onChange();
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
      <div className="bg-card border border-hair rounded-lg">
        <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-3">
          <h3 className="font-display text-[15px] font-semibold tracking-tight">
            Stations
          </h3>
          <span className="font-mono text-[11px] text-ink-3 font-semibold">
            {stations.length}
          </span>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 bg-ink text-white rounded-sm text-[12px] font-semibold hover:bg-red"
          >
            <Plus className="w-3 h-3" /> Add station
          </button>
        </div>
        {showAdd && (
          <div className="px-[18px] py-3 border-b border-hair-2 bg-paper">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Station name (e.g. Pop time)"
                className="bg-card border border-hair rounded-sm px-2.5 py-1.5 text-[13px] outline-none focus:border-red"
              />
              <input
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                placeholder="Short code (e.g. Pop)"
                className="bg-card border border-hair rounded-sm px-2.5 py-1.5 text-[13px] outline-none focus:border-red"
              />
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Unit (s, mph, —)"
                className="bg-card border border-hair rounded-sm px-2.5 py-1.5 text-[13px] font-mono outline-none focus:border-red"
              />
              <select
                value={scoreType}
                onChange={(e) =>
                  setScoreType(e.target.value as "lower_better" | "higher_better" | "rating")
                }
                className="bg-card border border-hair rounded-sm px-2.5 py-1.5 text-[13px] outline-none focus:border-red"
              >
                <option value="higher_better">Higher = better (velo, distance)</option>
                <option value="lower_better">Lower = better (time)</option>
                <option value="rating">Rating 1–5 (subjective)</option>
              </select>
            </div>
            <div className="mt-2 flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAdd(false);
                  setName("");
                  setShortCode("");
                  setUnit("");
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={addStation} disabled={saving}>
                {saving ? "Adding…" : "Add"}
              </Button>
            </div>
          </div>
        )}
        {stations.length === 0 ? (
          <div className="p-10 text-center">
            <div className="font-display text-[18px] font-semibold tracking-tight mb-1">
              No stations yet
            </div>
            <div className="text-[12.5px] text-ink-3">
              Add at least one station so coaches can start scoring.
            </div>
          </div>
        ) : (
          <div>
            {stations.map((s) => (
              <StationRow
                key={s.id}
                tryoutId={tryout.id}
                station={s}
                onChange={onChange}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <div className="bg-card border border-hair rounded-lg p-5">
          <h3 className="font-display text-[15px] font-semibold tracking-tight">
            Tryout details
          </h3>
          <div className="mt-3 space-y-2 text-[13px]">
            <KV label="Name" v={tryout.name} />
            <KV label="Starts" v={tryout.startDate} mono />
            {tryout.endDate && <KV label="Ends" v={tryout.endDate} mono />}
            <KV
              label="Status"
              v={
                tryout.status === "live"
                  ? "Live"
                  : tryout.status === "complete"
                    ? "Complete"
                    : "Scheduled"
              }
            />
            {tryout.varsityTarget && <KV label="V target" v={String(tryout.varsityTarget)} mono />}
            {tryout.jvTarget && <KV label="JV target" v={String(tryout.jvTarget)} mono />}
          </div>
          {tryout.notes && (
            <div className="mt-3 p-3 bg-paper rounded-sm text-[12.5px] text-ink-2 border-l-[3px] border-l-red">
              {tryout.notes}
            </div>
          )}
        </div>
        <div className="bg-ink text-white rounded-lg p-5">
          <div className="type-label !text-red mb-1">Station coaches · phone mode</div>
          <div className="font-display text-[15px] font-semibold tracking-tight leading-snug">
            Each station has a scoring link. Share it with your assistant — they open it
            on their phone, tap a player, punch the number, done.
          </div>
          <div className="mt-2 text-[11.5px] text-white/70">
            No sign-in friction. Every score is attributed to the logged-in coach.
          </div>
        </div>
      </div>
    </div>
  );
}

function StationRow({
  tryoutId,
  station,
  onChange,
}: {
  tryoutId: string;
  station: TryoutStation;
  onChange: () => void;
}) {
  const typeLabel =
    station.scoreType === "lower_better"
      ? "Time (lower wins)"
      : station.scoreType === "higher_better"
        ? "Velo (higher wins)"
        : "Rating 1–5";
  const pct = station.total > 0 ? Math.round((station.progress / station.total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 px-[18px] py-3 border-b border-hair-2 last:border-b-0">
      <div
        className={cn(
          "w-9 h-9 rounded-xs flex items-center justify-center text-[11px] font-bold text-white shrink-0",
          station.status === "active" ? "bg-red" : "bg-ink-4",
        )}
      >
        {station.shortCode.slice(0, 3).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-display text-[14px] font-semibold truncate">{station.name}</div>
          <span className="font-mono text-[10px] text-ink-3">
            · {typeLabel}
            {station.unit ? ` · ${station.unit}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-ink-3">
          <span className="font-mono">
            {station.progress} / {station.total || "?"} scored · {pct}%
          </span>
          <div className="flex-1 h-1 bg-paper-deep rounded-full overflow-hidden max-w-[160px]">
            <div
              className={cn("h-full", station.status === "active" ? "bg-red" : "bg-ink-4")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
      <Link
        href={`/app/tryouts/${tryoutId}/station/${station.id}`}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-paper hover:bg-paper-deep text-ink rounded-xs text-[11.5px] font-semibold"
      >
        <Smartphone className="w-3.5 h-3.5" />
        Score
      </Link>
      <button
        onClick={async () => {
          const next = station.status === "active" ? "paused" : "active";
          const r = await toggleStationStatusAction(station.id, tryoutId, next);
          if (!r.error) onChange();
        }}
        className="p-1.5 rounded-xs text-ink-3 hover:text-ink hover:bg-paper"
        aria-label={station.status === "active" ? "Pause station" : "Resume station"}
      >
        {station.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={async () => {
          if (!confirm(`Delete station "${station.name}" and all its scores?`)) return;
          const r = await deleteStationAction(station.id, tryoutId);
          if (r.error) toast.error("Couldn't delete", { description: r.error });
          else {
            toast.success("Station deleted");
            onChange();
          }
        }}
        className="p-1.5 rounded-xs text-ink-3 hover:text-red hover:bg-red-soft"
        aria-label="Delete station"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function KV({ label, v, mono }: { label: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 w-[72px] shrink-0">
        {label}
      </span>
      <span className={cn("font-semibold", mono && "font-mono")}>{v}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Players tab (attendees)
// ─────────────────────────────────────────────────────────────────

function PlayersTab({
  tryout,
  roster,
  attendees,
  onSaved,
}: {
  tryout: Tryout;
  roster: RealPlayer[];
  attendees: TryoutAttendee[];
  onSaved: () => void;
}) {
  const initial = new Set(attendees.filter((a) => a.attended).map((a) => a.playerId));
  const [selected, setSelected] = useState<Set<string>>(initial);
  const [isPending, startTransition] = useTransition();
  const saving = isPending;
  const dirty = useMemo(() => {
    if (selected.size !== initial.size) return true;
    const ids = Array.from(selected);
    for (const id of ids) if (!initial.has(id)) return true;
    return false;
  }, [selected, initial]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = () => {
    startTransition(async () => {
      const r = await setAttendeesAction(tryout.id, Array.from(selected));
      if (r.error) toast.error("Couldn't save attendees", { description: r.error });
      else {
        toast.success(`${selected.size} players registered`);
        onSaved();
      }
    });
  };

  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-3">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Registered attendees
        </h3>
        <span className="font-mono text-[11px] text-ink-3 font-semibold">
          {selected.size} of {roster.length}
        </span>
        {dirty && (
          <Button variant="red" size="sm" onClick={save} disabled={saving} className="ml-auto">
            {saving ? "Saving…" : "Save attendees"}
          </Button>
        )}
      </div>
      {roster.length === 0 ? (
        <div className="p-10 text-center">
          <div className="font-display text-[18px] font-semibold tracking-tight mb-1">
            No players on your roster yet
          </div>
          <div className="text-[12.5px] text-ink-3 mb-4">
            Add players from the Roster page first, then come back to register them.
          </div>
          <Link
            href="/app/roster"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-ink hover:bg-red text-white rounded-sm text-[12.5px] font-semibold"
          >
            Go to roster →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-paper border-b border-hair">
              <tr>
                <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[40px]">
                  On
                </th>
                <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[48px]">
                  #
                </th>
                <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
                  Player
                </th>
                <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[80px] hidden sm:table-cell">
                  Pos
                </th>
                <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[70px] hidden md:table-cell">
                  Class
                </th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => {
                const on = selected.has(p.id);
                return (
                  <tr
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "border-b border-hair-2 last:border-b-0 cursor-pointer transition-colors",
                      on ? "bg-red-soft" : "hover:bg-paper",
                    )}
                  >
                    <td className="px-3.5 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={on} onChange={() => toggle(p.id)} aria-label="Toggle" />
                    </td>
                    <td className="px-3.5 py-2.5 font-mono">{p.jerseyNumber || "—"}</td>
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar size="md" color={p.avatarColor} initials={p.initials} />
                        <span className="font-semibold">
                          {p.firstName} {p.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono hidden sm:table-cell">
                      {p.positions.join("/") || "—"}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[11.5px] text-ink-3 hidden md:table-cell">
                      {p.classYear}
                    </td>
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

// ─────────────────────────────────────────────────────────────────
// Live rankings tab
// ─────────────────────────────────────────────────────────────────

function LiveRankingsTab({
  stations,
  scores,
  attendeePlayers,
}: {
  tryout: Tryout;
  stations: TryoutStation[];
  scores: TryoutScore[];
  attendeePlayers: RealPlayer[];
}) {
  // Compute overall rank: z-score per station, sum, rank desc.
  const rows = useMemo(
    () => computeRankings(attendeePlayers, stations, scores),
    [attendeePlayers, stations, scores],
  );

  if (attendeePlayers.length === 0) {
    return (
      <div className="bg-card border border-dashed border-hair rounded-lg p-10 text-center">
        <div className="font-display text-[18px] font-semibold tracking-tight">
          Register attendees first
        </div>
        <div className="text-[12.5px] text-ink-3 mt-1">
          Head to the Players tab and select who is trying out.
        </div>
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="bg-card border border-dashed border-hair rounded-lg p-10 text-center">
        <div className="font-display text-[18px] font-semibold tracking-tight">
          Add at least one station
        </div>
        <div className="text-[12.5px] text-ink-3 mt-1">
          Coaches score per station — rankings appear here as scores roll in.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-3">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Overall ranking
        </h3>
        <span className="font-mono text-[11px] text-ink-3 font-semibold ml-auto">
          {scores.length} scores · {stations.length} stations
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-paper border-b border-hair">
            <tr>
              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[60px]">
                Rank
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
                Player
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[60px] hidden sm:table-cell">
                Pos
              </th>
              {stations.map((s) => (
                <th
                  key={s.id}
                  className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 hidden md:table-cell"
                >
                  {s.shortCode}
                </th>
              ))}
              <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[80px]">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.player.id}
                className="border-b border-hair-2 last:border-b-0 hover:bg-paper"
              >
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "font-display text-[18px] font-bold leading-none",
                      i === 0 ? "text-gold" : i === 1 ? "text-ink-3" : i === 2 ? "text-dirt" : "text-ink",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/p/${r.player.handle}`}
                    className="flex items-center gap-2.5 hover:underline"
                  >
                    <Avatar size="md" color={r.player.avatarColor} initials={r.player.initials} />
                    <div>
                      <div className="font-semibold">
                        {r.player.firstName} {r.player.lastName}
                      </div>
                      <div className="font-mono text-[10.5px] text-ink-3">
                        #{r.player.jerseyNumber || "—"} · {r.player.classYearShort}
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-3 py-2.5 font-mono hidden sm:table-cell">
                  {r.player.positions.join("/") || "—"}
                </td>
                {stations.map((s) => {
                  const v = r.byStation.get(s.id);
                  return (
                    <td
                      key={s.id}
                      className="px-3 py-2.5 text-right font-mono text-[12.5px] hidden md:table-cell"
                    >
                      {v != null ? (
                        <span className="font-semibold">
                          {formatValue(v, s)}
                        </span>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right">
                  <span className="font-mono text-[15px] font-bold">{r.overall.toFixed(1)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface RankedRow {
  player: RealPlayer;
  byStation: Map<string, number>;
  overall: number;
}

function computeRankings(
  players: RealPlayer[],
  stations: TryoutStation[],
  scores: TryoutScore[],
): RankedRow[] {
  // Build best value per (player, station). Lower_better: min; else max.
  const bestMap = new Map<string, Map<string, number>>(); // playerId → stationId → value
  for (const s of scores) {
    const stMap = bestMap.get(s.playerId) ?? new Map<string, number>();
    const station = stations.find((st) => st.id === s.stationId);
    const existing = stMap.get(s.stationId);
    const v = s.value;
    if (
      existing == null ||
      (station?.scoreType === "lower_better" ? v < existing : v > existing)
    ) {
      stMap.set(s.stationId, v);
    }
    bestMap.set(s.playerId, stMap);
  }

  // Z-score per station (normalize 0–100 so scores are directly comparable).
  const stationStats = new Map<
    string,
    { min: number; max: number; scoreType: TryoutStation["scoreType"] }
  >();
  for (const st of stations) {
    const vals: number[] = [];
    const entries = Array.from(bestMap.values());
    for (const stMap of entries) {
      const v = stMap.get(st.id);
      if (v != null) vals.push(v);
    }
    if (vals.length === 0) continue;
    stationStats.set(st.id, {
      min: Math.min(...vals),
      max: Math.max(...vals),
      scoreType: st.scoreType,
    });
  }

  const rows: RankedRow[] = players.map((p) => {
    const stMap = bestMap.get(p.id) ?? new Map<string, number>();
    let sum = 0;
    let count = 0;
    for (const st of stations) {
      const v = stMap.get(st.id);
      const stats = stationStats.get(st.id);
      if (v == null || !stats) continue;
      const span = stats.max - stats.min;
      if (span === 0) {
        sum += 100;
      } else if (st.scoreType === "lower_better") {
        // Faster → closer to stats.min → higher normalized score.
        sum += ((stats.max - v) / span) * 100;
      } else {
        sum += ((v - stats.min) / span) * 100;
      }
      count += 1;
    }
    const overall = count > 0 ? sum / count : 0;
    return { player: p, byStation: stMap, overall };
  });

  rows.sort((a, b) => b.overall - a.overall);
  return rows;
}

function formatValue(v: number, st: TryoutStation): string {
  if (st.scoreType === "rating") return v.toFixed(1);
  if (st.unit === "s") return v.toFixed(2);
  return v.toFixed(1).replace(/\.0$/, "");
}

// ─────────────────────────────────────────────────────────────────
// Decide tab
// ─────────────────────────────────────────────────────────────────

/**
 * Build the list of verdict buttons dynamically from the program's
 * configured levels, so a program with ["Varsity", "JV", "Sophomore",
 * "Freshman"] gets four keep-buttons plus Lock / Bubble / Cut.
 *
 * Verdict string model:
 *   - "lock" / "bubble" / "cut" → special
 *   - any level name (lowercased) → keep on that level
 */
function buildVerdictList(
  levels: string[],
): Array<{ key: string; label: string; color: string; short: string }> {
  const levelColors = [
    "bg-grass-dim text-grass",   // top team
    "bg-sky-soft text-sky",
    "bg-amber-soft text-amber",
    "bg-paper-deep text-ink-2",
    "bg-red-dim text-red",        // extras cycle
  ];
  const keepButtons = levels.map((lvl, i) => ({
    key: lvl.toLowerCase(),
    label: shortenTeamLabel(lvl),
    short: shortenTeamLabel(lvl),
    color: levelColors[i] ?? levelColors[levelColors.length - 1],
  }));
  return [
    { key: "lock", label: "Lock", short: "Lock", color: "bg-grass text-white" },
    ...keepButtons,
    { key: "bubble", label: "Bubble", short: "Bub", color: "bg-amber-soft text-amber" },
    { key: "cut", label: "Cut", short: "Cut", color: "bg-red-soft text-red" },
  ];
}

function shortenTeamLabel(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 3) return trimmed;
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    return words
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase();
  }
  // Single-word long names: keep first two letters capitalized.
  return trimmed.slice(0, 2);
}

function DecideTab({
  tryout,
  stations,
  scores,
  attendees,
  attendeePlayers,
  keepCount,
  cutCount,
  programLevels,
  onChange,
}: {
  tryout: Tryout;
  stations: TryoutStation[];
  scores: TryoutScore[];
  attendees: TryoutAttendee[];
  attendeePlayers: RealPlayer[];
  keepCount: number;
  cutCount: number;
  programLevels: string[];
  onChange: () => void;
}) {
  const rows = useMemo(
    () => computeRankings(attendeePlayers, stations, scores),
    [attendeePlayers, stations, scores],
  );
  const verdictMap = new Map(attendees.map((a) => [a.playerId, a.verdict]));
  const [applying, setApplying] = useState(false);

  const applyToRoster = async () => {
    setApplying(true);
    const r = await applyVerdictsToRosterAction(tryout.id);
    setApplying(false);
    if (r.error) toast.error("Couldn't apply", { description: r.error });
    else {
      toast.success(`Applied ${r.applied} verdicts to roster`);
      onChange();
    }
  };

  if (attendeePlayers.length === 0) {
    return (
      <div className="bg-card border border-dashed border-hair rounded-lg p-10 text-center">
        <div className="font-display text-[18px] font-semibold tracking-tight">
          Nothing to decide yet
        </div>
        <div className="text-[12.5px] text-ink-3 mt-1">
          Register attendees and record scores, then come back to set verdicts.
        </div>
      </div>
    );
  }

  const decidedRows = rows.filter((r) => verdictMap.get(r.player.id));
  const pendingRows = rows.filter((r) => !verdictMap.get(r.player.id));

  return (
    <div className="space-y-5">
      <div className="bg-card border border-hair rounded-lg p-5 flex flex-wrap items-center gap-4">
        <div>
          <div className="type-label">Progress</div>
          <div className="font-display text-[22px] font-semibold tracking-tight mt-1">
            {decidedRows.length} / {rows.length} decided
          </div>
          <div className="text-[11.5px] text-ink-3 mt-0.5">
            {keepCount} keeps · {cutCount} cuts ·{" "}
            {attendees.filter((a) => a.verdict === "bubble").length} bubble
          </div>
        </div>
        <div className="flex-1" />
        <Button
          variant="primary"
          size="md"
          onClick={applyToRoster}
          disabled={applying || decidedRows.length === 0}
        >
          {applying ? "Applying…" : `Apply ${decidedRows.length} verdicts to roster`}
        </Button>
      </div>

      {pendingRows.length > 0 && (
        <VerdictTable
          title="Pending"
          rows={pendingRows}
          stations={stations}
          verdictMap={verdictMap}
          tryoutId={tryout.id}
          programLevels={programLevels}
          onChange={onChange}
        />
      )}
      {decidedRows.length > 0 && (
        <VerdictTable
          title="Decided"
          rows={decidedRows}
          stations={stations}
          verdictMap={verdictMap}
          tryoutId={tryout.id}
          programLevels={programLevels}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function VerdictTable({
  title,
  rows,
  stations,
  verdictMap,
  tryoutId,
  programLevels,
  onChange,
}: {
  title: string;
  rows: RankedRow[];
  stations: TryoutStation[];
  verdictMap: Map<string, Verdict | null>;
  tryoutId: string;
  programLevels: string[];
  onChange: () => void;
}) {
  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-[18px] py-3.5 border-b border-hair-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          {title} · {rows.length}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-paper border-b border-hair">
            <tr>
              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[50px]">#</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Player</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 w-[70px] hidden sm:table-cell">Score</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <VerdictRow
                key={r.player.id}
                r={r}
                stations={stations}
                position={i + 1}
                verdict={verdictMap.get(r.player.id) ?? null}
                tryoutId={tryoutId}
                programLevels={programLevels}
                onChange={onChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VerdictRow({
  r,
  stations: _stations,
  position,
  verdict,
  tryoutId,
  programLevels,
  onChange,
}: {
  r: RankedRow;
  stations: TryoutStation[];
  position: number;
  verdict: Verdict | null;
  tryoutId: string;
  programLevels: string[];
  onChange: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const saving = isPending;
  const verdictButtons = useMemo(() => buildVerdictList(programLevels), [programLevels]);

  const set = (v: Verdict | null) => {
    startTransition(async () => {
      const res = await setVerdictAction(tryoutId, r.player.id, v);
      if (res.error) toast.error("Couldn't save verdict", { description: res.error });
      else onChange();
    });
  };

  return (
    <tr className="border-b border-hair-2 last:border-b-0">
      <td className="px-3 py-2.5 font-mono text-[13px] font-bold">
        {String(position).padStart(2, "0")}
      </td>
      <td className="px-3 py-2.5">
        <Link href={`/p/${r.player.handle}`} className="flex items-center gap-2.5 hover:underline">
          <Avatar size="md" color={r.player.avatarColor} initials={r.player.initials} />
          <div>
            <div className="font-semibold">
              {r.player.firstName} {r.player.lastName}
            </div>
            <div className="font-mono text-[10.5px] text-ink-3">
              #{r.player.jerseyNumber || "—"} · {r.player.positions.join("/") || "—"} ·{" "}
              {r.player.classYearShort}
            </div>
          </div>
        </Link>
      </td>
      <td className="px-3 py-2.5 text-right font-mono font-semibold hidden sm:table-cell">
        {r.overall.toFixed(1)}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {verdictButtons.map((v) => (
            <button
              key={v.key}
              onClick={() => set(verdict?.toLowerCase() === v.key ? null : v.key)}
              disabled={saving}
              className={cn(
                "px-2 py-1 rounded-xs text-[10.5px] font-bold tracking-[0.04em] transition-all",
                verdict?.toLowerCase() === v.key
                  ? v.color
                  : "bg-paper text-ink-3 hover:text-ink hover:bg-paper-deep",
                saving && "opacity-50",
              )}
              title={v.label}
            >
              {v.short}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
}
