import Link from "next/link";
import { CalendarDays, Plus, Bell, MapPin, Swords, Dumbbell } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { cn } from "@/lib/utils";

/**
 * /app/schedule — Unified games + practices calendar.
 * Stub list view; real calendar comes later.
 */

type Kind = "game" | "practice";
interface Event {
  id: string;
  kind: Kind;
  date: { day: number; month: string; weekday: string };
  time: string;
  title: string;
  sub: string;
  emphasis?: boolean;
  href: string;
}

const WEEK: Event[] = [
  { id: "p1", kind: "practice", date: { day: 22, month: "Apr", weekday: "Wed" }, time: "3:30 PM", title: "Full practice · Situational hitting + bullpens", sub: "Main field + Cage 2 · 22 players · Coach Ruiz", href: "/app/practice" },
  { id: "p2", kind: "practice", date: { day: 23, month: "Apr", weekday: "Thu" }, time: "3:30 PM", title: "Light BP + pregame prep", sub: "Main field · 90 min · Coach Ruiz", href: "/app/practice" },
  { id: "g1", kind: "game", date: { day: 24, month: "Apr", weekday: "Fri" }, time: "5:00 PM", title: "vs Central Hawks · Conference", sub: "Home · Bus: none", emphasis: true, href: "/app/games/g1" },
  { id: "g2", kind: "game", date: { day: 25, month: "Apr", weekday: "Sat" }, time: "1:00 PM", title: "@ Westfield Panthers", sub: "Away · Bus 11:15 · Westfield HS", href: "/app/games/g2" },
  { id: "p3", kind: "practice", date: { day: 27, month: "Apr", weekday: "Mon" }, time: "3:30 PM", title: "Full practice · Defense & baserunning", sub: "Main field · 2h · Coach Park", href: "/app/practice" },
  { id: "g3", kind: "game", date: { day: 28, month: "Apr", weekday: "Tue" }, time: "4:30 PM", title: "vs Eastside Eagles", sub: "Home", href: "/app/games/g3" },
  { id: "p4", kind: "practice", date: { day: 29, month: "Apr", weekday: "Wed" }, time: "3:30 PM", title: "Light practice + scouting review", sub: "Main field · Coach Ruiz", href: "/app/practice" },
];

export default function SchedulePage() {
  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "Lincoln HS" }, { label: "Schedule" }]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" /> },
          { kind: "ghost", label: "Export week" },
          { kind: "primary", label: "Add event", icon: <Plus className="w-[15px] h-[15px]" /> },
        ]}
      />
      <div className="flex-1 overflow-auto px-8 pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
                Schedule
              </h1>
              <p className="text-[13.5px] text-ink-3 mt-1">
                Games, practices, and tryouts · next 14 days
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex bg-paper-deep p-1 rounded-sm">
                <button className="px-3 py-1.5 bg-card text-ink rounded-xs shadow-card text-[12px] font-semibold">
                  Week
                </button>
                <button className="px-3 py-1.5 text-ink-3 hover:text-ink rounded-xs text-[12px] font-semibold">
                  Month
                </button>
                <button className="px-3 py-1.5 text-ink-3 hover:text-ink rounded-xs text-[12px] font-semibold">
                  All
                </button>
              </div>
            </div>
          </div>

          <div className="bg-card border border-hair rounded-lg overflow-hidden">
            {WEEK.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function EventRow({ event: e }: { event: Event }) {
  const Icon = e.kind === "game" ? Swords : Dumbbell;
  return (
    <Link
      href={e.href}
      className="flex items-center gap-4 px-[18px] py-3 border-b border-hair-2 last:border-b-0 hover:bg-paper transition-colors"
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
    </Link>
  );
}
