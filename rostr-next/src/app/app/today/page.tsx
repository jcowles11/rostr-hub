import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Sun,
  Swords,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Clock,
  Megaphone,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { getCurrentCoach } from "@/lib/services/coach";
import { fetchRoster } from "@/lib/services/players";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * /app/today — daily standup view.
 *
 * Pulls together everything a coach needs at 6am to know what to do today:
 *   - Today's events (games + practices)
 *   - Who's out / questionable
 *   - Game-day prep that still needs to be filled in
 *   - Quick AI summary card
 *
 * Designed to be the first nav item — coaches open the app and can answer
 * "what do I need to do" without bouncing across 3 tabs.
 */

export default async function TodayPage() {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/app/setup");

  const supabase = createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [gamesRes, practicesRes, roster] = await Promise.all([
    supabase
      .from("games")
      .select(
        "id, opponent, game_date, game_time, location, home_away, team_level, report_time, release_time, uniform, equipment_notes, lineup_preview, prep_notes, status",
      )
      .eq("program_id", coach.program_id)
      .eq("game_date", today)
      .order("game_time", { ascending: true }),
    supabase
      .from("practice_plans")
      .select("id, title, practice_date, team_level, start_time")
      .eq("program_id", coach.program_id)
      .eq("practice_date", today)
      .order("start_time", { ascending: true }),
    fetchRoster(coach.program_id),
  ]);

  const todayGames = gamesRes.data ?? [];
  const todayPractices = practicesRes.data ?? [];

  // Pull block aggregates (count + total minutes) for today's plans so the
  // card can show "6 blocks · 90 min" — gives the coach a glanceable sense
  // of whether the plan is filled in or still empty.
  const todayPlanIds = todayPractices.map((p) => p.id);
  const planSummaries = new Map<string, { count: number; totalMin: number }>();
  if (todayPlanIds.length > 0) {
    const { data: blockRows } = await supabase
      .from("practice_blocks")
      .select("practice_plan_id, duration_min")
      .in("practice_plan_id", todayPlanIds);
    for (const row of blockRows ?? []) {
      const cur = planSummaries.get(row.practice_plan_id) ?? { count: 0, totalMin: 0 };
      cur.count += 1;
      cur.totalMin += row.duration_min ?? 0;
      planSummaries.set(row.practice_plan_id, cur);
    }
  }

  // Availability rollup
  const out = roster.filter((p) => p.availabilityStatus === "out");
  const questionable = roster.filter((p) => p.availabilityStatus === "questionable");

  // Games missing prep
  const missingPrep = todayGames.filter(
    (g) => !g.report_time && !g.uniform && !g.lineup_preview,
  );

  const date = new Date();
  const dateLine = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: coach.program_name }, { label: "Today" }]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="max-w-layout-app mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-md bg-red-soft text-red flex items-center justify-center">
              <Sun className="w-6 h-6" />
            </div>
            <div>
              <div className="type-label !text-red">Daily standup</div>
              <h1 className="font-display text-[28px] sm:text-[32px] font-semibold tracking-[-0.03em] leading-[1.1]">
                {dateLine}
              </h1>
              <p className="text-[13.5px] text-ink-3 mt-0.5">
                Everything you need to know about today, in one place.
              </p>
            </div>
          </div>

          {/* AI summary callout */}
          <DailyBrief
            todayGames={todayGames}
            todayPractices={todayPractices}
            outCount={out.length}
            questionableCount={questionable.length}
            missingPrepCount={missingPrep.length}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 mt-5">
            {/* Main column: today's events */}
            <div className="flex flex-col gap-5">
              {/* Games today */}
              <section className="bg-card border border-hair rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2">
                  <Swords className="w-4 h-4 text-red" />
                  <h2 className="font-display text-[15px] font-semibold tracking-tight">
                    Games today
                  </h2>
                  <span className="ml-auto font-mono text-[10.5px] text-ink-3 font-semibold">
                    {todayGames.length}
                  </span>
                </div>
                {todayGames.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-ink-3">
                    No games today. Use this time for practice + recovery.
                  </div>
                ) : (
                  <div className="divide-y divide-hair-2">
                    {todayGames.map((g) => (
                      <GameRow key={g.id} game={g} />
                    ))}
                  </div>
                )}
              </section>

              {/* Practices today */}
              <section className="bg-card border border-hair rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-grass" />
                  <h2 className="font-display text-[15px] font-semibold tracking-tight">
                    Practices today
                  </h2>
                  <span className="ml-auto font-mono text-[10.5px] text-ink-3 font-semibold">
                    {todayPractices.length}
                  </span>
                </div>
                {todayPractices.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-ink-3">
                    No practices scheduled today.
                    <div className="mt-2">
                      <Link
                        href="/app/practice"
                        className="inline-flex items-center gap-1 text-red font-semibold hover:underline"
                      >
                        Plan a practice → <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-hair-2">
                    {todayPractices.map((p) => {
                      const summary = planSummaries.get(p.id);
                      const isEmpty = !summary || summary.count === 0;
                      return (
                        <Link
                          key={p.id}
                          href={`/app/practice?plan=${p.id}`}
                          className="block px-5 py-3 hover:bg-paper transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-grass" />
                            <div className="flex-1 min-w-0">
                              <div className="font-display text-[14px] font-semibold tracking-tight">
                                {p.title}
                              </div>
                              <div className="text-[11.5px] text-ink-3 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                                <span>{p.team_level ?? "All levels"}</span>
                                {p.start_time && (
                                  <span>· {formatTime12(p.start_time)}</span>
                                )}
                                {summary && summary.count > 0 && (
                                  <span>
                                    · <b className="text-ink">{summary.count}</b> block{summary.count === 1 ? "" : "s"}
                                    {" · "}
                                    <b className="text-ink">{summary.totalMin}</b> min
                                  </span>
                                )}
                                {isEmpty && (
                                  <span className="text-amber font-semibold">
                                    · Empty plan — add drills →
                                  </span>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-ink-3" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Right column: availability + announcements */}
            <div className="flex flex-col gap-5">
              <section className="bg-card border border-hair rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber" />
                  <h2 className="font-display text-[14px] font-semibold tracking-tight">
                    Availability
                  </h2>
                </div>
                <div className="p-4 space-y-3 text-[13px]">
                  <Stat
                    label="Available"
                    value={String(roster.length - out.length - questionable.length)}
                    color="grass"
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  />
                  <Stat
                    label="Questionable"
                    value={String(questionable.length)}
                    color="amber"
                    icon={<AlertCircle className="w-3.5 h-3.5" />}
                  />
                  <Stat
                    label="Out"
                    value={String(out.length)}
                    color="red"
                    icon={<AlertCircle className="w-3.5 h-3.5" />}
                  />
                  {(out.length > 0 || questionable.length > 0) && (
                    <div className="pt-2 mt-2 border-t border-hair-2 space-y-1.5 text-[11.5px] text-ink-3">
                      {out.slice(0, 5).map((p) => (
                        <div key={p.id}>
                          <b className="text-ink">{p.firstName} {p.lastName}</b> — out
                          {p.availabilityNote ? ` (${p.availabilityNote})` : ""}
                        </div>
                      ))}
                      {questionable.slice(0, 3).map((p) => (
                        <div key={p.id}>
                          <b className="text-ink">{p.firstName} {p.lastName}</b> — questionable
                          {p.availabilityNote ? ` (${p.availabilityNote})` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Quick action card — what to do next */}
              <Link
                href="/app/messages"
                className="bg-ink text-white rounded-lg p-5 hover:bg-ink/90 transition-colors block"
              >
                <div className="flex items-center gap-1.5 text-[10px] text-red font-bold uppercase tracking-[0.12em]">
                  <Megaphone className="w-3 h-3" />
                  Send today
                </div>
                <div className="font-display text-[15px] font-semibold mt-1.5 leading-snug">
                  Broadcast today&apos;s plan to the team.
                </div>
                <div className="text-[11.5px] text-white/70 mt-2 leading-relaxed">
                  Players show up prepared. Parents stop asking what time pickup is.
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-[12px] text-red font-semibold">
                  Open messages → <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function DailyBrief({
  todayGames,
  todayPractices,
  outCount,
  questionableCount,
  missingPrepCount,
}: {
  todayGames: Array<{ id: string }>;
  todayPractices: Array<{ id: string }>;
  outCount: number;
  questionableCount: number;
  missingPrepCount: number;
}) {
  // Build a one-line "TL;DR" headline + an action list
  const eventCount = todayGames.length + todayPractices.length;
  let headline: string;
  if (eventCount === 0) {
    headline = "Light day — no games or practices scheduled.";
  } else if (todayGames.length > 0) {
    headline = `Game day · ${todayGames.length} game${todayGames.length === 1 ? "" : "s"}${todayPractices.length > 0 ? ` + ${todayPractices.length} practice${todayPractices.length === 1 ? "" : "s"}` : ""}`;
  } else {
    headline = `${todayPractices.length} practice${todayPractices.length === 1 ? "" : "s"} on the calendar`;
  }

  const todos: Array<{ text: string; href: string }> = [];
  if (missingPrepCount > 0) {
    todos.push({
      text: `${missingPrepCount} game${missingPrepCount === 1 ? "" : "s"} still need prep notes (report time, uniform, etc.)`,
      href: "/app/games",
    });
  }
  if (questionableCount > 0) {
    todos.push({
      text: `Confirm availability for ${questionableCount} questionable player${questionableCount === 1 ? "" : "s"}`,
      href: "/app/roster",
    });
  }
  if (todayGames.length > 0) {
    todos.push({
      text: `Set lineup for today's game${todayGames.length === 1 ? "" : "s"}`,
      href: "/app/games",
    });
  }
  if (todayPractices.length === 0 && todayGames.length === 0) {
    todos.push({
      text: "Use this open day — plan a practice or schedule a game",
      href: "/app/practice",
    });
  }

  return (
    <div className="bg-ink text-white rounded-lg p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-md bg-red flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-red">
            Your day
          </div>
          <div className="font-display text-[20px] sm:text-[22px] font-semibold tracking-tight mt-0.5 leading-tight">
            {headline}
          </div>
          {todos.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-[13px] text-white/85">
              {todos.map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red mt-0.5">→</span>
                  <Link href={t.href} className="hover:underline">
                    {t.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {todos.length === 0 && (
            <div className="mt-3 text-[13px] text-white/70">
              You&apos;re all caught up. Enjoy the breathing room.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GameRow({
  game,
}: {
  game: {
    id: string;
    opponent: string | null;
    game_time: string | null;
    location: string | null;
    home_away: string | null;
    team_level: string | null;
    report_time: string | null;
    release_time: string | null;
    uniform: string | null;
    lineup_preview: string | null;
    status: string | null;
  };
}) {
  return (
    <Link
      href={`/app/games/${game.id}`}
      className="block px-5 py-4 hover:bg-paper transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 text-center shrink-0">
          <div className="font-display text-[16px] font-bold tracking-[-0.02em]">
            {game.game_time ? formatTime12(game.game_time).split(" ")[0] : "TBD"}
          </div>
          <div className="text-[9px] text-ink-3 uppercase tracking-[0.08em] font-bold mt-0.5">
            {game.game_time
              ? formatTime12(game.game_time).split(" ")[1]
              : ""}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[15px] font-semibold tracking-tight">
            {game.home_away === "home" ? "vs" : "@"} {game.opponent ?? "TBD"}
          </div>
          <div className="text-[11.5px] text-ink-3 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {game.team_level && <span>{game.team_level}</span>}
            {game.location && <span>· {game.location}</span>}
          </div>
          {(game.report_time || game.release_time || game.uniform) && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
              {game.report_time && (
                <span className="font-mono">
                  <span className="text-ink-3">Report</span>{" "}
                  <b className="text-ink">{formatTime12(game.report_time)}</b>
                </span>
              )}
              {game.release_time && (
                <span className="font-mono">
                  <span className="text-ink-3">Released</span>{" "}
                  <b className="text-ink">{formatTime12(game.release_time)}</b>
                </span>
              )}
              {game.uniform && (
                <span>
                  <span className="text-ink-3">Uniform</span>{" "}
                  <b className="text-ink">{game.uniform}</b>
                </span>
              )}
            </div>
          )}
          {!game.report_time && !game.uniform && !game.lineup_preview && (
            <div className="mt-2 text-[11px] text-amber font-semibold">
              ⚠ No prep notes yet — fill in to share with players
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: "grass" | "amber" | "red";
  icon: React.ReactNode;
}) {
  const colorClasses = {
    grass: "text-grass",
    amber: "text-amber",
    red: "text-red",
  };
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("inline-flex w-6 h-6 items-center justify-center", colorClasses[color])}>
        {icon}
      </span>
      <span className="flex-1 text-ink-3 text-[12.5px]">{label}</span>
      <span className={cn("font-mono text-[15px] font-semibold", colorClasses[color])}>
        {value}
      </span>
    </div>
  );
}

function formatTime12(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${(mStr ?? "00").padStart(2, "0")} ${period}`;
}
