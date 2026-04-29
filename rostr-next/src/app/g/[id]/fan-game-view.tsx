"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Clock,
  Share2,
  Trophy,
  Radio,
  CheckCircle2,
  ArrowRight,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/atoms/logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { GameEvent, LiveGameState } from "@/lib/services/live-scoring";
import { DiamondViz, batterTerminalBase, type Base } from "./diamond-viz";
import { buildBoxScore } from "@/lib/services/box-score";
import { BoxScoreView } from "./box-score-view";

/**
 * FanGameView — public-facing read-only live game viewer.
 *
 * Subscribes to postgres_changes on the game's event stream and
 * appends new events live. No scoring controls. No private data.
 *
 * Sprint update — In-Game Scoring UX Enhancement:
 *   - Inning-grouped play feed (Top 3rd / Bottom 3rd headers)
 *   - Player names linked to /p/{handle} when a profile exists
 *   - Jersey badges + season BA inline on hits
 *   - Diamond viz showing where the last batter ended up
 *   - "Now batting" + "On deck" derived from lineup_entries when our
 *     team is at bat (no data for opposing team yet — slot ready)
 *   - Pitcher slot present in scoreboard but renders "—" until the
 *     scoring engine tracks pitchers (forward-compat slot)
 */

export interface PlayerLink {
  id: string;
  handle: string | null;
  jersey: number | null;
  ba: number | null; // season BA, 0–1.0
  /** Full display name. Used to resolve runner-on-base ids and pitcher
   *  ids → human labels without per-row fetches. Optional because the
   *  events-only links built first don't carry it; the roster pass
   *  enriches with it. */
  name?: string;
}

export interface LineupSlot {
  battingOrder: number;
  position: string;
  playerId: string;
  firstName: string;
  lastName: string;
  jersey: number | null;
  handle: string | null;
}

