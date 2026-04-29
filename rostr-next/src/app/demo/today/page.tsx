import Link from "next/link";
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
import { AvailabilityList } from "@/components/organisms/availability-list";
import {
  MOCK_PLAYERS,
  MOCK_TEAM,
  MOCK_BATTING_BY_PLAYER,
  MOCK_MEASURABLES_BY_PLAYER,
  MOCK_PITCHING_BY_PLAYER,
  getMockWeek,
  prettyToday,
  daysUntilLabel,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/**
 * /demo/today — daily standup mirror.
 *
 * Dynamic: anchors on `new Date()` so the date display + today's
 * events + Friday game countdown always reflect the actual day a
 * prospect is visiting. Mon–Thu show today's practice + Friday's game
 * "in N days"; Fri is game day; Sat is the road back-to-back.
 */

export const metadata = {
  title: "Today · Demo · Rostr",
  robots: { index: false, follow: false },
};

// Render against the real current date on every request.
export const dynamic = "force-dynamic";

export default function DemoTodayPage() {
  const now = new Date();
  const dow = now.getDay(); // 0 = Sun ... 6 = Sat
  const todayPretty = prettyToday(now);
  const week = getMockWeek(now);
  const fridayGame = week[4]; // Senior Night game
  const saturdayGame = week[5];
  // The Friday game's actual Date for the countdown label.
  const fridayDate = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() + ((5 - dow + 7) % 7));
    return d;
  })();
  const daysToFriday = Math.round((fridayDate.getTime() - new Date(now.toDateString()).getTime()) / 86400000);
  const isGameDay = dow === 5;
  const isRoadDay = dow === 6;
  const isRestDay = dow === 0;

  // Availability rollup — straight from MOCK_PLAYERS.
  const out = MOCK_PLAYERS.filter((p) => p.availabilityStatus === "out");
  const questionable = MOCK_PLAYERS.filter((p) => p.availabilityStatus === "questionable");
  const available = MOCK_PLAYERS.filter((p) => p.availabilityStatus === "ok");

  // Pick today's practice from the week schedule (Mon–Thu).
  const todayPracticeIdx = dow >= 1 && dow <= 4 ? dow - 1 : null;
  const todayPractice = todayPracticeIdx !== null ? week[todayPracticeIdx] : null;

  // AI standup wording flexes to the day of week.
  const standupBlurb = isGameDay
    ? <>Game day vs <b>Central Hawks</b> at 5pm — <b>Senior Night</b>.{" "}{questionable.length} questionable, {out.length} out. Lineup posted.</>
    : isRoadDay
    ? <>Road day at <b>Westfield Panthers</b> · 1pm first pitch · bus 11:15. Coming off Friday's Senior Night.</>
    : isRestDay
    ? <>Rest day. <b>Game day Friday</b> vs Central Hawks (Senior Night). Confirm parent guest list by Wednesday.</>
    : <>Game day Friday vs <b>Central Hawks</b> ({daysUntilLabel(fridayDate, now)}) — <b>Senior Night</b>. {questionable.length} players questionable: <b>Jordan Kim</b> (hamstring) and <b>Noah Patel</b> (wrist). <b>DeAndre Brooks</b> out today (academic).</>;

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: MOCK_TEAM.name }, { label: "Today" }]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-md bg-amber-soft text-amber flex items-center justify-center">
              <Sun className="w-4 h-4" />
            </div>
            <h1 className="font-display text-[28px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
              Today
            </h1>
          </div>
          <p className="text-[13.5px] text-ink-3 ml-12">{todayPretty}</p>

          {/* AI standup card */}
          <div className="mt-7 bg-card border border-hair rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-red" />
              <div className="type-label">AI standup · 6:00 AM digest</div>
            </div>
            <p className="text-[13.5px] text-ink-2 leading-relaxed">
              {standupBlurb}
            </p>
          </div>

          {/* Today's events */}
          <div className="mt-7">
            <div className="type-label mb-3">Today&apos;s events</div>
            <div className="space-y-3">
              {isGameDay && (
                <Link
                  href="/demo/games"
                  className="block bg-card border border-hair rounded-lg p-4 hover:bg-paper transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-red-soft text-red flex items-center justify-center shrink-0">
                      <Swords className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-[15px] font-semibold tracking-tight">
                          vs Central Hawks
                        </span>
                        <span className="px-1.5 py-0.5 rounded-xs bg-paper text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
                          Home
                        </span>
                        <span className="px-1.5 py-0.5 rounded-xs bg-red-soft text-red text-[10px] font-bold uppercase tracking-[0.06em]">
                          Senior Night
                        </span>
                      </div>
                      <div className="text-[12.5px] text-ink-3 mt-1 font-mono">
                        5:00 PM · report 4:00 · release 2:30
                      </div>
                      <div className="text-[12.5px] text-ink-2 mt-1.5">
                        Lineup posted · Uniform: Home whites · ceremony 4:30
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-ink-3 shrink-0 mt-2.5" />
                  </div>
                </Link>
              )}

              {isRoadDay && (
                <Link
                  href="/demo/games"
                  className="block bg-card border border-hair rounded-lg p-4 hover:bg-paper transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-red-soft text-red flex items-center justify-center shrink-0">
                      <Swords className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-[15px] font-semibold tracking-tight">
                          @ Westfield Panthers
                        </span>
                        <span className="px-1.5 py-0.5 rounded-xs bg-paper text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
                          Away
                        </span>
                      </div>
                      <div className="text-[12.5px] text-ink-3 mt-1 font-mono">
                        1:00 PM first pitch · bus departs 11:15
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-ink-3 shrink-0 mt-2.5" />
                  </div>
                </Link>
              )}

              {todayPractice && (
                <Link
                  href="/demo/practice"
                  className="block bg-card border border-hair rounded-lg p-4 hover:bg-paper transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-sky-soft text-sky flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-[15px] font-semibold tracking-tight">
                        {todayPractice.title}
                      </div>
                      <div className="text-[12.5px] text-ink-3 mt-1 font-mono">
                        {todayPractice.sub}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-ink-3 shrink-0 mt-2.5" />
                  </div>
                </Link>
              )}

              {/* Mon-Thu also surface the upcoming Friday game so the
                  coach has it on their radar. */}
              {!isGameDay && !isRoadDay && !isRestDay && (
                <Link
                  href="/demo/games"
                  className="block bg-paper-deep border border-dashed border-hair rounded-lg p-4 hover:bg-paper transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-card text-ink-3 flex items-center justify-center shrink-0">
                      <Swords className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-[15px] font-semibold tracking-tight">
                          vs Central Hawks
                        </span>
                        <span className="px-1.5 py-0.5 rounded-xs bg-red-soft text-red text-[10px] font-bold uppercase tracking-[0.06em]">
                          Senior Night · {daysUntilLabel(fridayDate, now)}
                        </span>
                      </div>
                      <div className="text-[12.5px] text-ink-3 mt-1 font-mono">
                        Friday · 5:00 PM · Home
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-ink-3 shrink-0 mt-2.5" />
                  </div>
                </Link>
              )}

              {isRestDay && (
                <div className="bg-paper-deep border border-dashed border-hair rounded-lg p-6 text-center">
                  <div className="font-display text-[15px] font-semibold tracking-tight">
                    Rest day
                  </div>
                  <div className="text-[12.5px] text-ink-3 mt-1">
                    No practice scheduled. Game day Friday vs Central Hawks ({daysUntilLabel(fridayDate, now)}).
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Availability */}
          <div className="mt-8">
            <div className="type-label mb-3">Availability rollup</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <AvailabilityTile
                tone="grass"
                icon={<CheckCircle2 className="w-4 h-4" />}
                count={available.length}
                label="Available"
              />
              <AvailabilityTile
                tone="amber"
                icon={<AlertCircle className="w-4 h-4" />}
                count={questionable.length}
                label="Questionable"
              />
              <AvailabilityTile
                tone="red"
                icon={<Clock className="w-4 h-4" />}
                count={out.length}
                label="Out"
              />
            </div>

            {(out.length > 0 || questionable.length > 0) && (
              <div className="mt-3 bg-card border border-hair rounded-lg p-3">
                <AvailabilityList
                  rows={[
                    ...out.map((p) => ({
                      id: p.id,
                      jerseyNumber: p.jerseyNumber,
                      firstName: p.firstName,
                      lastName: p.lastName,
                      classYearShort: p.classYearShort,
                      positions: p.positions,
                      availabilityStatus: p.availabilityStatus,
                      availabilityNote: p.availabilityNote,
                    })),
                    ...questionable.map((p) => ({
                      id: p.id,
                      jerseyNumber: p.jerseyNumber,
                      firstName: p.firstName,
                      lastName: p.lastName,
                      classYearShort: p.classYearShort,
                      positions: p.positions,
                      availabilityStatus: p.availabilityStatus,
                      availabilityNote: p.availabilityNote,
                    })),
                  ]}
                  fullRoster={MOCK_PLAYERS}
                  battingByPlayer={Object.fromEntries(
                    Object.entries(MOCK_BATTING_BY_PLAYER).map(([id, l]) => [
                      id,
                      { games: l.games, ba: l.ba, obp: l.obp, slg: l.slg, ops: l.ops, hr: l.hr, rbi: l.rbi },
                    ]),
                  )}
                  measurablesByPlayer={MOCK_MEASURABLES_BY_PLAYER}
                  pitchingByPlayer={Object.fromEntries(
                    Object.entries(MOCK_PITCHING_BY_PLAYER).map(([id, l]) => [
                      id,
                      { games: l.games, era: l.era, whip: l.whip, ip: l.ip, k: l.k, bb: l.bb },
                    ]),
                  )}
                />
              </div>
            )}
          </div>

          {/* Prep checklist */}
          <div className="mt-8">
            <div className="type-label mb-3">
              {isGameDay ? "Today's game-day checklist" : `Friday game prep · ${daysUntilLabel(fridayDate, now)}`}
            </div>
            <div className="bg-card border border-hair rounded-lg divide-y divide-hair-2">
              <PrepRow done label="Report time set (4:00 PM)" />
              <PrepRow done label="School release time (2:30 PM)" />
              <PrepRow done label="Uniform: Home whites · red caps" />
              <PrepRow
                done={false}
                label="Equipment note — rain jackets reminder"
                cta="Add"
              />
              <PrepRow done label="Lineup preview posted" />
              <PrepRow
                done={false}
                label="Pre-game speech notes"
                cta="Draft with AI"
              />
            </div>
          </div>

          {/* Reminder strip — wording flexes with how close we are to Friday. */}
          <div className="mt-8 bg-paper-deep border border-hair rounded-lg p-4 flex items-center gap-3">
            <Megaphone className="w-4 h-4 text-red shrink-0" />
            <div className="text-[13px] text-ink-2 leading-relaxed flex-1">
              {isGameDay ? (
                <><b>Senior Night tonight</b> — ceremony at 4:30, first pitch 5:00. Parents in their seats by 4:25.</>
              ) : isRoadDay ? (
                <><b>Bus departs 11:15</b> for Westfield. First pitch 1:00 PM. Bring extra equipment bags.</>
              ) : (
                <><b>Reminder:</b> Senior Night this Friday. Confirm parent guest list + ceremony order by Wednesday.</>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function AvailabilityTile({
  tone,
  icon,
  count,
  label,
}: {
  tone: "grass" | "amber" | "red";
  icon: React.ReactNode;
  count: number;
  label: string;
}) {
  const toneClasses = {
    grass: "bg-grass-dim text-grass",
    amber: "bg-amber-soft text-amber",
    red: "bg-red-soft text-red",
  }[tone];
  return (
    <div className="bg-card border border-hair rounded-lg p-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
            toneClasses,
          )}
        >
          {icon}
        </span>
        <div className="font-mono text-[22px] font-semibold tracking-tight">
          {count}
        </div>
        <div className="type-label ml-auto">{label}</div>
      </div>
    </div>
  );
}

function PrepRow({
  done,
  label,
  cta,
}: {
  done: boolean;
  label: string;
  cta?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "w-5 h-5 rounded-sm flex items-center justify-center shrink-0",
          done ? "bg-grass text-white" : "border border-hair bg-paper",
        )}
      >
        {done && <CheckCircle2 className="w-3.5 h-3.5" />}
      </span>
      <div
        className={cn(
          "flex-1 text-[13.5px]",
          done ? "text-ink-3 line-through" : "text-ink-2",
        )}
      >
        {label}
      </div>
      {cta && !done && (
        <button className="text-[12px] font-semibold text-red hover:underline">
          {cta} →
        </button>
      )}
    </div>
  );
}
