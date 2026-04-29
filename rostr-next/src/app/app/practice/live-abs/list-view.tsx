"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Play,
  Plus,
  Calendar,
  ArrowRight,
  Flame,
  Snowflake,
  Trophy,
  Trash2,
  Lock,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { cn } from "@/lib/utils";
import {
  createSessionAction,
  deleteSessionAction,
} from "./actions";
import type {
  PracticeSession,
  HitterSessionStats,
  PitcherSessionStats,
} from "@/lib/services/live-abs";

interface PlayerInfo {
  name: string;
  jersey: number | null;
  positions: string[];
}

export function LiveAbsListView({
  sessions,
  hitters,
  pitchers,
  playerById,
}: {
  sessions: PracticeSession[];
  hitters: HitterSessionStats[];
  pitchers: PitcherSessionStats[];
  playerById: Record<string, PlayerInfo>;
}) {
  const [createOpen, setCreateOpen] = useState(false);

  // Build hot/cold lists with min PA threshold so a 1-for-1 doesn't crown
  // someone the leader.
  const hittersRanked = [...hitters]
    .filter((h) => h.pa >= 5)
    .sort((a, b) => b.avg - a.avg);
  const pitchersRanked = [...pitchers]
    .filter((p) => p.bf >= 5)
    .sort((a, b) => b.kPct - a.kPct);

  const totalAtBats = sessions.reduce((s, x) => s + x.atBatCount, 0);

  return (
    <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
      <div className="max-w-layout-app mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="type-label !text-red">Preseason / indoor</div>
            <h1 className="font-display text-[28px] sm:text-[32px] font-semibold tracking-[-0.03em] leading-[1.1]">
              Live at-bats
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1 max-w-[640px]">
              Tap an outcome for every preseason live AB. Stays out of official
              season stats — the data lives here for roster decisions.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/app/practice/live-abs/stats"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-card border border-hair hover:border-red hover:text-red text-ink rounded-sm text-[13px] font-semibold transition-colors"
              title="View team-wide stats across Live ABs + Intrasquad"
            >
              <TrendingUp className="w-4 h-4" />
              Team stats
            </Link>
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red hover:bg-red/90 text-white rounded-sm text-[13px] font-bold"
            >
              <Plus className="w-4 h-4" />
              New session
            </button>
          </div>
        </div>

        {/* Quick stats banner */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <Stat label="Sessions" value={String(sessions.length)} />
          <Stat label="At-bats logged" value={String(totalAtBats)} />
          <Stat
            label="Players tracked"
            value={String(new Set([...hitters.map((h) => h.playerId), ...pitchers.map((p) => p.playerId)]).size)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          {/* Sessions list */}
          <section className="bg-card border border-hair rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-ink-3" />
              <h2 className="font-display text-[15px] font-semibold tracking-tight">
                Sessions
              </h2>
              <span className="ml-auto font-mono text-[10.5px] text-ink-3 font-semibold">
                {sessions.length}
              </span>
            </div>
            {sessions.length === 0 ? (
              <EmptyState onCreate={() => setCreateOpen(true)} />
            ) : (
              <div className="divide-y divide-hair-2">
                {sessions.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </div>
            )}
          </section>

          {/* Roster decision sidebar */}
          <div className="flex flex-col gap-5">
            <Leaderboard
              title="Hot bats"
              icon={<Flame className="w-4 h-4 text-red" />}
              empty="Need more at-bats to rank."
              rows={hittersRanked.slice(0, 5).map((h) => ({
                playerId: h.playerId,
                name: playerById[h.playerId]?.name ?? "Unknown",
                main: formatAvg(h.avg),
                sub: `${h.h}/${h.ab} · ${h.k}K · ${h.bb}BB`,
              }))}
            />
            <Leaderboard
              title="Top arms (K%)"
              icon={<Trophy className="w-4 h-4 text-sky" />}
              empty="No qualifying pitchers yet."
              rows={pitchersRanked.slice(0, 5).map((p) => ({
                playerId: p.playerId,
                name: playerById[p.playerId]?.name ?? "Unknown",
                main: `${Math.round(p.kPct * 100)}%`,
                sub: `${p.k}K of ${p.bf} BF · ${p.bb}BB`,
              }))}
            />
            <Leaderboard
              title="Cold bats"
              icon={<Snowflake className="w-4 h-4 text-sky" />}
              empty="No data yet."
              tone="muted"
              rows={[...hittersRanked]
                .filter((h) => h.pa >= 5)
                .reverse()
                .slice(0, 3)
                .map((h) => ({
                  playerId: h.playerId,
                  name: playerById[h.playerId]?.name ?? "Unknown",
                  main: formatAvg(h.avg),
                  sub: `${Math.round(h.kPct * 100)}% K · ${h.h}/${h.ab}`,
                }))}
            />
          </div>
        </div>
      </div>

      <CreateSessionModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

// ── Bits ──────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-hair rounded-md p-3">
      <div className="type-label">{label}</div>
      <div className="font-mono text-[22px] font-bold tracking-[-0.02em] mt-0.5">
        {value}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="p-10 text-center">
      <div className="inline-flex w-12 h-12 rounded-full bg-red-soft text-red items-center justify-center mb-3">
        <Play className="w-6 h-6" />
      </div>
      <h3 className="font-display text-[18px] font-semibold tracking-tight">
        No sessions yet
      </h3>
      <p className="text-[13px] text-ink-3 mt-2 max-w-[420px] mx-auto leading-relaxed">
        Start a live AB session for indoor practice, BP day, or pen work.
        Tap outcomes for every at-bat — your roster-decision data builds up
        across the preseason.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 bg-red hover:bg-red/90 text-white rounded-sm text-[13px] font-semibold"
      >
        <Plus className="w-4 h-4" />
        Start first session
      </button>
    </div>
  );
}

function SessionRow({ session }: { session: PracticeSession }) {
  const router = useRouter();
  const isOpen = !session.endedAt;
  const date = new Date(`${session.sessionDate}T00:00:00`);
  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${session.name}" and all its at-bats?`)) return;
    const r = await deleteSessionAction(session.id);
    if (r.error) toast.error("Couldn't delete", { description: r.error });
    else {
      toast.success("Deleted");
      router.refresh();
    }
  };

  return (
    <Link
      href={`/app/practice/live-abs/${session.id}`}
      className="block px-5 py-3 hover:bg-paper transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 text-center shrink-0">
          <div className="text-[9.5px] font-bold text-ink-3 uppercase tracking-[0.08em]">
            {date.toLocaleDateString("en-US", { weekday: "short" })}
          </div>
          <div className="font-display text-[20px] font-semibold tracking-[-0.02em] leading-none mt-0.5">
            {date.getDate()}
          </div>
          <div className="text-[9px] text-ink-3 uppercase tracking-[0.08em] font-bold mt-0.5">
            {date.toLocaleDateString("en-US", { month: "short" })}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-display text-[15px] font-semibold tracking-tight">
              {session.name}
            </div>
            {isOpen ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red text-white rounded-xs text-[9px] font-bold tracking-[0.08em] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-live" />
                Open
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-paper-deep text-ink-2 rounded-xs text-[9px] font-bold tracking-[0.08em] uppercase">
                <Lock className="w-2.5 h-2.5" /> Closed
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-ink-3 mt-0.5">
            {session.atBatCount} at-bat{session.atBatCount === 1 ? "" : "s"}
            {session.location ? ` · ${session.location}` : ""}
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-red p-1.5 transition-opacity"
          aria-label="Delete session"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <ArrowRight className="w-4 h-4 text-ink-3" />
      </div>
    </Link>
  );
}

function Leaderboard({
  title,
  icon,
  empty,
  rows,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  rows: Array<{ playerId: string; name: string; main: string; sub: string }>;
  tone?: "muted";
}) {
  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-hair-2 flex items-center gap-2">
        {icon}
        <h3 className="font-display text-[14px] font-semibold tracking-tight">
          {title}
        </h3>
      </div>
      {rows.length === 0 ? (
        <div className="p-5 text-[12px] text-ink-3 text-center">{empty}</div>
      ) : (
        <div className="divide-y divide-hair-2">
          {rows.map((r) => (
            <div key={r.playerId} className="px-4 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate">{r.name}</div>
                <div className="text-[10.5px] text-ink-3 mt-0.5 font-mono">{r.sub}</div>
              </div>
              <div
                className={cn(
                  "font-mono text-[16px] font-bold tracking-[-0.02em]",
                  tone === "muted" ? "text-ink-3" : "text-ink",
                )}
              >
                {r.main}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── New session modal ────────────────────────────

function CreateSessionModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const finalName =
      name.trim() ||
      `Indoor session · ${new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    setLoading(true);
    const r = await createSessionAction({
      name: finalName,
      sessionDate: date,
      location: location || null,
    });
    setLoading(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setName("");
    setLocation("");
    onOpenChange(false);
    if (r.sessionId) router.push(`/app/practice/live-abs/${r.sessionId}`);
    else router.refresh();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Start a live AB session"
      description="Track preseason at-bats. Stays out of official season stats."
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="text-[12.5px] bg-red-soft text-red p-2.5 rounded-sm">
            {error}
          </div>
        )}
        <div>
          <label className="type-label mb-1.5 block">Session name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Indoor live ABs · Tuesday"
            className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red"
            autoFocus
          />
          <div className="text-[10.5px] text-ink-3 mt-1">
            Leave blank — we&apos;ll auto-name it from the date.
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="type-label mb-1.5 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] font-mono outline-none focus:border-red"
            />
          </div>
          <div>
            <label className="type-label mb-1.5 block">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Indoor cage · Bullpen · Field 2"
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red"
            />
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-grass-dim/30 border border-grass/20 rounded-sm">
          <CheckCircle2 className="w-4 h-4 text-grass shrink-0 mt-0.5" />
          <div className="text-[12px] leading-relaxed">
            <b className="font-semibold">Preseason data only.</b> These at-bats
            won&apos;t affect your team&apos;s official season stats — they live
            in the roster-decision view here.
          </div>
        </div>
        <ModalFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-[38px] rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 h-[38px] rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            {loading ? "Starting…" : "Start session"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function formatAvg(n: number): string {
  const s = Number(n).toFixed(3);
  return s.startsWith("0") ? s.slice(1) : s;
}
