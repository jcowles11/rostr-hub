import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProgramVisibility, updateProgramResultsPublic } from "@/services/programService";
import { fetchPlayerVisibility, updatePlayerResultsVisible, type PlayerVisibilityItem } from "@/services/playerService";
import { fetchMetricVisibility, updateMetricVisibility, type MetricVisibilityItem } from "@/services/metricService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, Globe, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VisibilityManager() {
  const { coach } = useAuth();
  const isHead = coach?.role === "head_coach";
  const [resultsPublic, setResultsPublic] = useState(false);
  const [players, setPlayers] = useState<PlayerVisibilityItem[]>([]);
  const [metrics, setMetrics] = useState<MetricVisibilityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!coach) return;
    const [prRes, pRes, mRes] = await Promise.all([
      fetchProgramVisibility(coach.program_id),
      fetchPlayerVisibility(coach.program_id),
      fetchMetricVisibility(coach.program_id),
    ]);
    setResultsPublic(prRes.data?.results_public || false);
    setPlayers(pRes.data || []);
    setMetrics(mRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [coach]);

  const toggleProgramVisibility = async (value: boolean) => {
    if (!coach) return;
    const { error } = await updateProgramResultsPublic(coach.program_id, value);
    if (error) toast.error("Failed to update");
    else { setResultsPublic(value); toast.success(value ? "Results are now public" : "Results are now private"); }
  };

  const togglePlayerVisibility = async (playerId: string, currentValue: boolean | null) => {
    if (!coach) return;
    // Cycle: null (follow program) → true (force show) → false (force hide) → null
    let newValue: boolean | null;
    if (currentValue === null) newValue = true;
    else if (currentValue === true) newValue = false;
    else newValue = null;

    const { error } = await updatePlayerResultsVisible(playerId, newValue);
    if (error) toast.error("Failed to update");
    else {
      setPlayers(players.map((p) => p.id === playerId ? { ...p, results_visible: newValue } : p));
    }
  };

  const toggleMetricVisibility = async (metricId: string, value: boolean) => {
    if (!coach) return;
    const { error } = await updateMetricVisibility(metricId, value);
    if (error) toast.error("Failed to update");
    else {
      setMetrics(metrics.map((m) => m.id === metricId ? { ...m, visible_to_players: value } : m));
    }
  };

  if (!isHead) return null;
  if (loading) return null;

  const getPlayerVisibilityLabel = (v: boolean | null) => {
    if (v === null) return { label: "Program Default", color: "bg-muted text-muted-foreground" };
    if (v === true) return { label: "Visible", color: "bg-accent/10 text-accent" };
    return { label: "Hidden", color: "bg-destructive/10 text-destructive" };
  };

  return (
    <Card className="section-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Eye className="h-5 w-5" /> Results Visibility
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Program-level toggle */}
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-sm">Publish Results to Players</p>
                <p className="text-xs text-muted-foreground">
                  {resultsPublic ? "Players can view their scores" : "Results are hidden from players"}
                </p>
              </div>
            </div>
            <Switch checked={resultsPublic} onCheckedChange={toggleProgramVisibility} />
          </div>
        </div>

        {/* Per-metric visibility */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-semibold text-muted-foreground">Metric Visibility</Label>
          </div>
          <div className="space-y-1.5">
            {metrics.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
                <span className="text-sm font-medium">{m.name}</span>
                <Switch
                  checked={m.visible_to_players}
                  onCheckedChange={(v) => toggleMetricVisibility(m.id, v)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Per-player overrides */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-semibold text-muted-foreground">Player Overrides</Label>
            <span className="text-[10px] text-muted-foreground">(tap to cycle)</span>
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {players.map((p) => {
              const vis = getPlayerVisibilityLabel(p.results_visible);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlayerVisibility(p.id, p.results_visible)}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5 w-full text-left hover:bg-muted/60 transition-colors"
                >
                  <span className="text-sm font-medium">
                    {p.player_number && <span className="text-primary mr-1">#{p.player_number}</span>}
                    {p.last_name}, {p.first_name}
                  </span>
                  <Badge className={cn("text-[10px] font-bold", vis.color)}>{vis.label}</Badge>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
