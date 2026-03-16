import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, BarChart3, Users, ClipboardList, Filter, Eye, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

interface RawEvent {
  id: string;
  event_name: string;
  coach_id: string | null;
  properties: Record<string, unknown>;
  created_at: string;
}

interface StatCard {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
}

interface DailyRow {
  date: string;
  count: number;
}

export default function PilotAnalytics() {
  const { coach } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coach) return;
    supabase
      .from("analytics_events")
      .select("id, event_name, coach_id, properties, created_at")
      .eq("program_id", coach.program_id)
      .order("created_at", { ascending: false })
      .limit(5000)
      .then(({ data, error }) => {
        if (error) console.error("[analytics] fetch error:", error.message);
        setEvents((data as RawEvent[]) || []);
        setLoading(false);
      });
  }, [coach?.program_id]);

  // ── Derived stats ───────────────────────────────────────────────

  const stats = useMemo(() => {
    const byName = new Map<string, RawEvent[]>();
    events.forEach((e) => {
      const arr = byName.get(e.event_name) || [];
      arr.push(e);
      byName.set(e.event_name, arr);
    });

    const scoreEntries = byName.get("score_entry") || [];
    const rosterImports = byName.get("roster_import") || [];
    const playerCreates = byName.get("player_create") || [];
    const rankingFilters = byName.get("ranking_filter") || [];
    const evaluatorFilters = byName.get("evaluator_filter") || [];
    const profileViews = byName.get("player_profile_view") || [];
    const sessionCreates = byName.get("session_create") || [];
    const metricConfigs = byName.get("metric_configure") || [];

    // Unique coaches across all events
    const uniqueCoaches = new Set(events.map((e) => e.coach_id).filter(Boolean)).size;

    // Players imported via roster upload
    const importedPlayerCount = rosterImports.reduce(
      (sum, e) => sum + (typeof e.properties?.count === "number" ? e.properties.count : 0),
      0
    );

    // Score entries by mode
    const stationScores = scoreEntries.filter((e) => e.properties?.label === "station").length;
    const directScores = scoreEntries.filter((e) => e.properties?.label === "direct").length;

    // Filter type breakdown
    const filterBreakdown = new Map<string, number>();
    rankingFilters.forEach((e) => {
      const label = (e.properties?.label as string) || "unknown";
      filterBreakdown.set(label, (filterBreakdown.get(label) || 0) + 1);
    });

    return {
      totalEvents: events.length,
      uniqueCoaches,
      scoreEntries: scoreEntries.length,
      stationScores,
      directScores,
      rosterImports: rosterImports.length,
      importedPlayerCount,
      playerCreates: playerCreates.length,
      rankingFilters: rankingFilters.length,
      evaluatorFilters: evaluatorFilters.length,
      profileViews: profileViews.length,
      sessionCreates: sessionCreates.length,
      metricConfigs: metricConfigs.length,
      filterBreakdown,
    };
  }, [events]);

  // Daily score entry timeline
  const dailyScores = useMemo((): DailyRow[] => {
    const dayMap = new Map<string, number>();
    events
      .filter((e) => e.event_name === "score_entry")
      .forEach((e) => {
        const day = format(new Date(e.created_at), "yyyy-MM-dd");
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      });
    return [...dayMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  // Recent event feed (last 20)
  const recentFeed = events.slice(0, 20);

  // ── Render ──────────────────────────────────────────────────────

  const cards: StatCard[] = [
    { label: "Score Entries", value: stats.scoreEntries, sub: `${stats.stationScores} station · ${stats.directScores} direct`, icon: <ClipboardList className="h-5 w-5" /> },
    { label: "Profile Views", value: stats.profileViews, icon: <Eye className="h-5 w-5" /> },
    { label: "Ranking Filters", value: stats.rankingFilters, icon: <Filter className="h-5 w-5" /> },
    { label: "Evaluator Filters", value: stats.evaluatorFilters, icon: <Users className="h-5 w-5" /> },
    { label: "Players Added", value: stats.playerCreates + stats.importedPlayerCount, sub: `${stats.rosterImports} imports · ${stats.playerCreates} manual`, icon: <UserPlus className="h-5 w-5" /> },
    { label: "Sessions Created", value: stats.sessionCreates, icon: <BarChart3 className="h-5 w-5" /> },
  ];

  const eventLabel = (name: string) => {
    const labels: Record<string, string> = {
      score_entry: "Score saved",
      roster_import: "Roster imported",
      player_create: "Player added",
      metric_configure: "Metric configured",
      session_create: "Session created",
      ranking_filter: "Ranking filtered",
      player_profile_view: "Profile viewed",
      evaluator_filter: "Evaluator filtered",
    };
    return labels[name] || name;
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4">
        <div className="py-12 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground mt-2">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Hero */}
      <div className="page-hero mb-5">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-white" />
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Pilot Analytics</h1>
            <p className="text-white/70 text-sm mt-0.5">
              {stats.totalEvents} events · {stats.uniqueCoaches} coach{stats.uniqueCoaches !== 1 ? "es" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* No data state */}
      {events.length === 0 ? (
        <div className="py-12 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium mt-3">No analytics events yet</p>
          <p className="text-sm text-muted-foreground mt-1">Events will appear as coaches use the system</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {cards.map((c) => (
              <Card key={c.label} className="section-card">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-muted-foreground">{c.icon}</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{c.label}</span>
                  </div>
                  <p className="text-2xl font-extrabold">{c.value}</p>
                  {c.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Daily score timeline */}
          {dailyScores.length > 0 && (
            <Card className="section-card mb-5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Scores per Day</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {dailyScores.map((d) => {
                    const maxCount = Math.max(...dailyScores.map((r) => r.count), 1);
                    const pct = Math.round((d.count / maxCount) * 100);
                    return (
                      <div key={d.date} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono w-20 shrink-0">
                          {format(new Date(d.date + "T00:00:00"), "MMM d")}
                        </span>
                        <div className="flex-1 h-5 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/70 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold w-8 text-right">{d.count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filter breakdown */}
          {stats.filterBreakdown.size > 0 && (
            <Card className="section-card mb-5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Filter Type Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {[...stats.filterBreakdown.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <span
                        key={type}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1 text-xs font-semibold"
                      >
                        {type} <span className="text-muted-foreground">{count}</span>
                      </span>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent event feed */}
          <Card className="section-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Recent Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {recentFeed.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-medium">{eventLabel(e.event_name)}</span>
                    <span className="text-muted-foreground font-mono">
                      {format(new Date(e.created_at), "MMM d, HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
