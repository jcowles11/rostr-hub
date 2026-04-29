"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Trophy } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import { recordGameResultAction } from "@/app/app/games/actions";

/**
 * RecordResultModal — coach enters the final score of a game.
 * Auto-flips game.status to 'completed' and stores a W/L via the
 * generated result column. Appears on the game detail page.
 */
export function RecordResultModal({
  open,
  onOpenChange,
  gameId,
  opponent,
  homeAway,
  initialOurScore,
  initialOpponentScore,
  initialRecapNotes,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  gameId: string;
  opponent: string | null;
  homeAway: string;
  initialOurScore?: number | null;
  initialOpponentScore?: number | null;
  initialRecapNotes?: string | null;
}) {
  const router = useRouter();
  const [ourScore, setOurScore] = useState<string>(
    initialOurScore != null ? String(initialOurScore) : "",
  );
  const [oppScore, setOppScore] = useState<string>(
    initialOpponentScore != null ? String(initialOpponentScore) : "",
  );
  const [notes, setNotes] = useState(initialRecapNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const saving = isPending;

  const parsedOur = parseInt(ourScore, 10);
  const parsedOpp = parseInt(oppScore, 10);
  const hasBoth = Number.isFinite(parsedOur) && Number.isFinite(parsedOpp);
  const preview: "W" | "L" | "T" | null = !hasBoth
    ? null
    : parsedOur > parsedOpp
      ? "W"
      : parsedOur < parsedOpp
        ? "L"
        : "T";

  const submit = () => {
    setError(null);
    if (!hasBoth) return setError("Enter both scores.");
    if (parsedOur < 0 || parsedOpp < 0) return setError("Scores can't be negative.");
    startTransition(async () => {
      const r = await recordGameResultAction({
        gameId,
        ourScore: parsedOur,
        opponentScore: parsedOpp,
        recapNotes: notes,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      toast.success(
        `Final recorded: ${parsedOur}–${parsedOpp} ${preview ?? ""}`.trim(),
      );
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record final"
      description="Enter the final score. Flows into your team record on the Hub."
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <ScoreInput
            label={homeAway === "home" ? "Home (us)" : "Us"}
            sublabel="Our runs"
            value={ourScore}
            onChange={setOurScore}
            autoFocus
          />
          <ScoreInput
            label={opponent ?? "Opponent"}
            sublabel={homeAway === "away" ? "Home" : "Away"}
            value={oppScore}
            onChange={setOppScore}
          />
        </div>

        {preview && (
          <div
            className={cn(
              "p-3 rounded-sm text-center font-display text-[18px] font-bold tracking-tight",
              preview === "W" && "bg-grass-dim text-grass",
              preview === "L" && "bg-red-soft text-red",
              preview === "T" && "bg-amber-soft text-amber",
            )}
          >
            <Trophy className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {preview === "W" ? "Win" : preview === "L" ? "Loss" : "Tie"}
            {" · "}
            <span className="font-mono">{parsedOur}–{parsedOpp}</span>
          </div>
        )}

        <div>
          <div className="type-label mb-1.5">Recap notes (optional)</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Johnson 3-for-4 with 2 RBI. Defensive gem by Kim at SS in the 6th."
            rows={4}
            className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red focus:ring-2 focus:ring-red-soft resize-none"
          />
          <div className="text-[11px] text-ink-3 mt-1">
            Appears on the Recap tab and in the team activity feed.
          </div>
        </div>

        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={submit} disabled={!hasBoth || saving}>
            {saving ? "Recording…" : "Record final"}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}

function ScoreInput({
  label,
  sublabel,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  sublabel: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="p-4 bg-paper border border-hair rounded-sm text-center">
      <div className="type-label truncate" title={label}>{label}</div>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder="0"
        autoFocus={autoFocus}
        className="w-full bg-transparent font-mono text-[48px] font-bold tracking-[-0.03em] text-center outline-none mt-2 focus:text-red"
      />
      <div className="text-[10px] text-ink-3 mt-1">{sublabel}</div>
    </div>
  );
}
