"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, AlertCircle, Link2, CheckCircle2 } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import { linkOpponentProgramAction } from "@/app/app/games/[id]/score/actions";
import { searchProgramsAction } from "@/app/app/games/link-actions";
import type { ProgramLookupResult } from "@/lib/services/live-scoring";

/**
 * LinkOpponentModal — coach links a scheduled game to the opposing
 * program (if they're also on Rostr). Once linked, the opposing
 * roster auto-appears in live scoring + coaches share a single
 * event stream.
 */
export function LinkOpponentModal({
  open,
  onOpenChange,
  gameId,
  opponent,
  currentlyLinked,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  gameId: string;
  opponent: string | null;
  currentlyLinked: boolean;
  onLinked?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(opponent ?? "");
  const [results, setResults] = useState<ProgramLookupResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ProgramLookupResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const doSearch = async () => {
      if (!query.trim() || query.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      const rows = await searchProgramsAction(query, gameId);
      if (!cancelled) {
        setResults(rows);
        setSearching(false);
      }
    };
    const t = setTimeout(doSearch, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, gameId]);

  const submit = (programId: string | null) => {
    startTransition(async () => {
      const r = await linkOpponentProgramAction(gameId, programId);
      if (r.error) {
        toast.error("Couldn't link", { description: r.error });
        return;
      }
      toast.success(programId ? "Opponent linked" : "Opponent unlinked");
      onOpenChange(false);
      if (onLinked) onLinked();
      router.refresh();
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={currentlyLinked ? "Opposing team linked" : "Link opposing team"}
      description="If the other team is on Rostr, linking pulls in their roster so you don't have to type opposing players."
    >
      <div className="space-y-4">
        {currentlyLinked ? (
          <div className="flex items-start gap-2 p-3 rounded-sm bg-grass-dim text-grass text-[12.5px]">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">This game is linked.</div>
              <div className="mt-1 text-[11.5px] opacity-90">
                Their roster is available in live scoring. Unlink below if you picked the wrong team.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-sm bg-paper border border-hair-2 text-[12px] text-ink-3 leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Search for the opposing program by school or program name. If
              they&apos;re not on Rostr yet, you can still score the game — you&apos;ll
              just be prompted for opposing player names as you go.
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2 focus-within:border-red">
          <Search className="w-4 h-4 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={opponent ? `Search… (starts with "${opponent}")` : "Search for a program…"}
            className="flex-1 bg-transparent outline-none text-[13.5px]"
            autoFocus
          />
          {searching && (
            <span className="text-[10px] text-ink-3 font-mono">searching…</span>
          )}
        </div>

        <div className="max-h-[280px] overflow-y-auto border border-hair-2 rounded-sm">
          {results.length === 0 && query.trim().length >= 2 && !searching ? (
            <div className="p-4 text-[12.5px] text-ink-3 text-center">
              No matches. They might not be on Rostr yet — you can still score
              the game without linking.
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-[12px] text-ink-4 text-center">
              Type at least 2 characters.
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 border-b border-hair-2 last:border-b-0 hover:bg-paper text-left",
                  selected?.id === r.id && "bg-red-soft",
                )}
              >
                <Link2 className="w-4 h-4 text-ink-3 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] truncate">
                    {r.name}
                  </div>
                  <div className="font-mono text-[10.5px] text-ink-3 truncate">
                    {r.schoolName}
                    {r.sport ? ` · ${r.sport}` : ""}
                  </div>
                </div>
                {selected?.id === r.id && (
                  <CheckCircle2 className="w-4 h-4 text-red shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        <ModalFooter>
          {currentlyLinked && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => submit(null)}
              disabled={isPending}
            >
              Unlink
            </Button>
          )}
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => selected && submit(selected.id)}
            disabled={!selected || isPending}
          >
            {isPending ? "Linking…" : "Link program"}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
