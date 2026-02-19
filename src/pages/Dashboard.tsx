import { useEffect, useState } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Search, Star, AlertTriangle, Eye, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { aggregateValues, computePercentiles } from "@/lib/metrics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MetricInfo {
  id: string;
  name: string;
  unit: string;
  metric_type: string;
  aggregation: string;
}

interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
  player_number: number | null;
  scores: Map<string, number>; // metricId -> aggregated value
  evalCount: number;
  flags: string[];
}

const ALL_METRICS = "__all__";

export default function Dashboard() {
  const { coach } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [metrics, setMetrics] = useState<MetricInfo[]>([]);
  const [percentiles, setPercentiles] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "score">("score");
  const [selectedMetric, setSelectedMetric] = useState(ALL_METRICS);
  const [filterMode, setFilterMode] = useState<"all" | "evaluated" | "not_evaluated">("all");

  useEffect(() => {
    if (!coach) return;
    const fetchData = async () => {
      const [pRes, eRes, nRes, mRes] = await Promise.all([
        supabase.from("players").select("id, first_name, last_name, grade, positions, player_number").eq("program_id", coach.program_id).order("last_name"),
        supabase.from("evaluations").select("player_id, metric_id, value, created_at").eq("program_id", coach.program_id).order("created_at"),
        supabase.from("player_notes").select("player_id, flag").eq("program_id", coach.program_id).not("flag", "is", null),
        supabase.from("metrics").select("id, name, unit, metric_type, aggregation").eq("program_id", coach.program_id).order("sort_order"),
      ]);

      const metricsList = (mRes.data || []) as MetricInfo[];
      setMetrics(metricsList);
      const metricsMap = new Map(metricsList.map((m) => [m.id, m]));

      // Group evals by player -> metric -> values[]
      const evalsByPlayerMetric = new Map<string, Map<string, number[]>>();
      (eRes.data || []).forEach((e) => {
        if (!evalsByPlayerMetric.has(e.player_id)) evalsByPlayerMetric.set(e.player_id, new Map());
        const pMap = evalsByPlayerMetric.get(e.player_id)!;
        if (!pMap.has(e.metric_id)) pMap.set(e.metric_id, []);
        pMap.get(e.metric_id)!.push(e.value);
      });

      const flagsByPlayer = new Map<string, Set<string>>();
      (nRes.data || []).forEach((n) => {
        if (!n.flag) return;
        const set = flagsByPlayer.get(n.player_id) || new Set();
        set.add(n.flag);
        flagsByPlayer.set(n.player_id, set);
      });

      const enriched: PlayerRow[] = (pRes.data || []).map((p) => {
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
  }, [coach]);

  const getDisplayScore = (p: PlayerRow): number | null => {
    if (selectedMetric !== ALL_METRICS) {
      return p.scores.get(selectedMetric) ?? null;
    }
    // Percentile-based composite
    return percentiles.get(p.id) ?? null;
  };

  const currentMetricInfo = metrics.find((m) => m.id === selectedMetric);
  const isTimed = selectedMetric !== ALL_METRICS && currentMetricInfo?.metric_type === "timed";

  const filtered = players
    .filter((p) => {
      const q = search.toLowerCase();
      if (!p.last_name.toLowerCase().includes(q) && !p.first_name.toLowerCase().includes(q)) return false;
      if (filterMode === "evaluated") return p.evalCount > 0;
      if (filterMode === "not_evaluated") return p.evalCount === 0;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "score") {
        const aScore = getDisplayScore(a);
        const bScore = getDisplayScore(b);
        if (aScore === null && bScore === null) return 0;
        if (aScore === null) return 1;
        if (bScore === null) return -1;
        // For timed metrics, lower is better
        return isTimed ? aScore - bScore : bScore - aScore;
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
    <div className="mx-auto max-w-lg px-4 pt-4 animate-fade-in">
      {/* Gradient hero */}
      <div className="page-hero mb-5">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setFilterMode("all")}
            className={cn("glass-card px-3 py-2 flex-1 text-center transition-all", filterMode === "all" ? "ring-2 ring-white/60" : "opacity-70 hover:opacity-100")}
          >
            <p className="text-2xl font-extrabold text-white">{players.length}</p>
            <p className="text-[10px] text-white/70 font-medium uppercase tracking-wider">All Players</p>
          </button>
          <button
            onClick={() => setFilterMode("evaluated")}
            className={cn("glass-card px-3 py-2 flex-1 text-center transition-all", filterMode === "evaluated" ? "ring-2 ring-white/60" : "opacity-70 hover:opacity-100")}
          >
            <p className="text-2xl font-extrabold text-white">{playersWithScores}</p>
            <p className="text-[10px] text-white/70 font-medium uppercase tracking-wider">Evaluated</p>
          </button>
          <button
            onClick={() => setFilterMode("not_evaluated")}
            className={cn("glass-card px-3 py-2 flex-1 text-center transition-all", filterMode === "not_evaluated" ? "ring-2 ring-white/60" : "opacity-70 hover:opacity-100")}
          >
            <p className="text-2xl font-extrabold text-white">{playersWithoutScores}</p>
            <p className="text-[10px] text-white/70 font-medium uppercase tracking-wider">Not Evaluated</p>
          </button>
        </div>
      </div>

      {/* Metric filter */}
      <div className="mb-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 w-full rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted focus:outline-none">
            <span className="truncate flex-1 text-left">{metricLabel}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] bg-popover border shadow-lg z-50">
            <DropdownMenuItem
              onClick={() => setSelectedMetric(ALL_METRICS)}
              className={cn("cursor-pointer font-medium", selectedMetric === ALL_METRICS && "bg-accent")}
            >
              All Metrics (composite)
            </DropdownMenuItem>
            {metrics.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onClick={() => setSelectedMetric(m.id)}
                className={cn("cursor-pointer font-medium", selectedMetric === m.id && "bg-accent")}
              >
                {m.name}{m.unit ? ` (${m.unit})` : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sort toggle + search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players..." className="pl-10 tap-target text-base h-12 rounded-xl" />
        </div>
        <div className="flex rounded-xl border bg-card overflow-hidden">
          <button onClick={() => setSortBy("name")} className={cn("px-3 py-2 text-xs font-semibold transition-all", sortBy === "name" ? "gradient-primary text-white" : "text-muted-foreground hover:text-foreground")}>
            A-Z
          </button>
          <button onClick={() => setSortBy("score")} className={cn("px-3 py-2 text-xs font-semibold transition-all", sortBy === "score" ? "gradient-primary text-white" : "text-muted-foreground hover:text-foreground")}>
            Score
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <img src={rostrLogo} alt="Loading" className="mx-auto mb-3 h-12 w-12 rounded-2xl animate-pulse-soft object-cover" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : (
        <div className="space-y-2 stagger-list">
          {filtered.map((p) => {
            const displayScore = getDisplayScore(p);
            return (
              <button key={p.id} onClick={() => navigate(`/player/${p.id}`)} className="player-card">
                <div className="flex items-center gap-3">
                  {p.player_number ? (
                    <span className="number-badge">{p.player_number}</span>
                  ) : (
                    <span className="number-badge bg-muted text-muted-foreground">—</span>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-[15px]">{p.last_name}, {p.first_name}</p>
                      {p.flags.map((f) => (
                        <span key={f}>{flagIcon(f)}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {p.grade && <span className="text-xs text-muted-foreground">Grade {p.grade}</span>}
                      {p.positions?.map((pos) => (
                        <Badge key={pos} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">{pos}</Badge>
                      ))}
                      {p.evalCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">{p.evalCount} evals</span>
                      )}
                    </div>
                  </div>
                </div>
                {displayScore !== null && (
                  <div className="text-right">
                    <p className="text-xl font-extrabold">{displayScore.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {selectedMetric === ALL_METRICS ? "pctl" : currentMetricInfo?.unit || ""}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
