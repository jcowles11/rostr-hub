"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { cn } from "@/lib/utils";
import { createGameAction } from "@/app/app/games/actions";
import { createPracticeAction } from "@/app/app/practice/actions";

type Kind = "game" | "practice";

export function AddEventModal({
  open,
  onOpenChange,
  initialKind = "game",
  programLevels = ["Varsity", "JV", "Freshman"],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind?: Kind;
  programLevels?: string[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(initialKind);

  // game fields
  const [opponent, setOpponent] = useState("");
  const [homeAway, setHomeAway] = useState<"home" | "away" | "neutral">("home");
  // shared
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [level, setLevel] = useState(programLevels[0] ?? "Varsity");
  // practice fields
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const loading = isPending;

  const reset = () => {
    setKind(initialKind); setOpponent(""); setHomeAway("home");
    setDate(new Date().toISOString().slice(0, 10)); setTime(""); setLocation("");
    setLevel(programLevels[0] ?? "Varsity"); setTitle(""); setNotes("");
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (kind === "game") {
        const r = await createGameAction({
          opponent,
          gameDate: date,
          gameTime: time || undefined,
          location: location || undefined,
          homeAway,
          teamLevel: level,
        });
        if (r.error) {
          setError(r.error);
          return;
        }
        toast.success("Game scheduled", { description: `vs ${opponent} · ${date}` });
      } else {
        const r = await createPracticeAction({
          title,
          practiceDate: date,
          teamLevel: level,
          notes,
        });
        if (r.error) {
          setError(r.error);
          return;
        }
        toast.success("Practice scheduled", { description: `${title} · ${date}` });
      }

      reset();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      title="Add to schedule"
      description="Games feed the Game Day workflow. Practices feed the Practice Planner. Both show on Schedule + Coach Hub."
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {(["game", "practice"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "p-3 rounded-sm border text-left transition-all",
                kind === k
                  ? "border-red bg-red-soft shadow-[0_0_0_3px_var(--red-soft)]"
                  : "border-hair bg-card hover:border-ink-3",
              )}
            >
              <div className="type-label">{k === "game" ? "Game" : "Practice"}</div>
              <div className="text-[11px] text-ink-3 mt-0.5">
                {k === "game" ? "Opponent, date, home/away" : "Title, date, notes"}
              </div>
            </button>
          ))}
        </div>

        {kind === "game" ? (
          <>
            <div>
              <label className="type-label mb-1.5 block">Opponent</label>
              <input
                required
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="Central Hawks"
                className="input-base w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="type-label mb-1.5 block">Home / Away</label>
              <div className="flex gap-1">
                {(["home", "away", "neutral"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setHomeAway(v)}
                    className={cn(
                      "flex-1 h-[36px] rounded-xs text-[13px] font-semibold border capitalize transition-colors",
                      homeAway === v
                        ? "bg-ink text-white border-ink"
                        : "bg-card text-ink-2 border-hair hover:border-ink-3",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="type-label mb-1.5 block">Practice title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Pitcher bullpens + BP"
                className="input-base w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="type-label mb-1.5 block">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Key focus areas, reminders…"
                rows={3}
                className="input-base w-full resize-none"
              />
            </div>
          </>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="type-label mb-1.5 block">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-base w-full"
            />
          </div>
          {kind === "game" && (
            <div>
              <label className="type-label mb-1.5 block">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input-base w-full"
              />
            </div>
          )}
          <div className={cn(kind === "practice" ? "col-span-2" : "")}>
            <label className="type-label mb-1.5 block">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="input-base w-full"
            >
              {programLevels.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {kind === "game" && (
          <div>
            <label className="type-label mb-1.5 block">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Lincoln HS · Main field"
              className="input-base w-full"
            />
          </div>
        )}

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
            className="px-4 h-[38px] rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold disabled:opacity-60"
          >
            {loading ? "Adding…" : `Add ${kind}`}
          </button>
        </ModalFooter>
      </form>
      <style jsx>{`
        .input-base {
          background: var(--paper);
          border: 1px solid var(--hair);
          border-radius: 7px;
          padding: 9px 11px;
          font-size: 13.5px;
          outline: none;
        }
        .input-base:focus {
          border-color: var(--red);
          box-shadow: 0 0 0 3px var(--red-soft);
        }
      `}</style>
    </Modal>
  );
}
