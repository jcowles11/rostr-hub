/**
 * TeamHome — Coach command center.
 *
 * The primary landing page for coaches. Shows a high-level snapshot
 * of the program: next game, this week's schedule, roster health,
 * and contextual quick actions.
 *
 * Route: / (default landing)
 */
import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchGames, type Game } from "@/services/teamService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  UserPlus,
  ClipboardList,
  BarChart3,
  Printer,
  ChevronRight,
  Swords,
  MapPin,
  Clock,
  Layers,
  Activity,
  CalendarDays,
  Dumbbell,
  TrendingUp,
  Target,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isAfter, startOfDay, parseISO, addDays } from "date-fns";

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

interface PracticePlan {
  id: string;
  title: string;
  practice_date: string;
  team_level: string | null;
  notes: string | null;
}

// ── Component ──────────────────────────────────────────────────────

export default function TeamHome() {
  const navigate = useNavigate();
  const { coach } = useAuth();

  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<RosterAssignment[]>([]);
  const [practices, setPractices] = useState<PracticePlan[]>([]);
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
      supabase
        .from("practice_plans")
        .select("id, title, practice_date, team_level, notes")
        .eq("program_id", coach.program_id)
        .order("practice_date", { ascending: true }),
    ]);

    setGames(gRes.data);
    setPlayers(pRes.data || []);
    setAssignments(aRes.data || []);
    setPractices((prRes.data as PracticePlan[]) || []);
    setLoading(false);
  }, [coach]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived ────────────────────────────────────────────────────

  const today = useMemo(() => startOfDay(new Date()), []);
  const todayStr = useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const weekEnd = useMemo(() => format(addDays(today, 7), "yyyy-MM-dd"), [today]);

  const upcomingGames = useMemo(() => {
    return games
      .filter((g) => g.game_date >= todayStr && g.status !== "cancelled")
      .sort((a, b) => a.game_date.localeCompare(b.game_date));
  }, [games, todayStr]);

  const thisWeekGames = useMemo(
    () => upcomingGames.filter((g) => g.game_date < weekEnd),
    [upcomingGames, weekEnd]
  );

  const upcomingPractices = useMemo(() => {
    return practices.filter((p) => p.practice_date >= todayStr);
  }, [practices, todayStr]);

  const thisWeekPractices = useMemo(
    () => upcomingPractices.filter((p) => p.practice_date < weekEnd),
    [upcomingPractices, weekEnd]
  );

  const nextGame = upcomingGames[0] || null;

  /** Build a case-insensitive level → count map. */
  const levelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    levels.forEach((l) => counts.set(l, 0));
    let unassigned = 0;

    const levelLower = new Map<string, string>();
    levels.forEach((l) => levelLower.set(l.toLowerCase(), l));

    assignments.forEach((a) => {
      const displayLevel = levelLower.get(a.assignment.toLowerCase());
      if (displayLevel) {
        counts.set(displayLevel, (counts.get(displayLevel) || 0) + 1);
      }
    });

    const assignedIds = new Set(assignments.map((a) => a.player_id));
    players.forEach((p) => {
      if (!assignedIds.has(p.id)) unassigned++;
    });

    return { levels: counts, unassigned, total: players.length };
  }, [levels, assignments, players]);

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4 pb-8 space-y-5 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-muted rounded" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
          <div className="h-6 w-20 bg-muted rounded-lg" />
        </div>
        {/* Hero card skeleton */}
        <div className="rounded-2xl bg-muted h-40" />
        {/* This week skeleton */}
        <div className="space-y-2">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
          </div>
          <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-28 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
          </div>
        </div>
        {/* Snapshot grid skeleton */}
        <div className="space-y-2">
          <div className="h-3 w-28 bg-muted rounded" />
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-3.5 space-y-2">
                <div className="h-6 w-10 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-8 animate-fade-in space-y-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {coach?.program_name || "Team Home"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
        </div>
        {levelCounts.total > 0 && (
          <span className="text-xs font-bold text-muted-foreground bg-muted/60 rounded-lg px-2.5 py-1 mt-1">
            {levelCounts.total} players
          </span>
        )}
      </div>

      {/* ── 1. Next Game (hero card) ───────────────────────────── */}
      {nextGame && (
        <section>
          <div
            className="relative overflow-hidden rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg"
            style={{ background: "var(--gradient-primary)" }}
            onClick={() => navigate(`/game/${nextGame.id}`)}
          >
            <div className="absolute inset-0 opacity-20" style={{
              background: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 60%)"
            }} />
            <div className="relative z-10">
              <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">
                Next Game
              </p>
              <p className="font-extrabold text-xl text-white leading-tight">
                {nextGame.opponent ? `vs ${nextGame.opponent}` : nextGame.name}
              </p>
              <div className="flex items-center gap-3 mt-2 text-white/70 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(parseISO(nextGame.game_date), "EEE, MMM d")}
                </span>
                {nextGame.game_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {nextGame.game_time}
                  </span>
                )}
              </div>
              {nextGame.location && (
                <div className="flex items-center gap-1 mt-1 text-white/60 text-xs">
                  <MapPin className="h-3 w-3" />
                  {nextGame.location}
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  className="rounded-xl text-xs font-bold h-9 bg-white/20 hover:bg-white/30 text-white border-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/game/${nextGame.id}`);
                  }}
                >
                  <Swords className="h-3.5 w-3.5 mr-1.5" />
                  Game Roster
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl text-xs font-bold h-9 bg-white/20 hover:bg-white/30 text-white border-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/game/${nextGame.id}`, { state: { tab: "lineup" } });
                  }}
                >
                  <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                  Lineup
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl text-xs font-bold h-9 bg-white/20 hover:bg-white/30 text-white border-0 px-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/game/${nextGame.id}/print-lineup`);
                  }}
                >
                  <Printer className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 2. This Week (Schedule Preview) ────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">This Week</h2>
          <button
            onClick={() => navigate("/schedule")}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
          >
            Full Schedule <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {thisWeekGames.length === 0 && thisWeekPractices.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 p-6 text-center">
            <CalendarDays className="h-7 w-7 text-muted-foreground/25 mx-auto mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No events this week</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Schedule games or plan practices to see them here.</p>
            <div className="flex justify-center gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-xs font-bold h-8"
                onClick={() => navigate("/schedule")}
              >
                View Schedule
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-xs font-bold h-8"
                onClick={() => navigate("/practices")}
              >
                Plan Practice
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Merge and sort this week's events */}
            {[
              ...thisWeekGames.map((g) => ({
                type: "game" as const,
                id: g.id,
                date: g.game_date,
                title: g.opponent ? `vs ${g.opponent}` : g.name,
                time: g.game_time,
                level: g.team_level,
                nav: `/game/${g.id}`,
              })),
              ...thisWeekPractices.map((p) => ({
                type: "practice" as const,
                id: p.id,
                date: p.practice_date,
                title: p.title,
                time: p.notes?.split("–")[0]?.trim() ?? null,
                level: p.team_level,
                nav: `/practice/${p.id}`,
              })),
            ]
              .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""))
              .map((evt) => (
                <button
                  key={`${evt.type}-${evt.id}`}
                  onClick={() => navigate(evt.nav)}
                  className="w-full text-left rounded-xl border bg-card px-3 py-2.5 hover:bg-muted/30 transition-colors flex items-center gap-3"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                      evt.type === "game" ? "bg-orange-500/10" : "bg-green-500/10"
                    )}
                  >
                    {evt.type === "game" ? (
                      <Swords className="h-4 w-4 text-orange-600" />
                    ) : (
                      <Dumbbell className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{evt.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(evt.date), "EEE")}
                      {evt.time ? ` · ${evt.time}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {evt.level && (
                      <Badge variant="outline" className="text-[10px]">
                        {evt.level}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
          </div>
        )}
      </section>

      {/* ── 3. Team Snapshot ────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Team Snapshot</h2>
          <button
            onClick={() => navigate("/teams")}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
          >
            Manage <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Total */}
          <button
            className="rounded-xl border bg-card p-3.5 text-left hover:bg-muted/30 transition-colors"
            onClick={() => navigate("/roster")}
          >
            <div className="flex items-center justify-between">
              <p className="text-2xl font-extrabold">{levelCounts.total}</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Total Players</p>
          </button>
          {/* Per level */}
          {Array.from(levelCounts.levels.entries())
            .filter(([level]) => level.toLowerCase() !== "cut")
            .map(([level, count]) => (
              <button
                key={level}
                className="rounded-xl border bg-card p-3.5 text-left hover:bg-muted/30 transition-colors"
                onClick={() => navigate("/teams")}
              >
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-extrabold">{count}</p>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">{level}</p>
              </button>
            ))}
          {levelCounts.unassigned > 0 && (
            <button
              className="rounded-xl border border-dashed bg-card p-3.5 text-left hover:bg-muted/30 transition-colors"
              onClick={() => navigate("/teams")}
            >
              <div className="flex items-center justify-between">
                <p className="text-2xl font-extrabold text-muted-foreground">
                  {levelCounts.unassigned}
                </p>
                <Target className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">Unassigned</p>
            </button>
          )}
        </div>
      </section>

      {/* ── 4. Quick Actions ───────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-2.5">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate("/score")}
            className="rounded-xl border bg-card p-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <ClipboardList className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">Score Entry</p>
              <p className="text-[11px] text-muted-foreground">Run evaluations</p>
            </div>
          </button>
          <button
            onClick={() => navigate("/roster")}
            className="rounded-xl border bg-card p-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <UserPlus className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">Add Player</p>
              <p className="text-[11px] text-muted-foreground">Add to roster</p>
            </div>
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="rounded-xl border bg-card p-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <BarChart3 className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">Stats</p>
              <p className="text-[11px] text-muted-foreground">View rankings</p>
            </div>
          </button>
          <button
            onClick={() => navigate("/practices")}
            className="rounded-xl border bg-card p-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Dumbbell className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">Practices</p>
              <p className="text-[11px] text-muted-foreground">Plan sessions</p>
            </div>
          </button>
        </div>
      </section>

      {/* ── 5. Upcoming Games (full list) ──────────────────────── */}
      {upcomingGames.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Upcoming Games</h2>
            <button
              onClick={() => navigate("/schedule")}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
            >
              All Games <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-1.5">
            {upcomingGames.slice(0, 5).map((g) => (
              <button
                key={g.id}
                onClick={() => navigate(`/game/${g.id}`)}
                className="w-full text-left rounded-xl border bg-card p-3 hover:bg-muted/30 transition-colors flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary uppercase leading-none">
                    {format(parseISO(g.game_date), "MMM")}
                  </span>
                  <span className="text-sm font-extrabold text-primary leading-tight">
                    {format(parseISO(g.game_date), "d")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">
                    {g.opponent ? `vs ${g.opponent}` : g.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {g.game_time && <span>{g.game_time}</span>}
                    {g.location && <span>· {g.location}</span>}
                  </div>
                </div>
                {g.team_level && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {g.team_level}
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Fallback if completely empty */}
      {players.length === 0 && upcomingGames.length === 0 && (
        <section className="rounded-2xl border border-dashed bg-card/50 p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-extrabold text-base mb-1">Set Up Your Program</h3>
          <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">
            Add players, schedule games, and plan practices to get your program running.
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <Button
              size="sm"
              className="rounded-xl text-xs font-bold h-9"
              onClick={() => navigate("/roster")}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Add Players
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl text-xs font-bold h-9"
              onClick={() => navigate("/teams")}
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Schedule Game
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
