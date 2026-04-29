"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Avatar, avatarColorFromSeed } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import type { PlayerSearchResult } from "@/lib/services/recruiter";
import { formatAvg, formatIP, formatERA, formatWHIP } from "@/lib/format";
import { togglePlayerInListAction } from "../../actions";

type PlayerWithClass = PlayerSearchResult & {
  classYear: number | null;
  notes: string | null;
  addedAt: string;
};

export function ListDetailView({
  listId,
  players,
}: {
  listId: string;
  players: PlayerWithClass[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const remove = (playerId: string, name: string) => {
    if (!confirm(`Remove ${name} from this list?`)) return;
    startTransition(async () => {
      const r = await togglePlayerInListAction(listId, playerId, false);
      if (r.error) toast.error("Couldn't remove", { description: r.error });
      else {
        toast.success("Removed");
        router.refresh();
      }
    });
  };

  if (players.length === 0) {
    return (
      <div className="p-10 bg-card border border-dashed border-hair rounded-lg text-center">
        <div className="font-display text-[18px] font-semibold tracking-tight mb-1">
          No players on this list yet
        </div>
        <div className="text-[12.5px] text-ink-3 mb-4">
          Head back to search and tap the heart button on any card.
        </div>
        <Link
          href="/scout"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-ink hover:bg-red text-white rounded-sm text-[12.5px] font-semibold"
        >
          Find prospects →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {players.map((p) => (
        <div
          key={p.id}
          className={cn(
            "bg-card border border-hair rounded-lg p-4 sm:p-5 hover:border-ink transition-colors relative",
            isPending && "opacity-60",
          )}
        >
          <div className="flex items-start gap-3">
            <Avatar
              size="lg"
              color={avatarColorFromSeed(p.id)}
              initials={((p.firstName[0] ?? "") + (p.lastName[0] ?? "")).toUpperCase()}
            />
            <div className="flex-1 min-w-0">
              <Link
                href={`/p/${p.profileSlug}`}
                className="font-display text-[17px] font-semibold tracking-tight leading-tight hover:underline truncate block"
              >
                {p.firstName} {p.lastName}
              </Link>
              <div className="font-mono text-[11.5px] text-ink-3 mt-0.5 truncate">
                {p.classYear ? `Class of ${p.classYear}` : "—"}
                {p.positions.length > 0 && ` · ${p.positions.join("/")}`}
              </div>
              {p.schoolName && (
                <div className="text-[11.5px] text-ink-2 mt-0.5 truncate">{p.schoolName}</div>
              )}
            </div>
            <button
              onClick={() => remove(p.id, `${p.firstName} ${p.lastName}`)}
              className="p-1.5 rounded-xs text-ink-3 hover:text-red hover:bg-red-soft"
              aria-label="Remove from list"
              title="Remove from list"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <Mini label="EV" value={p.bestEV} unit="mph" />
            <Mini label="60yd" value={p.best60yd} unit="s" />
            <Mini label="Velo" value={p.bestVelo} unit="mph" />
            <Mini label="Field" value={p.bestField} unit="/5" />
          </div>

          {p.games != null && p.games > 0 && (
            <div className="mt-3 flex items-center gap-3 px-3 py-2 bg-paper border border-hair-2 rounded-sm">
              <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-red">
                Bat
              </span>
              <span className="flex items-baseline gap-1">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3">G</span>
                <span className="font-mono text-[12.5px] font-semibold">{p.games}</span>
              </span>
              <span className="flex items-baseline gap-1">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3">AVG</span>
                <span className="font-mono text-[12.5px] font-semibold">{formatAvg(p.ba)}</span>
              </span>
              <span className="flex items-baseline gap-1">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3">OPS</span>
                <span
                  className={cn(
                    "font-mono text-[12.5px] font-semibold",
                    p.ops != null && p.ops >= 0.8 && "text-red",
                  )}
                >
                  {formatAvg(p.ops)}
                </span>
              </span>
              {p.hr != null && p.hr > 0 && (
                <span className="flex items-baseline gap-1">
                  <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3">HR</span>
                  <span className="font-mono text-[12.5px] font-semibold">{p.hr}</span>
                </span>
              )}
            </div>
          )}

          {p.pitchingGames != null && p.pitchingGames > 0 && (
            <div className="mt-2 flex items-center gap-3 px-3 py-2 bg-paper border border-hair-2 rounded-sm">
              <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-red">
                Pit
              </span>
              <span className="flex items-baseline gap-1">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3">IP</span>
                <span className="font-mono text-[12.5px] font-semibold">{formatIP(p.ip)}</span>
              </span>
              <span className="flex items-baseline gap-1">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3">ERA</span>
                <span
                  className={cn(
                    "font-mono text-[12.5px] font-semibold",
                    p.era != null && p.era > 0 && p.era < 3.0 && "text-red",
                  )}
                >
                  {formatERA(p.era)}
                </span>
              </span>
              <span className="flex items-baseline gap-1">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3">WHIP</span>
                <span className="font-mono text-[12.5px] font-semibold">{formatWHIP(p.whip)}</span>
              </span>
              <span className="flex items-baseline gap-1">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3">K/9</span>
                <span className="font-mono text-[12.5px] font-semibold">
                  {p.k9 != null && p.k9 > 0 ? p.k9.toFixed(1) : "—"}
                </span>
              </span>
            </div>
          )}

          {p.notes && (
            <div className="mt-4 px-3 py-2 bg-paper rounded-md text-[12px] text-ink-2 border-l-[3px] border-l-red">
              {p.notes}
            </div>
          )}

          <div className="mt-4 text-[10.5px] font-mono text-ink-3">
            Added {new Date(p.addedAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function Mini({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  if (value == null) {
    return (
      <div className="px-2 py-2 bg-paper rounded-sm text-center">
        <div className="font-mono text-[15px] text-ink-4">—</div>
        <div className="text-[9.5px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-0.5">
          {label}
        </div>
      </div>
    );
  }
  const formatted = unit === "s" ? value.toFixed(2) : unit === "/5" ? value.toFixed(1) : value.toFixed(1).replace(/\.0$/, "");
  return (
    <div className="px-2 py-2 bg-paper rounded-sm text-center">
      <div className="font-mono text-[15px] font-bold tracking-[-0.02em]">
        {formatted}
        {unit !== "/5" && <span className="text-[10px] text-ink-3 ml-0.5 font-normal">{unit}</span>}
      </div>
      <div className="text-[9.5px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-0.5">
        {label}
      </div>
    </div>
  );
}
