import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Search, Star, AlertTriangle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { aggregateValues } from "@/lib/metrics";

interface PlayerWithScores {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
  player_number: number | null;
  avgScore: number | null;
  evalCount: number;
  flags: string[];
}

export default function Dashboard() {
  const { coach } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerWithScores[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "score">("name");

  useEffect(() => {
    if (!coach) return;
    const fetchData = async () => {
      const [pRes, eRes, nRes, mRes] = await Promise.all([
        supabase.from("players").select("id, first_name, last_name, grade, positions, player_number").eq("program_id", coach.program_id).order("last_name"),
        supabase.from("evaluations").select("player_id, metric_id, value, created_at").eq("program_id", coach.program_id).order("created_at"),
        supabase.from("player_notes").select("player_id, flag").eq("program_id", coach.program_id).not("flag", "is", null),
        supabase.from("metrics").select("id, metric_type, aggregation").eq("program_id", coach.program_id),
      ]);

      const metricsMap = new Map((mRes.data || []).map((m) => [m.id, m]));

      // Group evals by player+metric
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

      const enriched: PlayerWithScores[] = (pRes.data || []).map((p) => {
        const pMetrics = evalsByPlayerMetric.get(p.id);
        let totalEvals = 0;
        let compositeScore: number | null = null;

        if (pMetrics && pMetrics.size > 0) {
          const metricScores: number[] = [];
          pMetrics.forEach((vals, metricId) => {
            totalEvals += vals.length;
            const metric = metricsMap.get(metricId);
            const agg = (metric?.aggregation || "best") as "best" | "average" | "latest";
            const mType = (metric?.metric_type || "measured") as "timed" | "measured" | "rated";
            const score = aggregateValues(vals, agg, mType);
            if (score !== null) metricScores.push(score);
          });
          if (metricScores.length > 0) {
            compositeScore = metricScores.reduce((a, b) => a + b, 0) / metricScores.length;
          }
        }

        return {
          ...p,
          avgScore: compositeScore,
          evalCount: totalEvals,
          flags: Array.from(flagsByPlayer.get(p.id) || []),
        };
      });

      setPlayers(enriched);
      setLoading(false);
    };
    fetchData();

    // Realtime subscription for live updates
    const channel = supabase
      .channel("dashboard-evals")
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluations", filter: `program_id=eq.${coach.program_id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "player_notes", filter: `program_id=eq.${coach.program_id}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [coach]);

  const filtered = players
    .filter((p) => {
      const q = search.toLowerCase();
      return p.last_name.toLowerCase().includes(q) || p.first_name.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "score") return (b.avgScore || 0) - (a.avgScore || 0);
      return a.last_name.localeCompare(b.last_name);
    });

  const flagIcon = (flag: string) => {
    if (flag === "standout") return <Star className="h-4 w-4 text-secondary" />;
    if (flag === "concern") return <AlertTriangle className="h-4 w-4 text-destructive" />;
    return <Eye className="h-4 w-4 text-primary" />;
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="page-header">Dashboard</h1>
        <div className="flex gap-1">
          <button onClick={() => setSortBy("name")} className={cn("rounded-md px-3 py-1 text-sm font-medium", sortBy === "name" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            A-Z
          </button>
          <button onClick={() => setSortBy("score")} className={cn("rounded-md px-3 py-1 text-sm font-medium", sortBy === "score" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            Score
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players..." className="pl-10 tap-target text-base" />
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-2 stagger-list">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => navigate(`/player/${p.id}`)} className="player-card">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">
                    {p.player_number && <span className="text-primary mr-1">#{p.player_number}</span>}
                    {p.last_name}, {p.first_name}
                  </p>
                  {p.flags.map((f) => (
                    <span key={f}>{flagIcon(f)}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {p.grade && <span>Grade {p.grade}</span>}
                  {p.positions?.map((pos) => (
                    <Badge key={pos} variant="secondary" className="text-xs">{pos}</Badge>
                  ))}
                  <span>{p.evalCount} evals</span>
                </div>
              </div>
              {p.avgScore !== null && (
                <div className="text-right">
                  <p className="text-2xl font-bold">{p.avgScore.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">avg</p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
