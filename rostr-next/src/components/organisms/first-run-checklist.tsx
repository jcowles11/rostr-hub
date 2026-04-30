import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Users, CalendarDays, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * FirstRunChecklist — onboarding card shown to coaches who haven't
 * finished setting up their program yet.
 *
 * Renders a 3-step numbered list:
 *   1. Add your players
 *   2. Add games + practices to your schedule
 *   3. Plan your first practice
 *
 * Each step shows a ✓ when its threshold is met. The card hides
 * itself once all three are complete (returns null) so a fully-set-up
 * coach doesn't have a permanent "checklist" eating viewport. Pure
 * server component — no client JS, no state.
 *
 * Mounted at the top of /app/today (the daily standup view) so a
 * brand-new coach sees an unambiguous "What do I do first?" before
 * the rest of the page's empty states.
 */
export function FirstRunChecklist({
  hasPlayers,
  hasUpcomingEvents,
  hasAnyPractice,
}: {
  hasPlayers: boolean;
  /** Any game or practice scheduled in the future. */
  hasUpcomingEvents: boolean;
  /** Any practice plan with at least one block. */
  hasAnyPractice: boolean;
}) {
  // Don't render the card when everything's done — coach is past
  // first-run; we don't need to keep nagging.
  if (hasPlayers && hasUpcomingEvents && hasAnyPractice) return null;

  const steps: Array<{
    n: number;
    done: boolean;
    icon: React.ReactNode;
    title: string;
    body: string;
    cta: string;
    href: string;
  }> = [
    {
      n: 1,
      done: hasPlayers,
      icon: <Users className="w-4 h-4" strokeWidth={2.25} />,
      title: "Add your players",
      body: "Start with 5–10 names. Numbers, positions, and grade help — but not required.",
      cta: hasPlayers ? "Manage roster" : "Add players",
      href: "/app/roster",
    },
    {
      n: 2,
      done: hasUpcomingEvents,
      icon: <CalendarDays className="w-4 h-4" strokeWidth={2.25} />,
      title: "Add to your schedule",
      body: "Drop in your next few games + practices. Saves time later when you score live.",
      cta: hasUpcomingEvents ? "View schedule" : "Add events",
      href: "/app/schedule",
    },
    {
      n: 3,
      done: hasAnyPractice,
      icon: <ClipboardList className="w-4 h-4" strokeWidth={2.25} />,
      title: "Plan a practice",
      body: "Block out tonight (or tomorrow). The AI Coach can draft a starter plan if helpful.",
      cta: hasAnyPractice ? "Open planner" : "Plan practice",
      href: "/app/practice",
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <section
      className={cn(
        "bg-card border border-hair rounded-2xl overflow-hidden mb-5",
        // Subtle red accent so the card reads as primary attention.
        "shadow-[0_4px_20px_-8px_rgba(200,58,58,0.18)]",
      )}
    >
      <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2">
        <span className="inline-flex w-7 h-7 rounded-full bg-red-soft text-red items-center justify-center font-display font-bold text-[14px]">
          {completed}
        </span>
        <h2 className="font-display text-[15px] font-semibold tracking-tight">
          Get your team set up
        </h2>
        <span className="ml-auto font-mono text-[10.5px] text-ink-3 font-semibold">
          {completed} / {steps.length}
        </span>
      </div>
      <ul className="divide-y divide-hair-2">
        {steps.map((s) => (
          <li key={s.n}>
            <Link
              href={s.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 hover:bg-paper transition-colors",
                "active:scale-[0.99] duration-[120ms]",
              )}
            >
              <span
                className={cn(
                  "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
                  s.done
                    ? "bg-grass-dim text-grass"
                    : "bg-paper-deep text-ink-2",
                )}
              >
                {s.done ? (
                  <CheckCircle2 className="w-5 h-5" strokeWidth={2.25} />
                ) : (
                  s.icon
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-mono text-[10.5px] font-bold tracking-[0.06em] uppercase",
                      s.done ? "text-grass" : "text-ink-3",
                    )}
                  >
                    {s.done ? "Done" : `Step ${s.n}`}
                  </span>
                  <span
                    className={cn(
                      "font-display text-[14px] sm:text-[15px] font-semibold tracking-tight",
                      s.done && "text-ink-3 line-through decoration-2 decoration-grass/40",
                    )}
                  >
                    {s.title}
                  </span>
                </div>
                {!s.done && (
                  <p className="text-[12px] text-ink-3 mt-0.5 leading-snug">
                    {s.body}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11.5px] font-bold",
                  s.done
                    ? "text-ink-3"
                    : "bg-red text-white shadow-[0_2px_8px_-2px_rgba(200,58,58,0.5)]",
                )}
              >
                {s.cta}
                {!s.done && <ArrowRight className="w-3 h-3" strokeWidth={2.5} />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {/* Provide a tiny "skip" hint without an actual dismiss button —
          the card naturally hides once steps complete. */}
      {completed === 0 && (
        <div className="px-4 py-2.5 bg-paper border-t border-hair-2 text-[11.5px] text-ink-3 leading-relaxed flex items-start gap-2">
          <Circle className="w-3 h-3 text-ink-4 shrink-0 mt-0.5" />
          <span>
            You can also explore Rostr without setup — drop in 15 sample
            players from the Roster page to play with the planner and
            stat layouts.
          </span>
        </div>
      )}
    </section>
  );
}
