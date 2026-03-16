import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "@/contexts/SessionContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, Star, AlertTriangle, Eye, ChevronDown, ChevronRight,
  Users, GraduationCap, Filter, BarChart3, Activity, ClipboardList,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { aggregateValues, computePercentiles } from "@/lib/metrics";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchDashboardPlayers } from "@/services/playerService";
import { fetchAllEvaluations, type EvaluationRaw } from "@/services/evaluationService";
import { fetchMetricsForDashboard, type MetricForDashboard } from "@/services/metricService";
import { fetchPlayerFlags } from "@/services/noteService";
import { fetchProgramCoaches, type CoachSummary } from "@/services/coachService";
import { track } from "@/services/analyticsService";

type MetricInfo = MetricForDashboard;

interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
  player_number: number | null;
  scores: Map<string, number>; // metricId -> aggregated value
  evalCount: number;
  metricCount: number; // how many distinct metrics this player has scores for
  flags: string[];
}

const ALL_METRICS = "__all__";

export default function Dashboard() {
  const { coach } = useAuth();
  const { selectedSessionId, sessions } = useSession();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [metrics, setMetrics] = useState<MetricInfo[]>([]);
  const [percentiles, setPercentiles] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "score">("score");
  const [selectedMetric, setSelectedMetric] = useState(ALL_METRICS);
  const [filterMode, setFilterMode] = useState<"all" | "evaluated" | "not_evaluated">("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [coaches, setCoaches] = useState<CoachSummary[]>([]);
  const [evaluatorFilter, setEvaluatorFilter] = useState<string>("all"); // "all" | "mine" | coach_id
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
  const [scoreThreshold, setScoreThreshold] = useState<string>(""); // raw input string

  useEffect(() => {
    if (!coach) return;
    const fetchData = async () => {
      const sessionFilter = selectedSessionId !== "all" ? selectedSessionId : undefined;

      const [pRes, evalsRes, nRes, mRes, cRes] = await Promise.all([
        fetchDashboardPlayers(coach.program_id),
        fetchAllEvaluations(coach.program_id, sessionFilter),
        fetchPlayerFlags(coach.program_id),
        fetchMetricsForDashboard(coach.program_id),
        fetchProgramCoaches(coach.program_id),
      ]);

      setCoaches(cRes.data);

      // Apply evaluator filter before aggregation
      let evalsData: EvaluationRaw[] = evalsRes.data;
      if (evaluatorFilter === "mine") {
        evalsData = evalsData.filter((e) => e.coach_id === coach.id);
      } else if (evaluatorFilter !== "all") {
        evalsData = evalsData.filter((e) => e.coach_id === evaluatorFilter);
      }

      const metricsList = mRes.data;
      setMetrics(metricsList);
      const metricsMap = new Map(metricsList.map((m) => [m.id, m]));

      // Group evals by player -> metric -> values[]
      const evalsByPlayerMetric = new Map<string, Map<string, number[]>>();
      evalsData.forEach((e: any) => {
        if (!evalsByPlayerMetric.has(e.player_id)) evalsByPlayerMetric.set(e.player_id, new Map());
        const pMap = evalsByPlayerMetric.get(e.player_id)!;
        if (!pMap.has(e.metric_id)) pMap.set(e.metric_id, []);
        pMap.get(e.metric_id)!.push(e.value);
      });

      const flagsByPlayer = new Map<string, Set<string>>();
      nRes.data.forEach((n) => {
        const set = flagsByPlayer.get(n.player_id) || new Set();
        set.add(n.flag);
        flagsByPlayer.set(n.player_id, set);
      });

      const enriched: PlayerRow[] = pRes.data.map((p) => {
        const pMetrics = evalsByPlayerMetric.get(p.id);
        let totalEvals = 0;
        const scores = new Map<string, number>();

        if (pMetrics) {
          pMetrics.forEach((vals, metricId) => {
            totalEvals += vals.length;
            const metric = metricsMap.get(metricId);
            const agg = (metric?.aggregation || "best") as "best" | "average" | "latest";
            const mType = (metric?.metric_type || "measured") as "timed" | "measured" | "rated";
            const score = aggregateValues(vals, agg, mType);
            if (score !== null) scores.set(metricId, score);
          });
        }

        return {
          ...p,
          scores,
          evalCount: totalEvals,
          metricCount: scores.size,
          flags: Array.from(flagsByPlayer.get(p.id) || []),
        };
      });

      setPlayers(enriched);
      setPercentiles(computePercentiles(enriched, metricsList));
      setLoading(false);
    };
    fetchData();

    const channel = supabase
      .channel("dashboard-evals")
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluations", filter: `program_id=eq.${coach.program_id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "player_notes", filter: `program_id=eq.${coach.program_id}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [coach, selectedSessionId, evaluatorFilter]);

  const getDisplayScore = (p: PlayerRow): number | null => {
    if (selectedMetric !== ALL_METRICS) {
      return p.scores.get(selectedMetric) ?? null;
    }
    // Percentile-based composite
    return percentiles.get(p.id) ?? null;
  };

  const currentMetricInfo = metrics.find((m) => m.id === selectedMetric);
  const isTimed = selectedMetric !== ALL_METRICS && currentMetricInfo?.metric_type === "timed";

  // Compute available positions for filter
  const allPositions = [...new Set(players.flatMap((p) => p.positions || []))].sort();

  // Compute available grades for filter
  const allGrades = [...new Set(players.map((p) => p.grade).filter((g): g is number => g !== null))].sort((a, b) => a - b);

  // Parse threshold for metric filtering
  const parsedThreshold = scoreThreshold.trim() !== "" ? parseFloat(scoreThreshold) : null;
  const thresholdActive = parsedThreshold !== null && Number.isFinite(parsedThreshold) && selectedMetric !== ALL_METRICS;

  // Track ranking filter usage (fires when any non-default filter is applied)
  useEffect(() => {
    if (!coach) return;
    const hasFilter = selectedMetric !== ALL_METRICS || positionFilter !== "all" || gradeFilter !== "all" || filterMode !== "all" || scoreThreshold.trim() !== "";
    if (hasFilter) {
      track("ranking_filter", coach.program_id, coach.id, {
        label: selectedMetric !== ALL_METRICS ? "metric" : positionFilter !== "all" ? "position" : gradeFilter !== "all" ? "grade" : filterMode !== "all" ? "eval_status" : "threshold",
        source: "dashboard",
      });
    }
  }, [selectedMetric, positionFilter, gradeFilter, filterMode, scoreThreshold]);

  // Track evaluator filter usage
  useEffect(() => {
    if (!coach || evaluatorFilter === "all") return;
    track("evaluator_filter", coach.program_id, coach.id, { label: evaluatorFilter === "mine" ? "mine" : "other_coach", source: "dashboard" });
  }, [evaluatorFilter]);

  const filtered = players
    .filter((p) => {
      // Text search
      const q = search.toLowerCase();
      if (q && !p.last_name.toLowerCase().includes(q) && !p.first_name.toLowerCase().includes(q)) return false;
      // Evaluation status filter
      if (filterMode === "evaluated" && p.evalCount === 0) return false;
      if (filterMode === "not_evaluated" && p.evalCount > 0) return false;
      // Position filter
      if (positionFilter !== "all" && !(p.positions || []).includes(positionFilter)) return false;
      // Grade filter
      if (gradeFilter !== "all" && p.grade !== gradeFilter) return false;
      // Metric threshold filter
      if (thresholdActive) {
        const score = p.scores.get(selectedMetric);
        if (score === undefined) return false; // no score = excluded when threshold active
        // Timed: lower is better → show players AT or BELOW threshold
        // Measured/Rated: higher is better → show players AT or ABOVE threshold
        if (isTimed) {
          if (score > parsedThreshold!) return false;
        } else {
          if (score < parsedThreshold!) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "score") {
        const aScore = getDisplayScore(a);
        const bScore = getDisplayScore(b);
        if (aScore === null && bScore === null) return a.last_name.localeCompare(b.last_name);
        if (aScore === null) return 1;
        if (bScore === null) return -1;
        // For timed metrics, lower is better
        const scoreDiff = isTimed ? aScore - bScore : bScore - aScore;
        if (scoreDiff !== 0) return scoreDiff;
        // Tiebreaker 1: more metrics evaluated = more reliable → rank higher
        if (a.metricCount !== b.metricCount) return b.metricCount - a.metricCount;
        // Tiebreaker 2: alphabetical for deterministic ordering
        return a.last_name.localeCompare(b.last_name);
      }
      return a.last_name.localeCompare(b.last_name);
    });

  const totalEvals = players.reduce((acc, p) => acc + p.evalCount, 0);
  const playersWithScores = players.filter((p) => p.evalCount > 0).length;
  const playersWithoutScores = players.length - playersWithScores;

  const flagIcon = (flag: string) => {
    if (flag === "standout") return <Star className="h-3.5 w-3.5 text-secondary fill-secondary" />;
    if (flag === "concern") return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
    return <Eye className="h-3.5 w-3.5 text-primary" />;
  };

  const metricLabel = selectedMetric === ALL_METRICS
    ? "All Metrics"
    : `${currentMetricInfo?.name || "Metric"}${currentMetricInfo?.unit ? ` (${currentMetricInfo.unit})` : ""}`;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-8 animate-fade-in space-y-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Stats & Rankings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalEvals} evaluation{totalEvals !== 1 ? "s" : ""} · {metrics.length} metric{metrics.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-xl text-xs font-bold"
          onClick={() => navigate("/score")}
        >
          <ClipboardList className="h-3.5 w-3.5 mr-1" />
          Score
        </Button>
      </div>

      {/* ── Overview Cards ─────────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setFilterMode("all")}
            className={cn(
              "rounded-xl border bg-card p-3 text-center transition-all",
              filterMode === "all" ? "ring-2 ring-foreground/20 border-foreground/20" : "hover:bg-muted/30"
            )}
          >
            <p className="text-2xl font-extrabold">{players.length}</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">All</p>
          </button>
          <button
            onClick={() => setFilterMode("evaluated")}
            className={cn(
              "rounded-xl border bg-card p-3 text-center transition-all",
              filterMode === "evaluated" ? "ring-2 ring-foreground/20 border-foreground/20" : "hover:bg-muted/30"
            )}
          >
            <p className="text-2xl font-extrabold text-primary">{playersWithScores}</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Scored</p>
          </button>
          <button
            onClick={() => setFilterMode("not_evaluated")}
            className={cn(
              "rounded-xl border bg-card p-3 text-center transition-all",
              filterMode === "not_evaluated" ? "ring-2 ring-foreground/20 border-foreground/20" : "hover:bg-muted/30"
            )}
          >
            <p className="text-2xl font-extrabold text-muted-foreground">{playersWithoutScores}</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Pending</p>
          </button>
        </div>
      </section>

      {/* ── Metric Selector ────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-2.5">Metric</h2>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-bold transition-colors hover:bg-muted/30 focus:outline-none">
            <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate flex-1 text-left">{metricLabel}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] bg-popover border shadow-lg z-50">
            <DropdownMenuItem
              onClick={() => { setSelectedMetric(ALL_METRICS); setScoreThreshold(""); }}
              className={cn("cursor-pointer font-medium", selectedMetric === ALL_METRICS && "bg-accent")}
            >
              All Metrics (composite)
            </DropdownMenuItem>
            {metrics.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onClick={() => { setSelectedMetric(m.id); setScoreThreshold(""); }}
                className={cn("cursor-pointer font-medium", selectedMetric === m.id && "bg-accent")}
              >
                {m.name}{m.unit ? ` (${m.unit})` : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Metric threshold cutoff */}
        {selectedMetric !== ALL_METRICS && currentMetricInfo && (
          <div className="flex items-center gap-2 mt-2.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-bold text-muted-foreground shrink-0">
              {isTimed ? "Max:" : "Min:"}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              value={scoreThreshold}
              onChange={(e) => setScoreThreshold(e.target.value)}
              placeholder={`${isTimed ? "≤" : "≥"} ${currentMetricInfo.unit || "value"}`}
              className="h-8 w-28 text-sm font-bold rounded-lg text-center"
            />
            {currentMetricInfo.unit && (
              <span className="text-xs text-muted-foreground">{currentMetricInfo.unit}</span>
            )}
            {thresholdActive && (
              <button
                onClick={() => setScoreThreshold("")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
              >
                Clear
              </button>
            )}
            {thresholdActive && (
              <span className="text-[10px] font-bold text-primary ml-auto">
                {filtered.length} match{filtered.length !== 1 ? "es" : ""}
              </span>
            )}
          </div>
        )}
      </section>

      {/* ── Filters ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-2.5">Filters</h2>

        {/* Evaluator filter */}
        {coaches.length > 1 && (
          <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-1">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-0.5" />
            <button
              onClick={() => setEvaluatorFilter("all")}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                evaluatorFilter === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              )}
            >
              All Coaches
            </button>
            <button
              onClick={() => setEvaluatorFilter("mine")}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                evaluatorFilter === "mine"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              )}
            >
              My Scores
            </button>
            {coaches
              .filter((c) => c.id !== coach?.id)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => setEvaluatorFilter(evaluatorFilter === c.id ? "all" : c.id)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                    evaluatorFilter === c.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {c.full_name || c.role}
                </button>
              ))}
          </div>
        )}

        {/* Position filter */}
        {allPositions.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-1">
            <button
              onClick={() => setPositionFilter("all")}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                positionFilter === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              )}
            >
              All Positions
            </button>
            {allPositions.map((pos) => (
              <button
                key={pos}
                onClick={() => setPositionFilter(positionFilter === pos ? "all" : pos)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                  positionFilter === pos
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {pos}
              </button>
            ))}
          </div>
        )}

        {/* Grade filter */}
        {allGrades.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-0.5" />
            <button
              onClick={() => setGradeFilter("all")}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                gradeFilter === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              )}
            >
              All Grades
            </button>
            {allGrades.map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(gradeFilter === g ? "all" : g)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                  gradeFilter === g
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                )}
              >
                Grade {g}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Rankings ───────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Rankings</h2>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-8 h-8 w-36 text-xs font-bold rounded-lg"
              />
            </div>
            {/* Sort toggle */}
            <div className="flex rounded-lg border bg-card overflow-hidden">
              <button
                onClick={() => setSortBy("name")}
                className={cn(
                  "px-2.5 py-1.5 text-[11px] font-bold transition-all",
                  sortBy === "name" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                A-Z
              </button>
              <button
                onClick={() => setSortBy("score")}
                className={cn(
                  "px-2.5 py-1.5 text-[11px] font-bold transition-all",
                  sortBy === "score" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Score
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              {players.length === 0 ? (
                <Users className="h-6 w-6 text-muted-foreground/40" />
              ) : (
                <Search className="h-6 w-6 text-muted-foreground/40" />
              )}
            </div>
            <p className="text-sm font-bold text-muted-foreground">
              {players.length === 0
                ? "No players on roster yet"
                : thresholdActive
                  ? "No players meet this threshold"
                  : "No players match current filters"}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {players.length === 0
                ? "Add players from the Roster tab, then run evaluations."
                : "Try adjusting your filters or search terms."}
            </p>
            {players.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-xs font-bold mt-3 h-8"
                onClick={() => navigate("/roster")}
              >
                Go to Roster
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((p, idx) => {
              const displayScore = getDisplayScore(p);
              const totalMetrics = metrics.length;
              const isPartial = selectedMetric === ALL_METRICS && p.metricCount > 0 && p.metricCount < totalMetrics;
              const rank = sortBy === "score" ? idx + 1 : null;
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/player/${p.id}`, { state: { playerIds: filtered.map((x) => x.id), source: "rankings" } })}
                  className="w-full text-left rounded-xl border bg-card px-3 py-2.5 hover:bg-muted/30 transition-colors flex items-center gap-3"
                >
                  {/* Rank or number */}
                  {rank !== null ? (
                    <span className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-extrabold",
                      rank <= 3 ? "bg-primary/10 text-primary" : "bg-muted/60 text-muted-foreground"
                    )}>
                      {rank}
                    </span>
                  ) : p.player_number ? (
                    <span className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 text-xs font-extrabold text-muted-foreground">
                      {p.player_number}
                    </span>
                  ) : (
                    <span className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                      —
                    </span>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm truncate">{p.last_name}, {p.first_name}</p>
                      {p.flags.map((f) => (
                        <span key={f} className="shrink-0">{flagIcon(f)}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {p.grade && <span className="text-[11px] text-muted-foreground">Gr. {p.grade}</span>}
                      {p.positions?.slice(0, 3).map((pos) => (
                        <Badge key={pos} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold">{pos}</Badge>
                      ))}
                      {p.evalCount > 0 && totalMetrics > 0 && (
                        <span className={cn(
                          "text-[10px] font-bold",
                          isPartial ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                        )}>
                          {p.metricCount}/{totalMetrics}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  {displayScore !== null ? (
                    <div className="text-right shrink-0">
                      <p className={cn("text-lg font-extrabold leading-tight", isPartial && "text-muted-foreground")}>
                        {displayScore.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-bold">
                        {selectedMetric === ALL_METRICS
                          ? (isPartial ? "partial" : "overall")
                          : currentMetricInfo?.unit || ""}
                      </p>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/50 font-bold shrink-0">—</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Skeleton loader ─────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card px-3 py-2.5 flex items-center gap-3 animate-pulse">
          <div className="w-7 h-7 rounded-lg bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-muted rounded w-32" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
          <div className="w-10 h-5 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}