export function FanGameView({
  gameId,
  programName,
  game,
  initialState,
  initialEvents,
  playerLinks,
  lineup,
}: {
  gameId: string;
  programName: string;
  game: {
    opponent: string;
    dateLabel: string;
    timeLabel: string;
    location: string;
    level: string | null;
    home: boolean;
  };
  initialState: LiveGameState;
  initialEvents: GameEvent[];
  playerLinks: Record<string, PlayerLink>;
  lineup: LineupSlot[];
}) {
  const [events, setEvents] = useState<GameEvent[]>(initialEvents);
  const [liveStatus, setLiveStatus] = useState(initialState.liveStatus);

  // Realtime subscription to the home-side event stream.
  // Subscribes to BOTH inserts (new events) AND updates (payload merges
  // — e.g. pitches, runners, pitcher attached to an at-bat after the
  // initial insert). Without UPDATE handling the diamond + pitch chip
  // would be stale until refresh.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`fan:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_events",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.logged_by_side !== "home") return;
          if (row.event_type === "game_end") setLiveStatus("final");
          if (row.event_type === "game_start") setLiveStatus("in_progress");
          setEvents((prev) => {
            if (prev.some((e) => e.id === row.id)) return prev;
            const next: GameEvent = {
              id: row.id as string,
              gameId: row.game_id as string,
              sequence: row.sequence as number,
              eventType: row.event_type as GameEvent["eventType"],
              inning: (row.inning as number | null) ?? null,
              topBottom: (row.top_bottom as "top" | "bottom" | null) ?? null,
              outsAfter: (row.outs_after as number | null) ?? null,
              homeScore: (row.home_score as number | null) ?? null,
              awayScore: (row.away_score as number | null) ?? null,
              playerName: null,
              playerJersey: null,
              playerId: (row.player_id as string | null) ?? null,
              payload: (row.payload as Record<string, unknown>) ?? {},
              createdAt: row.created_at as string,
              loggedBySide: "home",
            };
            return [...prev, next].sort((a, b) => a.sequence - b.sequence);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_events",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.logged_by_side !== "home") return;
          // Merge the updated payload into our local copy. Fields like
          // pitches, runnersAfter, pitcherId are added in a second-phase
          // UPDATE after the at-bat's INSERT — without subscribing here
          // the diamond + pitch chip would lag until page refresh.
          setEvents((prev) =>
            prev.map((e) =>
              e.id === row.id
                ? {
                    ...e,
                    payload: (row.payload as Record<string, unknown>) ?? e.payload,
                    homeScore: (row.home_score as number | null) ?? e.homeScore,
                    awayScore: (row.away_score as number | null) ?? e.awayScore,
                    outsAfter: (row.outs_after as number | null) ?? e.outsAfter,
                  }
                : e,
            ),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const lastEvent = events[events.length - 1] ?? null;
  const lastAtBat = useMemo(
    () =>
      [...events]
        .reverse()
        .find(
          (e) =>
            e.eventType === "at_bat" &&
            !isNonAtBatPayload(e.payload),
        ) ?? null,
    [events],
  );
  // For runners + pitcher we want the most recent payload-carrying
  // event, INCLUDING pickoffs (since pickoffs update runnersAfter).
  const lastEventWithRunners = useMemo(
    () =>
      [...events]
        .reverse()
        .find(
          (e) =>
            e.eventType === "at_bat" &&
            (e.payload as { runnersAfter?: unknown }).runnersAfter !== undefined,
        ) ?? null,
    [events],
  );

  const currentInning = lastEvent?.inning ?? 1;
  const currentHalf = (lastEvent?.topBottom ?? "top") as "top" | "bottom";
  const currentOuts = lastEvent?.outsAfter ?? 0;
  const homeScore = lastEvent?.homeScore ?? 0;
  const awayScore = lastEvent?.awayScore ?? 0;

  const ourScore = game.home ? homeScore : awayScore;
  const theirScore = game.home ? awayScore : homeScore;

  // We are batting in the bottom half if we're home; in the top if away.
  // (Standard baseball convention: home bats bottom.)
  const weAreBatting = game.home ? currentHalf === "bottom" : currentHalf === "top";

  // Derive Now batting + On deck from the lineup. Falls back to whatever
  // the last at-bat told us if our lineup isn't loaded.
  const nowBatting = useMemo<LineupSlot | null>(() => {
    if (!weAreBatting || lineup.length === 0) return null;
    if (!lastAtBat || !lastAtBat.playerId) return lineup[0] ?? null;
    const lastIdx = lineup.findIndex((l) => l.playerId === lastAtBat.playerId);
    if (lastIdx < 0) return lineup[0] ?? null;
    return lineup[(lastIdx + 1) % lineup.length] ?? null;
  }, [weAreBatting, lineup, lastAtBat]);

  const onDeck = useMemo<LineupSlot | null>(() => {
    if (!nowBatting || lineup.length === 0) return null;
    const i = lineup.findIndex((l) => l.playerId === nowBatting.playerId);
    if (i < 0) return null;
    return lineup[(i + 1) % lineup.length] ?? null;
  }, [nowBatting, lineup]);

  // Last play → diamond highlight. Show only while live.
  const diamondHighlight = useMemo(() => {
    if (liveStatus !== "in_progress" || !lastAtBat) return null;
    return batterTerminalBase(String(lastAtBat.payload.outcome ?? ""));
  }, [lastAtBat, liveStatus]);

  // Derive current bases from the most recent runner-bearing event
  // (which includes pickoffs — they update runnersAfter too).
  // Bases clear at the start of each half-inning (outs === 0).
  const currentBases = useMemo<Set<Base>>(() => {
    if (currentOuts === 0 || !lastEventWithRunners) return new Set<Base>();
    const r = (lastEventWithRunners.payload.runnersAfter ?? null) as
      | { 1?: string | null; 2?: string | null; 3?: string | null }
      | null;
    if (!r) return new Set<Base>();
    const s = new Set<Base>();
    if (r[1]) s.add(1);
    if (r[2]) s.add(2);
    if (r[3]) s.add(3);
    return s;
  }, [lastEventWithRunners, currentOuts]);

  // Derive current pitcher from the most recent at_bat's pitcherId.
  // Pitching change is implicit: when a new at-bat carries a different
  // pitcherId, the displayed pitcher updates.
  //
  // When WE'RE batting (opponent on the mound), the at-bat carries
  // payload.opposingPitcherName (free-text — no roster id). We surface
  // that as the pitcher name in that case.
  const currentPitcher = useMemo(() => {
    if (!lastAtBat) return null;
    const oppName = (lastAtBat.payload.opposingPitcherName ?? null) as
      | string
      | null;
    if (oppName && weAreBatting) {
      return { id: null, name: oppName, jersey: null, handle: null };
    }
    const id = (lastAtBat.payload.pitcherId ?? null) as string | null;
    if (!id) return null;
    const link = playerLinks[id] ?? null;
    if (!link) return { id, name: null, jersey: null, handle: null };
    return {
      id,
      name: link.name ?? null,
      jersey: link.jersey,
      handle: link.handle,
    };
  }, [lastAtBat, playerLinks, weAreBatting]);

  // Group at-bat events by inning + half for the play feed.
  const grouped = useMemo(() => groupEventsByInning(events), [events]);

  // Box score derivation from existing event data (no scoring engine
  // changes required). Memoized so we only recompute on event change.
  const boxScore = useMemo(() => buildBoxScore(events), [events]);

  // Tab state — "feed" while live (most actionable), "box" once final
  // (post-game summary). Coach can switch any time.
  const [tab, setTab] = useState<"feed" | "box">(
    liveStatus === "final" ? "box" : "feed",
  );
  // When a game flips from in_progress → final, auto-switch the tab to
  // box (only if the user hasn't manually picked feed).
  const lastAutoSwitch = useRef<LiveGameState["liveStatus"] | null>(null);
  useEffect(() => {
    if (lastAutoSwitch.current === liveStatus) return;
    lastAutoSwitch.current = liveStatus;
    if (liveStatus === "final") setTab("box");
  }, [liveStatus]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied — share with fans");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Top bar */}
      <div className="bg-ink text-white px-3 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90">
          <LogoMark size="md" variant="light" />
          <span className="font-display text-[14px] font-bold tracking-tight hidden sm:inline">
            rostr
          </span>
        </Link>
        <div className="flex-1 min-w-0 text-center">
          <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-white/60 truncate">
            {programName}
            {game.level ? ` · ${game.level}` : ""}
          </div>
          <div className="font-display text-[14px] font-semibold truncate flex items-center justify-center gap-1.5">
            {game.home ? "vs" : "@"} {game.opponent}
            {liveStatus === "in_progress" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red rounded-xs text-[9px] font-bold tracking-[0.08em] uppercase">
                <Radio className="w-2.5 h-2.5 animate-pulse-live" />
                Live
              </span>
            )}
            {liveStatus === "final" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-grass-dim text-grass rounded-xs text-[9px] font-bold tracking-[0.08em] uppercase">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Final
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={share}
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-sm hover:bg-white/10"
          aria-label="Share fan link"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Scoreboard */}
      <GameScoreboard
        homeLabel={game.home ? "Us" : game.opponent.slice(0, 12)}
        awayLabel={game.home ? game.opponent.slice(0, 12) : "Us"}
        ourScore={ourScore}
        theirScore={theirScore}
        inning={currentInning}
        half={currentHalf}
        outs={currentOuts}
        nowBatting={nowBatting}
        onDeck={onDeck}
        diamondHighlight={diamondHighlight}
        liveStatus={liveStatus}
        dateLabel={game.dateLabel}
        timeLabel={game.timeLabel}
        location={game.location}
        weAreBatting={weAreBatting}
        bases={currentBases}
        currentPitcher={currentPitcher}
      />

      {/* Not started */}
      {liveStatus === "not_started" && events.length === 0 && (
        <div className="p-8 text-center">
          <Trophy className="w-10 h-10 text-ink-4 mx-auto" />
          <div className="font-display text-[18px] font-semibold tracking-tight mt-3">
            Game hasn&apos;t started yet
          </div>
          <p className="text-[12.5px] text-ink-3 mt-1 max-w-[320px] mx-auto">
            Pin this tab and we&apos;ll auto-refresh when the coach tips off.
          </p>
        </div>
      )}

      {/* Tab strip — toggles between play feed and box score */}
      {events.length > 0 && (
        <div className="border-b border-hair bg-card sticky top-[64px] z-10">
          <div className="max-w-md mx-auto px-4">
            <div className="grid grid-cols-2">
              <TabButton
                active={tab === "feed"}
                onClick={() => setTab("feed")}
                label="Play-by-play"
              />
              <TabButton
                active={tab === "box"}
                onClick={() => setTab("box")}
                label="Box score"
              />
            </div>
          </div>
        </div>
      )}

      {/* Box score view */}
      {tab === "box" && events.length > 0 && (
        <div className="flex-1 overflow-auto">
          <div className="max-w-md mx-auto p-4">
            <BoxScoreView
              box={boxScore}
              playerLinks={playerLinks}
              programName={programName}
              ourScore={ourScore}
              theirScore={theirScore}
              isFinal={liveStatus === "final"}
            />
          </div>
        </div>
      )}

      {/* Inning-grouped play feed */}
      {tab === "feed" && grouped.length > 0 && (
        <div className="flex-1 overflow-auto">
          <div className="max-w-md mx-auto p-4">
            <div className="type-label mb-3 flex items-center justify-between">
              <span>Play-by-play</span>
              <span className="text-ink-3 font-mono normal-case tracking-normal">
                {events.filter((e) => e.eventType === "at_bat" && !isNonAtBatPayload(e.payload)).length} at-bats
              </span>
            </div>
            <div className="space-y-4">
              {grouped.map((group) => (
                <div key={`${group.inning}-${group.half}`}>
                  <div
                    className={cn(
                      // Sticky below the top bar (~60px) + tab strip (44px).
                      "sticky top-[104px] z-[5] -mx-4 px-4 py-1.5 bg-paper/95 backdrop-blur-sm",
                      "flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em]",
                      group.half === "top" ? "text-ink-2" : "text-red",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[9px] font-bold",
                        group.half === "top" ? "bg-ink-2" : "bg-red",
                      )}
                    >
                      {group.half === "top" ? "T" : "B"}
                    </span>
                    <span>
                      {group.half === "top" ? "Top" : "Bottom"} of the{" "}
                      {ordinal(group.inning)}
                    </span>
                    <span className="ml-auto font-mono normal-case tracking-normal text-ink-3">
                      {group.events.filter((e) => e.eventType === "at_bat" && !isNonAtBatPayload(e.payload)).length}{" "}
                      AB
                    </span>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {group.events.map((e) => (
                      <EventCard
                        key={e.id}
                        event={e}
                        playerLink={
                          e.playerId ? playerLinks[e.playerId] ?? null : null
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fan subscription teaser — shown at bottom */}
      <div className="bg-ink text-white px-4 py-4 mt-auto">
        <div className="max-w-md mx-auto text-center">
          <div className="type-label !text-white/60 mb-1">Follow {programName}</div>
          <div className="text-[13px] text-white/80 leading-relaxed">
            Get game alerts, roster updates, and live feeds for every game.
          </div>
          <button
            type="button"
            onClick={() => toast.info("Fan subscriptions launching soon — $5/month per team")}
            className="mt-3 min-h-[40px] inline-flex items-center gap-1.5 px-4 bg-red hover:bg-red/90 text-white rounded-sm text-[13px] font-semibold"
          >
            Become a fan · $5/mo
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Scoreboard ────────────────────────────────────────────────

function GameScoreboard({
  homeLabel,
  awayLabel,
  ourScore,
  theirScore,
  inning,
  half,
  outs,
  nowBatting,
  onDeck,
  diamondHighlight,
  liveStatus,
  dateLabel,
  timeLabel,
  location,
  weAreBatting,
  bases,
  currentPitcher,
}: {
  homeLabel: string;
  awayLabel: string;
  ourScore: number;
  theirScore: number;
  inning: number;
  half: "top" | "bottom";
  outs: number;
  nowBatting: LineupSlot | null;
  onDeck: LineupSlot | null;
  diamondHighlight: ReturnType<typeof batterTerminalBase>;
  liveStatus: LiveGameState["liveStatus"];
  dateLabel: string;
  timeLabel: string;
  location: string;
  weAreBatting: boolean;
  /** Bases occupied — derived from latest at_bat's runnersAfter. */
  bases: Set<Base>;
  /** Active pitcher, if known from at_bat payload. `id` is null when
   *  the pitcher is the opposing pitcher (free-text name only — no
   *  roster row). */
  currentPitcher: {
    id: string | null;
    name: string | null;
    jersey: number | null;
    handle: string | null;
  } | null;
}) {
  const isLive = liveStatus === "in_progress";
  return (
    <div className="bg-card border-b border-hair">
      <div className="max-w-md mx-auto px-4 py-5">
        {/* Score row */}
        <div className="grid grid-cols-[1fr_120px_1fr] items-center gap-3">
          <div className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
              {homeLabel}
            </div>
            <div className="font-mono text-[64px] sm:text-[72px] font-bold leading-none tracking-[-0.04em] mt-2">
              {ourScore}
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-[10px] text-ink-3 font-bold uppercase">
              {half === "top" ? "Top" : "Bot"}
            </div>
            <div className="font-mono text-[32px] font-bold leading-none mt-1">
              {inning}
            </div>
            <div className="mt-1.5 inline-flex items-center justify-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full border",
                    i < outs
                      ? "bg-red border-red"
                      : "bg-transparent border-ink-3/40",
                  )}
                  aria-label={i < outs ? "out" : "no out"}
                />
              ))}
            </div>
            <div className="font-mono text-[10px] text-ink-3 mt-1">
              {outs} out
            </div>
          </div>
          <div className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
              {awayLabel}
            </div>
            <div className="font-mono text-[64px] sm:text-[72px] font-bold leading-none tracking-[-0.04em] mt-2 text-ink-3">
              {theirScore}
            </div>
          </div>
        </div>

        {/* Diamond + batter + pitcher card — only when live */}
        {isLive && (
          <div className="mt-4 grid grid-cols-[120px_1fr] gap-3 items-center bg-paper rounded-md p-3">
            <DiamondViz
              size={120}
              highlight={diamondHighlight}
              bases={bases}
              className="text-ink-2"
            />
            <div className="min-w-0">
              {nowBatting && weAreBatting ? (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-red">
                    Now batting
                  </div>
                  <BatterLine slot={nowBatting} primary />
                  {onDeck && (
                    <div className="mt-2.5 pt-2 border-t border-hair-2">
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-3">
                        On deck
                      </div>
                      <BatterLine slot={onDeck} primary={false} />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[12px] text-ink-3 leading-relaxed">
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1">
                    {weAreBatting ? "We're batting" : "Opponent batting"}
                  </div>
                  <div className="text-ink-2">
                    {weAreBatting
                      ? "Lineup not loaded for this game."
                      : "Opposing batter tracking lands in v2."}
                  </div>
                </div>
              )}
              {/* Pitcher slot — populated from the at-bat's pitcherId.
                  Renders "—" for older games scored before pitcher
                  tracking shipped (forward-compat). */}
              <div className="mt-2.5 pt-2 border-t border-hair-2 text-[10.5px] text-ink-3">
                <span className="font-bold uppercase tracking-[0.08em] mr-1.5">
                  Pitcher
                </span>
                {currentPitcher && currentPitcher.name ? (
                  currentPitcher.handle ? (
                    <Link
                      href={`/p/${currentPitcher.handle}`}
                      className="font-semibold text-ink hover:underline"
                    >
                      {currentPitcher.jersey != null && (
                        <span className="font-mono mr-1">
                          #{currentPitcher.jersey}
                        </span>
                      )}
                      {currentPitcher.name}
                    </Link>
                  ) : (
                    <span className="font-semibold text-ink">
                      {currentPitcher.jersey != null && (
                        <span className="font-mono mr-1">
                          #{currentPitcher.jersey}
                        </span>
                      )}
                      {currentPitcher.name}
                    </span>
                  )
                ) : (
                  <span className="font-mono">—</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {dateLabel}
            {timeLabel ? ` · ${timeLabel}` : ""}
          </span>
          {location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {location}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BatterLine({
  slot,
  primary,
}: {
  slot: LineupSlot;
  primary: boolean;
}) {
  const inner = (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {slot.jersey != null && (
        <span
          className={cn(
            "font-mono font-bold rounded-xs px-1.5 py-0.5 text-[10px]",
            primary ? "bg-red text-white" : "bg-paper-deep text-ink-2",
          )}
        >
          #{slot.jersey}
        </span>
      )}
      <span
        className={cn(
          "font-display font-semibold tracking-tight",
          primary ? "text-[15px] text-ink" : "text-[12.5px] text-ink-2",
        )}
      >
        {slot.firstName} {slot.lastName}
      </span>
      <span className="font-mono text-[10.5px] text-ink-3">{slot.position}</span>
    </div>
  );
  if (slot.handle) {
    return (
      <Link href={`/p/${slot.handle}`} className="hover:underline">
        {inner}
      </Link>
    );
  }
  return inner;
}

// ── Inning-grouped feed ───────────────────────────────────────

interface InningGroup {
  inning: number;
  half: "top" | "bottom";
  events: GameEvent[];
}

/**
 * Group the flat event stream by (inning, half), most-recent-first.
 * Within each group, events stay in chronological order so the half
 * reads naturally top-to-bottom. game_start / game_end stay in their
 * native sequence so they appear at the right boundary.
 */
function groupEventsByInning(events: GameEvent[]): InningGroup[] {
  const groups: InningGroup[] = [];
  for (const e of events) {
    if (e.inning == null || e.topBottom == null) {
      // Bookend events (game_start / game_end). Pin them to their
      // adjacent inning's group when possible; otherwise drop in a
      // pseudo group keyed by sequence so they still render.
      const lastGroup = groups[groups.length - 1];
      if (lastGroup) {
        lastGroup.events.push(e);
        continue;
      }
      groups.push({ inning: 1, half: "top", events: [e] });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last && last.inning === e.inning && last.half === e.topBottom) {
      last.events.push(e);
    } else {
      groups.push({ inning: e.inning, half: e.topBottom, events: [e] });
    }
  }
  // Most recent half-inning at the top. Within each group, keep events
  // chronological so the natural reading order holds.
  return groups.reverse();
}

// ── Event card (player-linked) ────────────────────────────────

function EventCard({
  event,
  playerLink,
}: {
  event: GameEvent;
  playerLink: PlayerLink | null;
}) {
  if (event.eventType === "game_start") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-paper rounded-sm text-[12px] text-ink-3 italic">
        <Radio className="w-3 h-3 shrink-0 text-red" /> Game is live — first pitch
      </div>
    );
  }
  if (event.eventType === "game_end") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-grass-dim text-grass rounded-sm text-[12.5px] font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        Game final · {event.homeScore}-{event.awayScore}
      </div>
    );
  }
  if (event.eventType !== "at_bat") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-paper rounded-sm text-[12px] text-ink-3 italic">
        {event.eventType}
      </div>
    );
  }
  const outcome = String(event.payload.outcome ?? "—");
  const label = atBatLabel(outcome);
  const jersey = event.playerJersey ?? playerLink?.jersey ?? null;
  const handle = playerLink?.handle ?? null;
  const ba = playerLink?.ba ?? null;
  const playerName = event.playerName ?? "Unknown batter";

  // Pitch sequence (optional payload field — present when the at-bat
  // was scored in pitch-by-pitch mode; absent in simple mode). Render
  // a tiny B-S-F summary so fans can see "5 pitches" or the actual
  // sequence without expanding anything.
  const pitches = Array.isArray(event.payload.pitches)
    ? (event.payload.pitches as Array<{ kind: string; n: number }>)
    : null;
  const finalCount = (event.payload.finalCount as
    | { balls: number; strikes: number }
    | null
    | undefined) ?? null;
  const pitchSeq = pitches && pitches.length > 0
    ? pitches
        .map((p) =>
          p.kind === "ball" ? "B" : p.kind === "strike" ? "S" : p.kind === "foul" ? "F" : "·",
        )
        .join("-")
    : null;

  const nameNode = (
    <span className="text-[13px] font-semibold truncate">
      {playerName}
    </span>
  );

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-card border border-hair-2 rounded-sm">
      <span
        className={cn(
          "font-mono text-[11px] font-bold min-w-[36px] text-center px-1.5 py-1 rounded-xs",
          outcomeColor(outcome),
        )}
      >
        {outcome}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {jersey != null && (
            <span className="font-mono font-bold bg-paper text-ink-2 rounded-xs px-1 py-0.5 text-[9.5px]">
              #{jersey}
            </span>
          )}
          {handle ? (
            <Link
              href={`/p/${handle}`}
              className="hover:underline inline-flex items-center gap-1"
              prefetch={false}
            >
              {nameNode}
              <ArrowRight className="w-3 h-3 text-ink-3" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1">
              {!handle && <User className="w-3 h-3 text-ink-4" />}
              {nameNode}
            </span>
          )}
          {ba != null && ba > 0 && (
            <span className="font-mono text-[10px] text-ink-3">
              · {formatBa(ba)}
            </span>
          )}
        </div>
        <div className="text-[10.5px] text-ink-3 mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span>{label}</span>
          {pitches && pitches.length > 0 && (
            <>
              <span className="text-ink-4">·</span>
              <span
                className="font-mono"
                title={pitchSeq ?? undefined}
              >
                {pitches.length}p
                {finalCount && (
                  <span className="ml-1 text-ink-3">
                    {finalCount.balls}-{finalCount.strikes}
                  </span>
                )}
              </span>
            </>
          )}
        </div>
      </div>
      <span className="font-mono text-[11px] text-ink-3 shrink-0">
        {event.homeScore}-{event.awayScore}
      </span>
    </div>
  );
}

/**
 * isNonAtBatPayload — true when the event's payload represents a play
 * that ISN'T a real at-bat (pickoffs, mid-game events, substitutions,
 * bases corrections). Used to filter the AB-count badge so e.g. "5 AB"
 * doesn't count "Wild pitch" as a plate appearance.
 */
function isNonAtBatPayload(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  return (
    (payload as { pickoff?: boolean }).pickoff === true ||
    (payload as { midGame?: boolean }).midGame === true ||
    (payload as { substitution?: boolean }).substitution === true
  );
}

function atBatLabel(outcome: string): string {
  const map: Record<string, string> = {
    "1B": "Single",
    "2B": "Double",
    "3B": "Triple",
    HR: "Home run",
    BB: "Walk",
    HBP: "Hit by pitch",
    K: "Strikeout",
    GO: "Ground out",
    FO: "Fly out",
    E: "Reached on error",
    FC: "Fielder's choice",
    SAC: "Sacrifice",
    GIDP: "Grounded into DP",
    CI: "Catcher's interference",
    pickoff: "Picked off",
    stolen_base: "Stolen base",
    caught_stealing: "Caught stealing",
    wild_pitch: "Wild pitch",
    passed_ball: "Passed ball",
    balk: "Balk",
    bases_correction: "Bases corrected",
    pinch_hit: "Pinch hitter in",
    pinch_run: "Pinch runner in",
    defensive: "Defensive sub",
  };
  return map[outcome] ?? outcome;
}

function outcomeColor(o: string): string {
  if (o === "HR") return "bg-red text-white";
  if (o === "1B" || o === "2B" || o === "3B") return "bg-grass-dim text-grass";
  if (o === "BB" || o === "HBP") return "bg-sky-soft text-sky";
  if (o === "K" || o === "GO" || o === "FO" || o === "GIDP") return "bg-red-soft text-red";
  if (o === "CI") return "bg-sky-soft text-sky";
  if (o === "stolen_base" || o === "wild_pitch" || o === "passed_ball" || o === "balk")
    return "bg-amber-soft text-amber";
  if (o === "caught_stealing" || o === "pickoff") return "bg-red-soft text-red";
  if (o === "pinch_hit" || o === "pinch_run" || o === "defensive")
    return "bg-paper-deep text-ink-2";
  if (o === "bases_correction") return "bg-paper-deep text-ink-3";
  return "bg-paper-deep text-ink-2";
}

/**
 * TabButton — segmented-control style tab. 44px tap target, underline
 * accent on active. Used to switch between play-by-play and box score.
 */
function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-[44px] inline-flex items-center justify-center text-[12.5px] font-bold uppercase tracking-[0.06em] transition-colors",
        active
          ? "text-ink border-b-2 border-red"
          : "text-ink-3 hover:text-ink border-b-2 border-transparent",
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function formatBa(ba: number): string {
  // 0.318 → ".318"; 1.000 → "1.000"
  if (ba >= 1) return ba.toFixed(3);
  return ba.toFixed(3).replace(/^0/, "");
}
