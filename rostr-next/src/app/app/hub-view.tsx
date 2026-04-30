"use client";

import { Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/organisms/top-bar";
import { Panel, PanelHead, PanelTab } from "@/components/molecules/panel";
import { StatTile } from "@/components/molecules/stat-tile";
import { FeedItem } from "@/components/molecules/feed-item";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { cn } from "@/lib/utils";
import {
  MOCK_PLAYERS,
  type MockScheduleItem,
  type MockPlayer,
} from "@/lib/mock-data";
import type { ActivityEvent, SpotlightPlayer } from "@/lib/services/activity";
import type { InboxThread } from "@/lib/services/messaging";
import type { ProgramRecord } from "@/lib/services/game";
import { avatarColorFromSeed } from "@/components/atoms/avatar";
import { useState } from "react";
import { AddPlayerModal } from "@/components/organisms/add-player-modal";
import { ImportRosterModal } from "@/components/organisms/import-roster-modal";
import { AddEventModal } from "@/components/organisms/add-event-modal";
import { AICoachCard as LiveAICoachCard } from "@/components/organisms/ai-coach-card";
import { ScrollReveal } from "@/components/atoms/scroll-reveal";
import {
  PlayerSlideover,
  type PlayerSlideoverStats,
  type PlayerSlideoverMeasurable,
} from "@/components/organisms/player-slideover";

interface HubViewProps {
  greetingName: string;
  programName: string;
  nextGame: {
    id: string;
    opponent: string;
    dateLabel: string;
    timeLabel: string;
    location: string;
  } | null;
  weekItems: MockScheduleItem[];
  availabilityPlayers: MockPlayer[];
  playerCount: number;
  activity: ActivityEvent[];
  spotlight: SpotlightPlayer | null;
  inboxThreads: InboxThread[];
  record: ProgramRecord | null;
  /** Optional pre-computed stat maps for the player slideover preview.
   *  Demo passes these from MOCK_*; real /app currently passes nothing
   *  and the slideover Metrics tab shows its empty state. */
  battingByPlayer?: Record<string, PlayerSlideoverStats>;
  measurablesByPlayer?: Record<string, PlayerSlideoverMeasurable[]>;
  pitchingByPlayer?: Record<
    string,
    { games: number; era: number; whip: number; ip: number; k: number; bb: number }
  >;
}

/**
 * Coach Hub — client view.
 * Renders the whole /app home. Data is passed in from the Server
 * Component wrapper at /app/page.tsx (real when a coach record exists,
 * mock otherwise).
 */
export function HubView({
  greetingName,
  programName,
  nextGame,
  weekItems,
  availabilityPlayers,
  playerCount,
  activity,
  spotlight,
  inboxThreads,
  record,
  battingByPlayer,
  measurablesByPlayer,
  pitchingByPlayer,
}: HubViewProps) {
  const MOCK_WEEK = weekItems;
  const PLAYERS_FOR_AVAIL = availabilityPlayers;
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addEventOpen, setAddEventOpen] = useState<"game" | "practice" | null>(null);
  const [slideoverPlayer, setSlideoverPlayer] = useState<MockPlayer | null>(null);

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Morning";
    if (h < 17) return "Afternoon";
    return "Evening";
  }

  const today = new Date();
  const todayLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const extraCount = Math.max(0, playerCount - PLAYERS_FOR_AVAIL.slice(0, 7).length);

  // Honest stat row — derived from the real data that flows through this page.
  // We deliberately avoid faking a win/loss record, team BA, ERA, or conf. rank
  // until we have verified per-game stat capture. See CLAUDE.md §Scope Discipline.
  const availableCount = PLAYERS_FOR_AVAIL.filter((p) => p.availabilityStatus === "ok").length;
  const questionableCount = PLAYERS_FOR_AVAIL.filter(
    (p) => p.availabilityStatus === "questionable",
  ).length;
  const outCount = PLAYERS_FOR_AVAIL.filter((p) => p.availabilityStatus === "out").length;
  const weekGameCount = MOCK_WEEK.filter((i) => i.tag === "GAME").length;
  const weekPracticeCount = MOCK_WEEK.filter((i) => i.tag === "PRAC").length;

  const subtitle = buildSubtitle({
    nextGame,
    weekGameCount,
    weekPracticeCount,
    outCount,
    questionableCount,
  });
  return (
    <>
      {/* PHASE 5 — removed the "Notifications" bell + "Quick add" ghost
          buttons. Both fired comingSoon toasts; bell has no real
          backing feature, and Quick add duplicates the mobile FAB +
          desktop QuickActionsPanel. Kept the primary "Start practice"
          since it routes to a real page. */}
      <TopBar
        breadcrumbs={[{ label: programName }, { label: "Today" }]}
        actions={[
          { kind: "primary", label: "Start practice", href: "/app/practice" },
        ]}
      />
      <div className="flex-1 overflow-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-7 pb-24 lg:pb-12">
        <div className="max-w-layout-hub mx-auto">
          {/* ── Hub header ────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-4 lg:mb-[22px] gap-3 lg:gap-6">
            <div>
              <span className="inline-flex items-center gap-2 px-[11px] py-1.5 bg-red-soft text-red rounded-full text-[10.5px] font-bold uppercase tracking-[0.04em]">
                <span className="w-1.5 h-1.5 rounded-full bg-red" />
                {todayLabel}
              </span>
              <h1 className="mt-2 font-display text-[28px] sm:text-display-md leading-[1.05] tracking-[-0.03em]">
                {greeting()}, {greetingName.split(" ")[0] || "Coach"}.
              </h1>
              <p className="mt-1 text-ink-3 text-[13px] sm:text-[14px]">{subtitle}</p>
            </div>
            {/* PHASE 2.1 + PHASE 5 — removed fake "Sync" toast (no real
                GameChanger/MaxPreps sync exists) and removed the
                "Export week" coming-soon button. Header is action-free
                here; coaches use Quick add on the side rail or the FAB. */}
          </div>

          {/* ── Grid ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-[22px]">
            {/* MAIN COLUMN */}
            <div className="flex flex-col gap-[22px] min-w-0">
              {/* The hero is above-the-fold, so it lands instantly
                  (enabled={false}). Subsequent sections stagger in
                  via ScrollReveal as the user scrolls past them. */}
              <ScrollReveal enabled={false}>
                <TodayHeroCard nextGame={nextGame} playerCount={playerCount} />
              </ScrollReveal>

              {/* Mobile-only: AI Coach card lands right here, second
                  thing in the page after the hero. On desktop the AI
                  card lives in the sidebar (see SIDE COLUMN below) so
                  we hide this copy at lg+. The most-used coach
                  superpower deserves prime real estate on phones. */}
              <div className="lg:hidden">
                <ScrollReveal enabled={false}>
                  <LiveAICoachCard mobileHero />
                </ScrollReveal>
              </div>

              {/* Stat row — honest counts derived from real program data. */}
              <ScrollReveal delayMs={40}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {record && record.gamesCompleted > 0 ? (
                  <StatTile
                    label="Record"
                    value={
                      record.ties > 0
                        ? `${record.wins}–${record.losses}–${record.ties}`
                        : `${record.wins}–${record.losses}`
                    }
                    delta={`${record.gamesCompleted} game${record.gamesCompleted === 1 ? "" : "s"} · ${record.runsFor} RF / ${record.runsAgainst} RA`}
                    deltaDirection={
                      record.wins > record.losses
                        ? "up"
                        : record.losses > record.wins
                          ? "down"
                          : undefined
                    }
                  />
                ) : (
                  <StatTile
                    label="Roster"
                    value={String(playerCount)}
                    delta={playerCount === 1 ? "player" : "players"}
                  />
                )}
                <StatTile
                  label="Available"
                  value={String(availableCount)}
                  delta={`of ${PLAYERS_FOR_AVAIL.length} today`}
                  deltaDirection={
                    availableCount === PLAYERS_FOR_AVAIL.length && PLAYERS_FOR_AVAIL.length > 0
                      ? "up"
                      : undefined
                  }
                />
                <StatTile
                  label="Q / Out"
                  value={`${questionableCount} / ${outCount}`}
                  delta={
                    questionableCount + outCount === 0
                      ? "everyone's in"
                      : "needs attention"
                  }
                  deltaDirection={questionableCount + outCount > 0 ? "down" : undefined}
                />
                <StatTile
                  label="This week"
                  value={String(weekGameCount + weekPracticeCount)}
                  delta={`${weekGameCount}g · ${weekPracticeCount}p`}
                />
              </div>
              </ScrollReveal>

              {/* Availability */}
              <ScrollReveal delayMs={80}>
                <AvailabilityPanel
                  players={PLAYERS_FOR_AVAIL}
                  extraCount={extraCount}
                  onSelectPlayer={(p) => setSlideoverPlayer(p)}
                />
              </ScrollReveal>

              {/* Schedule + Plan row */}
              <ScrollReveal delayMs={120}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-[22px]">
                  <ThisWeekPanel items={MOCK_WEEK} />
                  <TodayPlanPanel />
                </div>
              </ScrollReveal>

              {/* Activity feed */}
              <ScrollReveal delayMs={140}>
                <ActivityFeedPanel events={activity} />
              </ScrollReveal>
            </div>

            {/* SIDE COLUMN */}
            <div className="flex flex-col gap-[18px]">
              {/* Desktop-only AI coach (mobile shows it inline above
                  the stat tiles). hidden lg:block prevents two cards
                  from rendering on phones. */}
              <ScrollReveal delayMs={60}>
                <div className="hidden lg:block">
                  <LiveAICoachCard />
                </div>
              </ScrollReveal>
              <ScrollReveal delayMs={100}>
                <QuickActionsPanel
                  onAddPlayer={() => setAddPlayerOpen(true)}
                  onImport={() => setImportOpen(true)}
                  onNewGame={() => setAddEventOpen("game")}
                  onNewPractice={() => setAddEventOpen("practice")}
                />
              </ScrollReveal>
              <ScrollReveal delayMs={140}>
                <MessagesPanel threads={inboxThreads} />
              </ScrollReveal>
              <ScrollReveal delayMs={180}>
                <PlayerSpotlightPanel spotlight={spotlight} />
              </ScrollReveal>
            </div>
          </div>
        </div>
      </div>

      <AddPlayerModal open={addPlayerOpen} onOpenChange={setAddPlayerOpen} />
      <ImportRosterModal open={importOpen} onOpenChange={setImportOpen} />
      <AddEventModal
        open={addEventOpen !== null}
        onOpenChange={(o) => !o && setAddEventOpen(null)}
        initialKind={addEventOpen ?? "game"}
      />
      {/* Quick player preview — opens when a row in the availability
          panel is tapped. Same component the Roster uses, so coaches
          get one mental model for "preview a player" anywhere in the
          app. */}
      <PlayerSlideover
        player={slideoverPlayer}
        players={PLAYERS_FOR_AVAIL}
        stats={
          slideoverPlayer && battingByPlayer
            ? battingByPlayer[slideoverPlayer.id] ?? null
            : null
        }
        measurables={
          slideoverPlayer && measurablesByPlayer
            ? measurablesByPlayer[slideoverPlayer.id] ?? null
            : null
        }
        pitching={
          slideoverPlayer && pitchingByPlayer
            ? pitchingByPlayer[slideoverPlayer.id] ?? null
            : null
        }
        open={slideoverPlayer !== null}
        onOpenChange={(o) => !o && setSlideoverPlayer(null)}
        onEdit={(p) => setSlideoverPlayer(p)}
      />
    </>
  );
}

