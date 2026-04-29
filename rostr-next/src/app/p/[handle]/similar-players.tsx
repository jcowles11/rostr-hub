import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Avatar, avatarColorFromSeed } from "@/components/atoms/avatar";
import type { SimilarPlayer } from "@/lib/services/similar-players";

/**
 * SimilarPlayersSection — "players like this one" on the bottom of
 * the public profile, visible only to signed-in recruiters.
 *
 * Each card leads back to a full profile so a recruiter can hop
 * through a pool of comparable prospects quickly without resetting
 * their search.
 */
export function SimilarPlayersSection({
  anchorName,
  players,
}: {
  anchorName: string;
  players: SimilarPlayer[];
}) {
  return (
    <div className="mt-8 mb-12 pt-6 border-t border-hair">
      <div className="flex items-baseline gap-2.5 mb-4">
        <Sparkles className="w-4 h-4 text-red" />
        <h2 className="font-display text-[20px] font-semibold tracking-tight">
          Players similar to {anchorName.split(" ")[0]}
        </h2>
        <span className="text-[11.5px] text-ink-3">
          matched on verified measurables + class year
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {players.map((p) => (
          <SimilarCard key={p.id} player={p} />
        ))}
      </div>
    </div>
  );
}

function SimilarCard({ player: p }: { player: SimilarPlayer }) {
  const initials = ((p.firstName[0] ?? "") + (p.lastName[0] ?? "")).toUpperCase();
  const pct = Math.round(p.similarity * 100);

  return (
    <Link
      href={`/p/${p.profileSlug}`}
      className="group bg-card border border-hair rounded-lg p-4 hover:border-ink transition-colors flex flex-col"
    >
      <div className="flex items-start gap-3">
        <Avatar size="md" color={avatarColorFromSeed(p.id)} initials={initials} />
        <div className="flex-1 min-w-0">
          <div className="font-display text-[15px] font-semibold tracking-tight truncate group-hover:underline">
            {p.firstName} {p.lastName}
          </div>
          <div className="font-mono text-[10.5px] text-ink-3 mt-0.5 truncate">
            {p.classYear ? `Class of ${p.classYear}` : "—"}
            {p.positions.length > 0 && ` · ${p.positions.join("/")}`}
          </div>
          {p.schoolName && (
            <div className="text-[11px] text-ink-2 mt-0.5 truncate">{p.schoolName}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div
            className="font-mono text-[13px] font-bold text-red"
            title={`${pct}% match`}
          >
            {pct}%
          </div>
          <div className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.08em]">
            match
          </div>
        </div>
      </div>

      {/* Why */}
      {p.matchReasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {p.matchReasons.map((r, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 rounded-xs bg-paper text-[10px] font-mono text-ink-2"
            >
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Measurables mini-grid */}
      <div className="mt-3 grid grid-cols-4 gap-1">
        <MiniStat label="EV" v={p.bestEV} unit="" format="num" />
        <MiniStat label="60" v={p.best60yd} unit="" format="time" />
        <MiniStat label="Velo" v={p.bestVelo} unit="" format="num" />
        <MiniStat label="Fld" v={p.bestField} unit="" format="rating" />
      </div>
    </Link>
  );
}

function MiniStat({
  label,
  v,
  format,
}: {
  label: string;
  v: number | null;
  unit: string;
  format: "num" | "time" | "rating";
}) {
  if (v == null) {
    return (
      <div className="px-1 py-1 bg-paper rounded-xs text-center">
        <div className="font-mono text-[12px] text-ink-4">—</div>
        <div className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.05em]">
          {label}
        </div>
      </div>
    );
  }
  const formatted = format === "time" ? v.toFixed(2) : format === "rating" ? v.toFixed(1) : Math.round(v).toString();
  return (
    <div className="px-1 py-1 bg-paper rounded-xs text-center">
      <div className="font-mono text-[12px] font-bold">{formatted}</div>
      <div className="text-[9px] font-bold text-ink-3 uppercase tracking-[0.05em]">
        {label}
      </div>
    </div>
  );
}
