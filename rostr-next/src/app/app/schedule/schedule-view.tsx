"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Plus, MapPin, Swords, Dumbbell, Trash2, Pencil } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { cn } from "@/lib/utils";
import { AddEventModal } from "@/components/organisms/add-event-modal";
import { RowActions } from "@/components/molecules/row-actions";
import { deleteGameAction } from "@/app/app/games/actions";
import { deletePracticeAction } from "@/app/app/practice/actions";
import { EditEventModal, type EditEventTarget } from "@/components/organisms/edit-event-modal";

type Kind = "game" | "practice";
export interface ScheduleEvent {
  id: string;
  kind: Kind;
  date: { day: number; month: string; weekday: string };
  /** ISO date string (YYYY-MM-DD) — passed to the edit modal so the
   *  date input pre-populates. Optional for backward compat. */
  isoDate?: string;
  /** ISO time string (HH:MM) — same idea. */
  isoTime?: string | null;
  time: string;
  title: string;
  sub: string;
  /** Original location/opponent fields for the edit modal. */
  opponent?: string | null;
  location?: string | null;
  emphasis?: boolean;
  href: string;
}

export function ScheduleView({ week: WEEK }: { week: ScheduleEvent[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditEventTarget | null>(null);
  return (
    <>
      {/* PHASE 2.2 — removed hardcoded "Lincoln HS" breadcrumb (it
          showed up for real coaches whose program had a different
          name). PHASE 5 — removed Bell + "Export week" coming-soon
          buttons; both fired toasts with no real backing. Only the
          "Add event" primary remains since it routes to the working
          AddEventModal. */}
      <TopBar
        breadcrumbs={[{ label: "Schedule" }]}
        actions={[
          { kind: "primary", label: "Add event", icon: <Plus className="w-[15px] h-[15px]" />, onClick: () => setAddOpen(true) },
        ]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
                Schedule
              </h1>
              <p className="text-[13.5px] text-ink-3 mt-1">
                Games, practices, and tryouts · next 14 days
              </p>
            </div>
            {/* PHASE 5 — removed the fake "Week / Month / All" view
                toggle. None of those views existed; tapping any
                button did nothing. */}
          </div>

          {WEEK.length === 0 ? (
            // PHASE 2.2 — true empty state (no Lincoln HS fallback).
            <div className="bg-card border border-dashed border-hair rounded-lg p-10 text-center">
              <CalendarDays className="w-9 h-9 text-ink-4 mx-auto mb-3" />
              <h3 className="font-display text-[18px] font-semibold tracking-tight">
                Nothing on the schedule yet
              </h3>
              <p className="text-[13px] text-ink-3 mt-2 max-w-[420px] mx-auto leading-relaxed">
                Add your first game or practice. Once on the schedule, it
                shows up here, on your Hub, and on every player&apos;s /me
                page automatically.
              </p>
              <button
                onClick={() => setAddOpen(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 h-10 bg-red text-white rounded-full text-[13.5px] font-bold shadow-[0_4px_14px_-4px_rgba(200,58,58,0.55)] active:scale-[0.96] transition-transform"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                Add to schedule
              </button>
            </div>
          ) : (
            <div className="bg-card border border-hair rounded-lg overflow-hidden">
              {WEEK.map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  onEdit={() =>
                    setEditTarget({
                      id: e.id,
                      kind: e.kind,
                      title: e.title,
                      isoDate: e.isoDate ?? null,
                      isoTime: e.isoTime ?? null,
                      opponent: e.opponent ?? null,
                      location: e.location ?? null,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <AddEventModal open={addOpen} onOpenChange={setAddOpen} />
      <EditEventModal
        target={editTarget}
        open={editTarget !== null}
        onOpenChange={(o) => !o && setEditTarget(null)}
      />
    </>
  );
}

function EventRow({
  event: e,
  onEdit,
}: {
  event: ScheduleEvent;
  onEdit: () => void;
}) {
  const router = useRouter();
  const Icon = e.kind === "game" ? Swords : Dumbbell;

  const handleDelete = async () => {
    const label = e.kind === "game" ? "game" : "practice";
    if (!confirm(`Delete this ${label}: "${e.title}"?`)) return;
    const action = e.kind === "game" ? deleteGameAction : deletePracticeAction;
    const r = await action(e.id);
    if (r.error) toast.error(`Couldn't delete ${label}`, { description: r.error });
    else {
      toast.success(`${label === "game" ? "Game" : "Practice"} deleted`);
      router.refresh();
    }
  };

  return (
    <Link
      href={e.href}
      className="flex items-center gap-3 sm:gap-4 px-3 sm:px-[18px] py-3 border-b border-hair-2 last:border-b-0 hover:bg-paper transition-colors"
    >
      <div className="w-[56px] text-center shrink-0">
        <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.08em]">
          {e.date.weekday}
        </div>
        <div className="font-display text-[22px] font-semibold tracking-[-0.02em] leading-none mt-0.5">
          {e.date.day}
        </div>
        <div className="text-[9.5px] text-ink-3 uppercase tracking-[0.08em] font-bold mt-0.5">
          {e.date.month}
        </div>
      </div>
      <div
        className={cn(
          "w-7 h-7 rounded-xs flex items-center justify-center shrink-0",
          e.kind === "game" ? "bg-red-soft text-red" : "bg-grass-dim text-grass",
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold">
          {e.emphasis ? (
            <>
              {e.title.split("·")[0]?.trim()}{" "}
              <span className="text-red">· {e.title.split("·")[1]?.trim()}</span>
            </>
          ) : (
            e.title
          )}
        </div>
        <div className="mt-0.5 text-[11.5px] text-ink-3 flex items-center gap-2">
          <span>{e.time}</span>
          <span className="text-ink-4">·</span>
          <MapPin className="w-3 h-3" />
          <span>{e.sub}</span>
        </div>
      </div>
      <span
        className={cn(
          "px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-[0.04em] shrink-0",
          e.kind === "game" ? "bg-red-soft text-red" : "bg-paper-deep text-ink-2",
        )}
      >
        {e.kind === "game" ? "Game" : "Practice"}
      </span>
      <div onClick={(ev) => ev.stopPropagation()}>
        <RowActions
          items={[
            {
              label: `Edit ${e.kind}`,
              icon: <Pencil className="w-3.5 h-3.5" />,
              onSelect: onEdit,
            },
            {
              label: `Delete ${e.kind}`,
              icon: <Trash2 className="w-3.5 h-3.5" />,
              danger: true,
              onSelect: handleDelete,
            },
          ]}
        />
      </div>
    </Link>
  );
}
