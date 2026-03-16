/**
 * SchedulePage — Unified calendar hub for Games + Practices.
 *
 * Combines upcoming games and practice plans in a single chronological
 * view so coaches can see their full week/month at a glance.
 *
 * Route: /schedule
 */
import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchGames, type Game } from "@/services/teamService";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  CalendarPlus,
  ChevronRight,
  MapPin,
  Clock,
  Swords,
  ClipboardList,
  Plus,
  Dumbbell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, isAfter, isBefore, startOfDay, addDays } from "date-fns";

interface PracticePlan {
  id: string;
  title: string;
  practice_date: string;
  start_time: string | null;
  end_time: string | null;
  team_level: string | null;
  status: string;
}

type ScheduleItem =
  | { type: "game"; date: string; item: Game }
  | { type: "practice"; date: string; item: PracticePlan };

export default function SchedulePage() {
  const navigate = useNavigate();
  const { coach } = useAuth();
  const isHead = coach?.role === "head_coach";

  const [games, setGames] = useState<Game[]>([]);
  const [practices, setPractices] = useState<PracticePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"upcoming" | "past">("upcoming");

  const fetchData = useCallback(async () => {
    if (!coach) return;
    setLoading(true);
    const [gRes, pRes] = await Promise.all([
      fetchGames(coach.program_id),
      supabase
        .from("practice_plans")
        .select("id, title, practice_date, start_time, end_time, team_level, status")
        .eq("program_id", coach.program_id)
        .order("practice_date", { ascending: true }),
    ]);
    setGames(gRes.data);
    setPractices((pRes.data as PracticePlan[]) || []);
    setLoading(false);
  }, [coach]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = useMemo(() => startOfDay(new Date()), []);

  const schedule = useMemo(() => {
    const items: ScheduleItem[] = [];

    games.forEach((g) => {
      items.push({ type: "game", date: g.game_date, item: g });
    });

    practices.forEach((p) => {
      items.push({ type: "practice", date: p.practice_date, item: p });
    });

    // Sort chronologically
    items.sort((a, b) => a.date.localeCompare(b.date));

    const todayStr = format(today, "yyyy-MM-dd");

    if (view === "upcoming") {
      return items.filter((i) => i.date >= todayStr);
    } else {
      return items.filter((i) => i.date < todayStr).reverse();
    }
  }, [games, practices, today, view]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    schedule.forEach((item) => {
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    });
    return Array.from(map.entries());
  }, [schedule]);

  // Stats
  const upcomingGameCount = games.filter(
    (g) => g.game_date >= format(today, "yyyy-MM-dd") && g.status !== "cancelled"
  ).length;
  const upcomingPracticeCount = practices.filter(
    (p) => p.practice_date >= format(today, "yyyy-MM-dd")
  ).length;

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4 pb-8 space-y-5 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-6 w-36 bg-muted rounded" />
            <div className="h-4 w-44 bg-muted rounded" />
          </div>
          <div className="flex gap-1.5">
            <div className="h-8 w-16 bg-muted rounded-xl" />
            <div className="h-8 w-20 bg-muted rounded-xl" />
          </div>
        </div>
        {/* Toggle skeleton */}
        <div className="h-10 bg-muted rounded-xl" />
        {/* Event rows skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((g) => (
            <div key={g}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-lg bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-20 bg-muted rounded" />
                  <div className="h-3 w-28 bg-muted rounded" />
                </div>
              </div>
              <div className="space-y-1.5 ml-[46px]">
                {[1, 2].map((e) => (
                  <div key={e} className="rounded-xl border bg-card px-3 py-2.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-28 bg-muted rounded" />
                      <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                    <div className="w-14 h-5 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-8 animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {upcomingGameCount} game{upcomingGameCount !== 1 ? "s" : ""} · {upcomingPracticeCount} practice{upcomingPracticeCount !== 1 ? "s" : ""} upcoming
          </p>
        </div>
        {isHead && (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-xl text-xs font-bold"
              onClick={() => navigate("/teams")}
            >
              <CalendarPlus className="h-3.5 w-3.5 mr-1" />
              Game
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-xl text-xs font-bold"
              onClick={() => navigate("/practices")}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Practice
            </Button>
          </div>
        )}
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
        <button
          onClick={() => setView("upcoming")}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-bold transition-all",
            view === "upcoming"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Upcoming
        </button>
        <button
          onClick={() => setView("past")}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-bold transition-all",
            view === "past"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Past
        </button>
      </div>

      {/* Schedule list */}
      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground/25 mx-auto mb-2.5" />
          <p className="text-sm font-bold text-muted-foreground">
            {view === "upcoming" ? "No upcoming events" : "No past events"}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {view === "upcoming" ? "Schedule games or plan practices to fill your calendar." : "Completed games and past practices will appear here."}
          </p>
          {view === "upcoming" && isHead && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-xs font-bold"
                onClick={() => navigate("/teams")}
              >
                <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                Schedule Game
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-xs font-bold"
                onClick={() => navigate("/practices")}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Plan Practice
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-primary uppercase leading-none">
                    {format(parseISO(date), "MMM")}
                  </span>
                  <span className="text-sm font-extrabold text-primary leading-tight">
                    {format(parseISO(date), "d")}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">{format(parseISO(date), "EEEE")}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(parseISO(date), "MMMM d, yyyy")}
                  </p>
                </div>
              </div>

              {/* Events for this date */}
              <div className="space-y-1.5 ml-[46px]">
                {items.map((si) => {
                  if (si.type === "game") {
                    const g = si.item as Game;
                    return (
                      <button
                        key={`game-${g.id}`}
                        onClick={() => navigate(`/game/${g.id}`)}
                        className="w-full text-left rounded-xl border bg-card px-3 py-2.5 hover:bg-muted/30 transition-colors flex items-center gap-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 shrink-0">
                          <Swords className="h-4 w-4 text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">
                            {g.opponent ? `vs ${g.opponent}` : g.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {g.game_time && <span>{g.game_time}</span>}
                            {g.location && (
                              <span className="flex items-center gap-0.5 truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{g.location}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {g.team_level && (
                            <Badge variant="outline" className="text-[10px]">
                              {g.team_level}
                            </Badge>
                          )}
                          <span className="inline-flex items-center rounded-md bg-orange-500/10 text-orange-600 border border-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold">
                            {g.status === "completed" ? "Final" : "Game"}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  } else {
                    const p = si.item as PracticePlan;
                    return (
                      <button
                        key={`practice-${p.id}`}
                        onClick={() => navigate(`/practice/${p.id}`)}
                        className="w-full text-left rounded-xl border bg-card px-3 py-2.5 hover:bg-muted/30 transition-colors flex items-center gap-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 shrink-0">
                          <Dumbbell className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{p.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {p.start_time && <span>{p.start_time}{p.end_time ? ` – ${p.end_time}` : ""}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {p.team_level && (
                            <Badge variant="outline" className="text-[10px]">
                              {p.team_level}
                            </Badge>
                          )}
                          <span className="inline-flex items-center rounded-md bg-green-500/10 text-green-600 border border-green-500/20 px-1.5 py-0.5 text-[10px] font-bold">
                            Practice
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  }
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