// ── Main column sections ────────────────────────────────────────

function TodayHeroCard({
  nextGame,
  playerCount,
}: {
  nextGame: HubViewProps["nextGame"];
  playerCount: number;
}) {
  // Real data only — no fake "Practice · Situational hitting & pitching"
  // / "3:30 – 5:30 PM" / "Field A" defaults that would mislead a coach
  // into thinking a practice was scheduled when nothing's on the books.
  const hasGame = Boolean(nextGame);
  const label = hasGame ? "Next game" : "Nothing on deck";
  const title = hasGame
    ? `vs ${nextGame!.opponent}`
    : "Add your first game or practice";
  const dateLabel = hasGame
    ? `${nextGame!.dateLabel}${nextGame!.timeLabel ? " · " + nextGame!.timeLabel : ""}`
    : null;
  const locationLabel = hasGame ? nextGame!.location : null;
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-[linear-gradient(135deg,#0e1116_0%,#191d24_100%)] text-white shadow-[0_18px_50px_-20px_rgba(14,17,22,0.55)]">
      <div
        aria-hidden
        className="absolute -top-16 -right-16 w-60 h-60 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(200, 58, 58, 0.3), transparent 65%)",
        }}
      />
      <div className="relative">
        <div className="type-label !text-white/55">{label}</div>
        {/* Whoop-style "this matters" headline. Bigger on mobile so
            the eye locks onto it the moment the page lands. */}
        <div className="mt-1.5 font-display text-[30px] sm:text-[28px] font-semibold tracking-[-0.025em] leading-[1.05]">
          {title}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] sm:text-[12.5px] text-white/75 tabular-nums">
          {dateLabel && (
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Clock className="w-[15px] h-[15px]" strokeWidth={2.25} />
              {dateLabel}
            </span>
          )}
          {locationLabel && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-[15px] h-[15px]" strokeWidth={2.25} />
              {locationLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 font-mono">
            <Users className="w-[15px] h-[15px]" strokeWidth={2.25} />
            {playerCount} {playerCount === 1 ? "player" : "players"}
          </span>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          {hasGame ? (
            <>
              <Link
                href={`/app/games/${nextGame!.id}`}
                className={cn(
                  "inline-flex items-center bg-red text-white rounded-full px-4 h-9 text-[12.5px] font-bold shadow-[0_4px_14px_-4px_rgba(200,58,58,0.6)]",
                  "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  "active:scale-[0.94] hover:bg-red/90",
                )}
              >
                Open game →
              </Link>
              <Link
                href="/app/practice"
                className={cn(
                  "inline-flex items-center bg-white/[0.1] text-white rounded-full px-4 h-9 text-[12.5px] font-semibold",
                  "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  "active:scale-[0.94] hover:bg-white/[0.16]",
                )}
              >
                Practice plan
              </Link>
            </>
          ) : (
            // No game scheduled — point the coach at the schedule so
            // they can put one on the books. No fake "Open practice
            // plan / Field runner mode" buttons that would mislead.
            <Link
              href="/app/schedule"
              className={cn(
                "inline-flex items-center bg-red text-white rounded-full px-4 h-9 text-[12.5px] font-bold shadow-[0_4px_14px_-4px_rgba(200,58,58,0.6)]",
                "transition-transform duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                "active:scale-[0.94] hover:bg-red/90",
              )}
            >
              Add to schedule →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * AvailabilityPanel — Hub view of today's roster status.
 *
 * Three things this fixes vs. the previous implementation:
 *   1. Filter pills (All / Questionable / Out) actually filter the list.
 *   2. Year + position render in a fixed-width gutter that lines up
 *      across every row at every breakpoint.
 *   3. Each row is a button that opens the PlayerSlideover preview —
 *      coaches can scan-and-preview without losing their place in the
 *      Hub. (The previous version linked to the public profile page,
 *      which kicked them all the way out of the app.)
 */
type AvailFilter = "all" | "questionable" | "out";

function AvailabilityPanel({
  players: PLAYERS_FOR_AVAIL,
  extraCount,
  onSelectPlayer,
}: {
  players: MockPlayer[];
  extraCount: number;
  onSelectPlayer: (player: MockPlayer) => void;
}) {
  const [filter, setFilter] = useState<AvailFilter>("all");
  const questionableCount = PLAYERS_FOR_AVAIL.filter(
    (p) => p.availabilityStatus === "questionable",
  ).length;
  const outCount = PLAYERS_FOR_AVAIL.filter((p) => p.availabilityStatus === "out").length;

  // Sort order: out → questionable → ok, then by jersey for stability.
  const sortKey = (p: MockPlayer) =>
    p.availabilityStatus === "out" ? 0 : p.availabilityStatus === "questionable" ? 1 : 2;
  const sorted = [...PLAYERS_FOR_AVAIL].sort(
    (a, b) => sortKey(a) - sortKey(b) || a.jerseyNumber - b.jerseyNumber,
  );
  const filtered = sorted.filter((p) => {
    if (filter === "all") return true;
    if (filter === "questionable") return p.availabilityStatus === "questionable";
    if (filter === "out") return p.availabilityStatus === "out";
    return true;
  });
  // Empty roster guard — show a helpful empty state instead of "+X more".
  const hasAny = sorted.length > 0;
  const visible = filtered.slice(0, 7);
  const hiddenInFilter = Math.max(0, filtered.length - visible.length);

  return (
    <Panel>
      <PanelHead
        title="Today’s availability"
        actions={
          <>
            <PanelTab active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </PanelTab>
            <PanelTab
              active={filter === "questionable"}
              onClick={() => setFilter("questionable")}
            >
              Questionable ({questionableCount})
            </PanelTab>
            <PanelTab active={filter === "out"} onClick={() => setFilter("out")}>
              Out ({outCount})
            </PanelTab>
            {/* PHASE 5 — removed the MoreHorizontal "Roster export"
                comingSoon button. No real export feature backs it. */}
          </>
        }
      />
      <div>
        {!hasAny ? (
          <div className="px-[18px] py-8 text-center text-[12.5px] text-ink-3">
            No players on roster yet.
          </div>
        ) : visible.length === 0 ? (
          <div className="px-[18px] py-8 text-center text-[12.5px] text-ink-3">
            {filter === "questionable"
              ? "Nobody questionable — everyone's good to go."
              : "Nobody out today."}
          </div>
        ) : (
          visible.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPlayer(p)}
              className="w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-[18px] py-2.5 border-b border-hair-2 last:border-b-0 hover:bg-paper active:bg-paper-deep transition-colors text-[13px] text-left"
            >
              {/* Jersey — fixed width, mono, right-aligned so #s line up. */}
              <div className="font-mono text-[11px] text-ink-3 w-7 shrink-0 text-right tabular-nums">
                #{p.jerseyNumber}
              </div>
              {/* Avatar — same size at every breakpoint. */}
              <Avatar size="sm" color={p.avatarColor} initials={p.initials} />
              {/* Name — flex-1, single line truncate. No secondary
                  metadata stuffed inline; year/pos live in their own
                  fixed columns on the right so they line up. */}
              <div className="min-w-0 flex-1 font-semibold truncate">
                {p.firstName} {p.lastName}
              </div>
              {/* Year — fixed-width column, uppercase tracking. */}
              <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink-3 w-7 shrink-0 text-center tabular-nums">
                {p.classYearShort}
              </div>
              {/* Position — fixed-width column. Truncate at the column
                  boundary so multi-position players don't push others. */}
              <div className="font-mono text-[10.5px] text-ink-3 w-12 sm:w-14 shrink-0 truncate">
                {p.positions.join("/")}
              </div>
              {/* Status pill — fixed slot so all pills stack vertically. */}
              <div className="shrink-0 w-[78px] sm:w-[88px] flex justify-end">
                {p.availabilityStatus === "ok" && <Badge variant="keep">Available</Badge>}
                {p.availabilityStatus === "questionable" && (
                  <Badge variant="bubble">{p.availabilityNote ?? "Q"}</Badge>
                )}
                {p.availabilityStatus === "out" && (
                  <Badge variant="cut">{p.availabilityNote ?? "Out"}</Badge>
                )}
              </div>
              {/* Stat — far right, hidden on small phones to keep the
                  row scannable. */}
              <div
                className={cn(
                  "hidden md:block w-[72px] font-mono text-[11px] text-right shrink-0 tabular-nums",
                  p.statEmphasis === "attention" ? "text-red" : "text-ink-3",
                )}
              >
                {p.stat}
              </div>
            </button>
          ))
        )}
      </div>
      <div className="px-[18px] py-2.5 border-t border-hair-2 text-[12px] text-ink-3 flex items-center">
        {hiddenInFilter > 0 && filter !== "all"
          ? `+${hiddenInFilter} more in this filter · `
          : extraCount > 0
            ? `+${extraCount} more · `
            : ""}
        <Link href="/app/roster" className="ml-1.5 text-red font-semibold">
          View full roster →
        </Link>
      </div>
    </Panel>
  );
}

function ThisWeekPanel({ items: MOCK_WEEK }: { items: MockScheduleItem[] }) {
  return (
    <Panel>
      <PanelHead
        title="This week"
        actions={
          <Link href="/app/schedule" className="text-[13px] text-ink-3 hover:text-ink px-1.5 py-1">
            View all →
          </Link>
        }
      />
      <div>
        {MOCK_WEEK.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-[18px] py-3 border-b border-hair-2 last:border-b-0"
          >
            <div className="w-[42px] text-center shrink-0">
              <div className="font-display text-[20px] font-semibold leading-none">
                {item.date.day}
              </div>
              <div className="mt-0.5 text-[9.5px] font-bold text-ink-3 uppercase tracking-[0.08em]">
                {item.date.month}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold">
                {item.emphasis ? (
                  <>
                    {item.title.split("·")[0].trim()}{" "}
                    <span className="text-red">· {item.title.split("·")[1]?.trim() || ""}</span>
                  </>
                ) : (
                  item.title
                )}
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink-3">{item.sub}</div>
            </div>
            <ScheduleTag kind={item.tag} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TodayPlanPanel() {
  return (
    <Panel>
      <PanelHead
        title="Today’s plan"
        actions={
          <Link href="/app/practice" className="text-[13px] text-ink-3 hover:text-ink px-1.5 py-1">
            Open editor →
          </Link>
        }
      />
      <div className="p-[18px] space-y-2.5">
        {[
          { time: "3:30", name: "Warm-up + throwing", focus: "Long-toss → short arc" },
          { time: "3:50", name: "Situational BP", focus: "Runners on 2nd, 0/1 outs" },
          { time: "4:30", name: "Infield / outfield", focus: "Cut-off depth + angles" },
          { time: "5:00", name: "Live at-bats", focus: "Bullpen vs hitter cycle" },
        ].map((b, i) => (
          <div
            key={i}
            className="flex gap-3 px-3 py-2.5 rounded-md bg-paper border-l-[3px] border-l-red hover:bg-paper-deep transition-colors"
          >
            <div className="shrink-0 w-11">
              <div className="font-mono text-[12px] font-bold">{b.time}</div>
              <div className="font-mono text-[10.5px] text-ink-3">20 min</div>
            </div>
            <div className="min-w-0">
              <div className="type-label">Hitting</div>
              <div className="mt-0.5 font-display text-[14px] font-semibold">{b.name}</div>
              <div className="mt-0.5 text-[11px] italic text-ink-3">{b.focus}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ActivityFeedPanel({ events }: { events: ActivityEvent[] }) {
  return (
    <Panel>
      <PanelHead
        title="Activity"
        actions={
          <span className="text-[11px] text-ink-3 font-mono">
            {events.length > 0 ? `last ${events.length}` : "last 2 weeks"}
          </span>
        }
      />
      {events.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-[13px] font-semibold text-ink-2">
            No activity yet
          </div>
          <div className="mt-1 text-[11.5px] text-ink-3 max-w-[320px] mx-auto leading-relaxed">
            Score tryouts, add player notes, schedule games — your activity feed
            fills in as your program gets going.
          </div>
        </div>
      ) : (
        <div>
          {events.map((e) => (
            <FeedItem key={e.id} icon={e.icon} iconColor={e.iconColor} meta={e.meta}>
              <span
                // e.content is built server-side from our own code, not user
                // input — safe to render as HTML. If this ever starts
                // including player-supplied strings, sanitize first.
                dangerouslySetInnerHTML={{ __html: e.content }}
              />
            </FeedItem>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Side column sections ─────────────────────────────────────────
// (LiveAICoachCard imported from components/organisms/ai-coach-card)

function QuickActionsPanel({
  onAddPlayer,
  onImport,
  onNewGame,
  onNewPractice,
}: {
  onAddPlayer: () => void;
  onImport: () => void;
  onNewGame: () => void;
  onNewPractice: () => void;
}) {
  const actions: Array<
    | { ic: string; t: string; s: string; href: string; onClick?: never }
    | { ic: string; t: string; s: string; onClick: () => void; href?: never }
  > = [
    { ic: "+", t: "Add player", s: "Manual entry", onClick: onAddPlayer },
    { ic: "↑", t: "Import CSV", s: "GC / MaxPreps", onClick: onImport },
    { ic: "⚔", t: "Add game", s: "Schedule one", onClick: onNewGame },
    { ic: "◎", t: "Add practice", s: "Plan a session", onClick: onNewPractice },
  ];
  return (
    <Panel>
      <PanelHead title="Quick actions" />
      <div className="grid grid-cols-2 gap-2 p-[14px]">
        {actions.map((q, i) => {
          const klass =
            "flex flex-col gap-1 p-[14px_12px] border border-hair rounded-md bg-card text-left hover:border-ink hover:-translate-y-px transition-all";
          const inner = (
            <>
              <span className="font-display text-[18px] font-bold text-red leading-none">{q.ic}</span>
              <span className="mt-1 text-[12.5px] font-semibold">{q.t}</span>
              <span className="text-[10.5px] text-ink-3">{q.s}</span>
            </>
          );
          if (q.href) {
            return (
              <Link key={i} href={q.href} className={klass}>
                {inner}
              </Link>
            );
          }
          return (
            <button key={i} onClick={q.onClick} className={klass}>
              {inner}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function MessagesPanel({ threads }: { threads: InboxThread[] }) {
  const unreadTotal = threads.reduce((n, t) => n + t.unreadCount, 0);
  const preview = threads.slice(0, 4);
  return (
    <Panel>
      <PanelHead
        title="Messages"
        actions={
          <div className="flex items-center gap-2">
            {unreadTotal > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red text-white text-[10px] font-bold px-1">
                {unreadTotal}
              </span>
            )}
            <Link
              href="/app/messages"
              className="text-[13px] text-ink-3 hover:text-ink px-1.5 py-1"
            >
              Inbox →
            </Link>
          </div>
        }
      />
      {preview.length === 0 ? (
        <div className="p-5">
          <div className="type-label mb-1">Quiet so far</div>
          <div className="text-[12.5px] text-ink-3 leading-relaxed">
            Start a DM with any player on your roster, or send a team-wide
            announcement from{" "}
            <Link href="/app/messages" className="text-red font-semibold">
              Messages
            </Link>
            .
          </div>
        </div>
      ) : (
        <div>
          {preview.map((t) => (
            <Link
              key={t.threadId}
              href={`/app/messages/${t.threadId}`}
              className="flex gap-2.5 px-[18px] py-3 border-b border-hair-2 last:border-b-0 hover:bg-paper transition-colors"
            >
              <Avatar
                size="md"
                color={(t.counterparty?.avatarColor ?? "ink") as "ink"}
                initials={(t.counterparty?.displayName ?? "?")
                  .split(" ")
                  .map((w) => w[0] ?? "")
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 mb-0.5">
                  <span
                    className={cn(
                      "text-[13px] truncate",
                      t.unreadCount > 0 ? "font-bold" : "font-semibold",
                    )}
                  >
                    {t.counterparty?.displayName ?? "Unknown"}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[10.5px] text-ink-4">
                    {formatShortTime(t.lastMessageAt)}
                  </span>
                </div>
                <div
                  className={cn(
                    "text-[12px] truncate",
                    t.unreadCount > 0 ? "text-ink font-medium" : "text-ink-2",
                  )}
                >
                  {t.preview ?? "—"}
                </div>
              </div>
              {t.unreadCount > 0 && (
                <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-red" />
              )}
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PlayerSpotlightPanel({ spotlight }: { spotlight: SpotlightPlayer | null }) {
  if (!spotlight) {
    return (
      <Panel>
        <PanelHead title="Player spotlight" />
        <div className="p-5">
          <div className="type-label mb-1">Lights up after tryouts</div>
          <div className="text-[13px] font-semibold">
            We&apos;ll pick a standout for you
          </div>
          <div className="mt-1.5 text-[11.5px] text-ink-3 leading-relaxed">
            Once your players have tryout measurables, we&apos;ll highlight the
            top performer here automatically — the kind of player worth
            surfacing on your social feed or to a recruiter.
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHead title="Player spotlight" />
      <div className="p-[18px]">
        <Link
          href={`/p/${spotlight.handle}`}
          className="flex items-center gap-3 mb-3.5 hover:opacity-90"
        >
          <Avatar
            size="lg"
            color={avatarColorFromSeed(spotlight.playerId)}
            initials={spotlight.initials.toUpperCase()}
          />
          <div className="min-w-0">
            <div className="font-display text-[16px] font-semibold tracking-tight truncate">
              {spotlight.firstName} {spotlight.lastName}
            </div>
            <div className="font-mono text-[11px] text-ink-3 mt-0.5">
              {spotlight.jerseyNumber ? `#${spotlight.jerseyNumber} · ` : ""}
              {spotlight.classYear}
              {spotlight.positions.length > 0 ? ` · ${spotlight.positions.join("/")}` : ""}
            </div>
          </div>
        </Link>
        <div className="text-[12.5px] text-ink-2 px-3 py-2.5 bg-paper rounded-md border-l-[3px] border-l-red leading-relaxed">
          {spotlight.reason}
        </div>
        {spotlight.stats.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {spotlight.stats.map((s, i) => (
              <div key={i} className="text-center px-1 py-2 bg-paper rounded-sm">
                <div className="font-mono text-[14px] font-semibold">{s.value}</div>
                <div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

// ── Bits ─────────────────────────────────────────────────────────

/**
 * buildSubtitle — compose an honest one-line status for the header.
 * Prefers live signals: next game, unavailable players, weekly counts.
 */
function buildSubtitle({
  nextGame,
  weekGameCount,
  weekPracticeCount,
  outCount,
  questionableCount,
}: {
  nextGame: HubViewProps["nextGame"];
  weekGameCount: number;
  weekPracticeCount: number;
  outCount: number;
  questionableCount: number;
}): string {
  const parts: string[] = [];
  if (nextGame) {
    parts.push(
      `Next up: ${nextGame.dateLabel} vs ${nextGame.opponent}${nextGame.location ? ` at ${nextGame.location}` : ""}.`,
    );
  }
  const weekTotal = weekGameCount + weekPracticeCount;
  if (weekTotal > 0) {
    parts.push(
      `${weekGameCount} game${weekGameCount === 1 ? "" : "s"} · ${weekPracticeCount} practice${weekPracticeCount === 1 ? "" : "s"} this week.`,
    );
  }
  if (outCount + questionableCount > 0) {
    const bits: string[] = [];
    if (outCount > 0) bits.push(`${outCount} out`);
    if (questionableCount > 0) bits.push(`${questionableCount} questionable`);
    parts.push(`${bits.join(", ")}.`);
  }
  if (parts.length === 0) return "No upcoming events scheduled yet — quick-add a game or practice to get started.";
  return parts.join(" ");
}

function ScheduleTag({ kind }: { kind: "PRAC" | "GAME" | "TRV" }) {
  const styles: Record<typeof kind, string> = {
    PRAC: "bg-paper-deep text-ink-2",
    GAME: "bg-red-soft text-red",
    TRV: "bg-grass-dim text-grass",
  };
  return (
    <span
      className={cn(
        "shrink-0 px-[7px] py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-[0.04em]",
        styles[kind],
      )}
    >
      {kind}
    </span>
  );
}
