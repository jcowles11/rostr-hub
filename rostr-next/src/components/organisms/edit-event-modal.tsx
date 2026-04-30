"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/atoms/button";
import { updateGameScheduleAction } from "@/app/app/games/actions";
import { updatePracticeScheduleAction } from "@/app/app/practice/actions";

/**
 * EditEventModal — Phase 3.1 of the Coach Trust + Reality Sprint.
 *
 * Lets a coach edit the basic schedule fields on a game or practice
 * (date, time, opponent, location) directly from the Schedule view's
 * row-action menu. No more "delete + recreate" workaround for a date
 * change.
 *
 * Surface area is intentionally minimal — date and time on both kinds,
 * opponent + location on games only. Anything more (deep prep notes,
 * lineup, reschedule with notify) lives on the dedicated Game / Practice
 * detail pages and isn't duplicated here.
 */

export interface EditEventTarget {
  id: string;
  kind: "game" | "practice";
  title: string;
  isoDate: string | null;
  isoTime: string | null;
  opponent: string | null;
  location: string | null;
}

export function EditEventModal({
  target,
  open,
  onOpenChange,
}: {
  target: EditEventTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [opponent, setOpponent] = useState("");
  const [location, setLocation] = useState("");
  const [isPending, startTransition] = useTransition();

  // Hydrate fields whenever the modal target changes.
  useEffect(() => {
    if (!target) return;
    setDate(target.isoDate ?? "");
    setTime(target.isoTime ? target.isoTime.slice(0, 5) : "");
    setOpponent(target.opponent ?? "");
    setLocation(target.location ?? "");
  }, [target]);

  const save = () => {
    if (!target) return;
    if (!date) {
      toast.error("Date is required");
      return;
    }
    startTransition(async () => {
      const r =
        target.kind === "game"
          ? await updateGameScheduleAction({
              gameId: target.id,
              gameDate: date,
              gameTime: time || null,
              opponent: opponent.trim() || null,
              location: location.trim() || null,
            })
          : await updatePracticeScheduleAction({
              practiceId: target.id,
              practiceDate: date,
              startTime: time || null,
            });
      if (r.error) {
        toast.error("Couldn't save", { description: r.error });
        return;
      }
      toast.success(`${target.kind === "game" ? "Game" : "Practice"} updated`);
      router.refresh();
      onOpenChange(false);
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[95] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[96]",
            "w-[92vw] max-w-[420px] bg-card rounded-2xl shadow-modal border border-hair",
            "p-5 flex flex-col gap-4",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[17px] font-bold tracking-tight text-ink">
                Edit {target?.kind === "game" ? "game" : "practice"}
              </Dialog.Title>
              {target && (
                <Dialog.Description className="text-[12.5px] text-ink-3 mt-0.5">
                  {target.title}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-paper-deep text-ink-3 hover:text-ink active:scale-90 transition-transform"
              >
                <X className="w-4 h-4" strokeWidth={2.25} />
              </button>
            </Dialog.Close>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1 block">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[14px] font-mono outline-none focus:border-red"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1 block">
                Start time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[14px] font-mono outline-none focus:border-red"
              />
            </div>
          </div>

          {target?.kind === "game" && (
            <>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1 block">
                  Opponent
                </label>
                <input
                  type="text"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder="Central Hawks"
                  className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[14px] outline-none focus:border-red"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1 block">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Lincoln HS · Main field"
                  className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[14px] outline-none focus:border-red"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Dialog.Close asChild>
              <Button variant="secondary" size="md">
                Cancel
              </Button>
            </Dialog.Close>
            <Button variant="red" size="md" onClick={save} disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
