/**
 * TeamHome — Coach command center (Direction D).
 *
 * Year-round team-management entry point. Reweighted for daily use, not
 * seasonal tryouts: Game Day flow promoted, evaluation tooling demoted
 * to a seasonal footer.
 *
 * Route: / (default landing)
 */
import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchGames,
  fetchGameReadiness,
  type Game,
} from "@/services/teamService";
import { fetchPracticePlansWithBlockCounts } from "@/services/practiceService";
import {
  Calendar,
  MapPin,
  ChevronRight,
  Swords,
  Dumbbell,
  Users,
  TrendingUp,
  Check,
  Circle,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, startOfDay, addDays, differenceInCalendarDays } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

interface RosterAssignment {
  player_id: string;
  assignment: string;
}

interface PracticePlanWithBlocks {
  id: string;
  title: string;
  practice_date: string;
  team_level: string | null;
  notes: string | null;
  block_count: number;
}

interface AttentionItem {
  key: string;
  title: string;
  subtitle: string;
  cta: string;
  onAction: () => void;
}

// ── Component ──────────────────────────────────────────────────────

export default function TeamHome() {
  const navigate = useNavigate();
  const { coach } = useAuth();

  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<RosterAssignment[]>([]);
  const [practices, setPractices] = useState<PracticePlanWithBlocks[]>([]);
  const [nextGameReadiness, setNextGameReadiness] = useState<{
    rosterCount: number;
    lineupCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const levels = useMemo(() => coach?.program_levels || [], [coach]);

  // ── Fetch ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!coach) return;
    setLoading(true);

    const [gRes, pRes, aRes, prRes] = await Promise.all([
      fetchGames(coach.program_id),
      supabase
        .from("players")
        .select("id, first_name, last_name, created_at")
        .eq("program_id", coach.program_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("roster_assignments")
        .select("player_id, assignment")
        .eq("program_id", coach.program_id),
      fetchPracticePlansWithBlockCounts(coach.program_id),
    ]);

    setGames(gRes.data);
    setPlayers(pRes.data || []);
    setAssignments(aRes.data || []);
    setPractices(prRes.data);
    setLoading(false);
  }, [coach]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived ────────────────────────────────────────────────────

  const today = useMemo(() => startOfDay(new Date()), []);
  const todayStr = useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const weekEnd = useMemo(() => format(addDays(today, 7), "yyyy-MM-dd"), [today]);

  const upcomingGames = useMemo(
    () =>
      games
        .filter((g) => g.game_date >= todayStr && g.status !== "cancelled")
        .sort((a, b) => a.game_date.localeCompare(b.game_date)),
    [games, todayStr]
  );

  const nextGame = upcomingGames[0] || null;
  const daysToNextGame = nextGame
    ? differenceInCalendarDays(parseISO(nextGame.game_date), today)
    : null;

  const upcomingPractices = useMemo(
    () => practices.filter((p) => p.practice_date >= todayStr),
    [practices, todayStr]
  );

  const thisWeekGames = useMemo(
    () => upcomingGames.filter((g) => g.game_date < weekEnd),
    [upcomingGames, weekEnd]
  );

  const thisWeekPractices = useMemo(
    () => upcomingPractices.filter((p) => p.practice_date < weekEnd),
    [upcomingPractices, weekEnd]
  );

  /** Case-insensitive level → count map + unassigned count. */
  const levelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    levels.forEach((l) => counts.set(l, 0));

    const levelLower = new Map<string, string>();
    levels.forEach((l) => levelLower.set(l.toLowerCase(), l));

    assignments.forEach((a) => {
      const displayLevel = levelLower.get(a.assignment.toLowerCase());
      if (displayLevel) counts.set(displayLevel, (counts.get(displayLevel) || 0) + 1);
    });

    const assignedIds = new Set(assignments.map((a) => a.player_id));
    let unassigned = 0;
    players.forEach((p) => {
      if (!assignedIds.has(p.id)) unassigned++;
    });

    return { levels: counts, unassigned, total: players.length };
  }, [levels, assignments, players]);

  /** Load readiness for the next upcoming game. */
  useEffect(() => {
    if (!nextGame) {
      setNextGameReadiness(null);
      return;
    }
    let cancelled = false;
    fetchGameReadiness(nextGame.id).then(({ data }) => {
      if (!cancelled) setNextGameReadiness(data);
    });
    return () => {
      cancelled = true;
    };
  }, [nextGame?.id]);

  /** Needs Attention: daily decisions, not seasonal. */
  const attentionItems = useMemo((): AttentionItem[] => {
    const items: AttentionItem[] = [];
    if (levelCounts.unassigned > 0 && levels.length > 0) {
      items.push({
        key: "unassigned",
        title: `${levelCounts.unassigned} player${levelCounts.unassigned === 1 ? "" : "s"} unassigned`,
        subtitle: `Assign to ${levels.slice(0, 3).join(" · ")} before next game`,
        cta: "Assign",
        onAction: () => navigate("/teams"),
      });
    }
    thisWeekPractices
      .filter((p) => p.block_count === 0)
      .slice(0, 2)
      .forEach((p) => {
        items.push({
          key: `practice-${p.id}`,
          title: `${p.title} has no plan`,
          subtitle: `${format(parseISO(p.practice_date), "EEEE")} · add time blocks`,
          cta: "Plan",
          onAction: () => navigate(`/practice/${p.id}`),
        });
      });
    return items;
  }, [levelCounts.unassigned, levels, thisWeekPractices, navigate]);

  // ── Workspace subtitles (data-aware) ───────────────────────────

  const gameDaySubtitle = nextGame
    ? `${format(parseISO(nextGame.game_date), "EEEE")} · ${nextGame.opponent ? `vs ${nextGame.opponent}` : nextGame.name}`
    : "No upcoming games";

  const practiceSubtitle = (() => {
    const count = thisWeekPractices.length;
    const needsPlan = thisWeekPractices.filter((p) => p.block_count === 0).length;
    if (count === 0) return "None this week";
    const parts = [`${count} this week`];
    if (needsPlan > 0) parts.push(`${needsPlan} need${needsPlan === 1 ? "s" : ""} a plan`);
    return parts.join(" · ");
  })();

  const teamSubtitle =
    levelCounts.total > 0
      ? `${levelCounts.total - levelCounts.unassigned} / ${levelCounts.total} assigned${
          levelCounts.unassigned > 0 ? ` · ${levelCounts.unassigned} open` : ""
        }`
      : "Add players to get started";

  const developmentSubtitle =
    levelCounts.total > 0
      ? `Track metrics · career history`
      : "Build a roster to start tracking";

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4 pb-8 space-y-6 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-muted rounded" />
            <div className="h-3 w-32 bg-muted rounded" />
          </div>
          <div className="h-6 w-16 bg-muted rounded-full" />
        </div>
        <div className="space-y-2.5">
          <div className="h-3 w-28 bg-muted rounded" />
          <div className="h-7 w-64 bg-muted rounded" />
          <div className="h-4 w-52 bg-muted rounded" />
          <div className="h-28 w-full bg-muted rounded-xl mt-3" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-32 bg-muted rounded" />
          <div className="h-16 w-full bg-muted rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-2 w-full bg-muted rounded-full" />
        </div>
      </div>
    );
  }

  // Totally empty program: single onboarding card.
  const isEmpty = players.length === 0 && upcomingGames.length === 0;
  if (isEmpty) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4 pb-8 animate-fade-in">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {coach?.program_name || "Team Home"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {format(new Date(), "EEEE, MMMM d")}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed bg-card/50 p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-extrabold text-base mb-1">Set up your program</h3>
          <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">
            Add players, schedule games, and plan practices to get your program running.
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => navigate("/roster")}
              className="rounded-xl bg-foreground text-background px-4 h-10 text-sm font-bold"
            >
              Add Players
            </button>
            <button
              onClick={() => navigate("/teams")}
              className="rounded-xl border bg-card px-4 h-10 text-sm font-bold"
            >
              Schedule Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  const attentionCount = attentionItems.length;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-8 animate-fade-in space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight leading-tight">
            {coach?.program_name || "Team Home"}
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d")}
            {levelCounts.total > 0 ? ` · ${levelCounts.total} players` : ""}
          </p>
        </div>
        {attentionCount > 0 ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
              {attentionCount} to do
            </span>
          </div>
        ) : levelCounts.total > 0 ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
              On track
            </span>
          </div>
        ) : null}
      </div>

      {/* ── Next Game hero + Game Day Checklist ─────────────────── */}
      {nextGame && (
        <section>
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Next game{daysToNextGame != null ? ` · ${daysToNextGame === 0 ? "today" : daysToNextGame === 1 ? "tomorrow" : `in ${daysToNextGame} days`}` : ""}
            </p>
            {nextGame.team_level && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {nextGame.team_level}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate(`/game/${nextGame.id}`)}
            className="block w-full text-left"
          >
            <p className="text-[26px] font-extrabold leading-none tracking-tight">
              {nextGame.opponent ? `vs ${nextGame.opponent}` : nextGame.name}
            </p>
            <div className="flex items-center gap-2 mt-2 text-[13px] text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                {format(parseISO(nextGame.game_date), "EEE, MMM d")}
                {nextGame.game_time ? ` · ${nextGame.game_time}` : ""}
              </span>
            </div>
            {nextGame.location && (
              <div className="flex items-center gap-2 mt-0.5 text-[12px] text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{nextGame.location}</span>
              </div>
            )}
          </button>

          {/* Game Day Checklist */}
          {nextGameReadiness && (
            <div className="mt-4 rounded-xl border bg-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Game Day Checklist
              </p>
              <div className="space-y-2">
                <ChecklistRow
                  done={nextGameReadiness.rosterCount > 0}
                  label={
                    nextGameReadiness.rosterCount > 0
                      ? `Roster set · ${nextGameReadiness.rosterCount} players`
                      : "Select game roster"
                  }
                  cta={nextGameReadiness.rosterCount === 0 ? "Open →" : null}
                  onClick={() => navigate(`/game/${nextGame.id}`)}
                />
                <ChecklistRow
                  done={nextGameReadiness.lineupCount > 0}
                  label={
                    nextGameReadiness.lineupCount > 0
                      ? `Lineup built · ${nextGameReadiness.lineupCount} spots`
                      : "Build lineup"
                  }
                  cta={nextGameReadiness.lineupCount === 0 ? "Open →" : null}
                  onClick={() => navigate(`/game/${nextGame.id}`, { state: { tab: "lineup" } })}
                />
                <ChecklistRow
                  done={false}
                  label="Print lineup card"
                  cta={nextGameReadiness.lineupCount > 0 ? "Print →" : null}
                  disabled={nextGameReadiness.lineupCount === 0}
                  onClick={() => navigate(`/game/${nextGame.id}/print-lineup`)}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Needs Attention ──────────────────────────────────────── */}
      {attentionItems.length > 0 && (
        <section>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Needs Attention
          </p>
          <div className="space-y-2">
            {attentionItems.map((item) => (
              <div
                key={item.key}
                className="rounded-xl bg-card border pl-4 pr-3 py-3 flex items-center gap-3"
                style={{ borderLeft: "3px solid hsl(var(--secondary))" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                </div>
                <button
                  onClick={item.onAction}
                  className="text-[11px] font-bold bg-muted rounded-lg px-2.5 py-1.5 shrink-0"
                >
                  {item.cta} →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Roster segmented bar ─────────────────────────────────── */}
      {levelCounts.total > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Roster
            </p>
            <button
              onClick={() => navigate("/teams")}
              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
            >
              Manage <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <button onClick={() => navigate("/roster")} className="w-full text-left">
            <RosterSegmentedBar levelCounts={levelCounts} />
          </button>
        </section>
      )}

      {/* ── This Week timeline ────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            This Week
          </p>
          <button
            onClick={() => navigate("/schedule")}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
          >
            Schedule <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        {thisWeekGames.length === 0 && thisWeekPractices.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 p-5 text-center">
            <p className="text-sm font-medium text-muted-foreground">No events this week</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Schedule games or plan practices to see them here.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {[
              ...thisWeekGames.map((g) => ({
                key: `g-${g.id}`,
                type: "game" as const,
                date: g.game_date,
                time: g.game_time,
                title: g.opponent ? `vs ${g.opponent}` : g.name,
                sub: g.location || (g.team_level || "All levels"),
                nav: `/game/${g.id}`,
                needsAttention: false,
              })),
              ...thisWeekPractices.map((p) => ({
                key: `p-${p.id}`,
                type: "practice" as const,
                date: p.practice_date,
                time: null as string | null,
                title: p.title,
                sub: p.block_count === 0 ? "No plan yet" : p.team_level || "All levels",
                nav: `/practice/${p.id}`,
                needsAttention: p.block_count === 0,
              })),
            ]
              .sort(
                (a, b) =>
                  a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "")
              )
              .map((evt) => (
                <button
                  key={evt.key}
                  onClick={() => navigate(evt.nav)}
                  className="w-full flex gap-4 pb-3 text-left"
                >
                  <div className="w-10 shrink-0 text-center">
                    <p
                      className={cn(
                        "text-[10px] font-bold uppercase leading-none",
                        evt.type === "game" ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {format(parseISO(evt.date), "EEE")}
                    </p>
                    <p
                      className={cn(
                        "text-lg font-extrabold leading-tight mt-0.5",
                        evt.type === "game" ? "text-primary" : ""
                      )}
                    >
                      {format(parseISO(evt.date), "d")}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex-1 border-l pl-4",
                      evt.type === "game" ? "border-primary" : "border-border"
                    )}
                  >
                    <p
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        evt.type === "game"
                          ? "text-orange-600"
                          : evt.needsAttention
                            ? "text-secondary"
                            : "text-accent"
                      )}
                    >
                      {evt.type === "game" ? "Game" : "Practice"}
                      {evt.time ? ` · ${evt.time}` : ""}
                      {evt.needsAttention ? " · No plan" : ""}
                    </p>
                    <p className="font-bold text-[14px] leading-tight mt-0.5">{evt.title}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{evt.sub}</p>
                  </div>
                </button>
              ))}
          </div>
        )}
      </section>

      {/* ── Your Workspaces (data-aware list) ─────────────────── */}
      <section className="border-t pt-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
          Your Workspaces
        </p>
        <div className="rounded-xl border bg-card divide-y overflow-hidden">
          <WorkspaceRow
            icon={<Swords className="h-[18px] w-[18px]" />}
            iconBg="bg-primary/10"
            iconColor="text-primary"
            title="Game Day"
            subtitle={gameDaySubtitle}
            onClick={() => (nextGame ? navigate(`/game/${nextGame.id}`) : navigate("/teams"))}
          />
          <WorkspaceRow
            icon={<Dumbbell className="h-[18px] w-[18px]" />}
            iconBg="bg-accent/10"
            iconColor="text-accent"
            title="Practice Planning"
            subtitle={practiceSubtitle}
            onClick={() => navigate("/practices")}
          />
          <WorkspaceRow
            icon={<Users className="h-[18px] w-[18px]" />}
            iconBg="bg-secondary/10"
            iconColor="text-secondary"
            title="Team Management"
            subtitle={teamSubtitle}
            onClick={() => navigate("/teams")}
          />
          <WorkspaceRow
            icon={<TrendingUp className="h-[18px] w-[18px]" />}
            iconBg="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
            title="Player Development"
            subtitle={developmentSubtitle}
            onClick={() => navigate("/roster")}
          />
        </div>

        {/* Seasonal footer */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Seasonal
          </span>
          <span className="text-border">·</span>
          <button
            onClick={() => navigate("/score")}
            className="text-[12px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Score Entry
          </button>
          <span className="text-border">·</span>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-[12px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Rankings
          </button>
        </div>
      </section>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────

function ChecklistRow({
  done,
  label,
  cta,
  disabled,
  onClick,
}: {
  done: boolean;
  label: string;
  cta: string | null;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      {done ? (
        <span className="w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
          <Check className="h-3 w-3 text-accent" strokeWidth={3} />
        </span>
      ) : (
        <Circle
          className={cn(
            "h-5 w-5 shrink-0",
            disabled ? "text-border" : "text-secondary"
          )}
          strokeWidth={2}
        />
      )}
      <span
        className={cn(
          "flex-1 font-semibold",
          done ? "text-muted-foreground line-through" : disabled ? "text-muted-foreground/60" : ""
        )}
      >
        {label}
      </span>
      {cta && !disabled && (
        <button
          onClick={onClick}
          className="text-[11px] font-bold text-primary shrink-0"
        >
          {cta}
        </button>
      )}
    </div>
  );
}

function RosterSegmentedBar({
  levelCounts,
}: {
  levelCounts: { levels: Map<string, number>; unassigned: number; total: number };
}) {
  const segments = Array.from(levelCounts.levels.entries())
    .filter(([level]) => level.toLowerCase() !== "cut")
    .map(([level, count], i) => ({
      level,
      count,
      color:
        i === 0
          ? "bg-primary"
          : i === 1
            ? "bg-secondary"
            : i === 2
              ? "bg-accent"
              : "bg-purple-500",
      dotClass:
        i === 0
          ? "bg-primary"
          : i === 1
            ? "bg-secondary"
            : i === 2
              ? "bg-accent"
              : "bg-purple-500",
    }));
  const total = levelCounts.total || 1;
  return (
    <>
      <div className="flex rounded-lg overflow-hidden h-2">
        {segments.map((s) => (
          <div
            key={s.level}
            className={s.color}
            style={{ width: `${(s.count / total) * 100}%` }}
          />
        ))}
        {levelCounts.unassigned > 0 && (
          <div
            className="bg-muted-foreground/30"
            style={{ width: `${(levelCounts.unassigned / total) * 100}%` }}
          />
        )}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap text-[12px] text-muted-foreground">
        {segments.map((s) => (
          <span key={s.level} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", s.dotClass)} />
            <strong className="text-foreground font-bold">{s.count}</strong> {s.level}
          </span>
        ))}
        {levelCounts.unassigned > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            <strong className="text-foreground font-bold">{levelCounts.unassigned}</strong> Open
          </span>
        )}
      </div>
    </>
  );
}

function WorkspaceRow({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/30 transition-colors"
    >
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
          iconBg,
          iconColor
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold leading-tight">{title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
      </div>
      <ChevronRight className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
    </button>
  );
}
