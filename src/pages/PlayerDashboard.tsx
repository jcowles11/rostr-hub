import { useEffect, useState } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Eye } from "lucide-react";
import PlayerProfileSettings from "@/components/PlayerProfileSettings";
import { aggregateValues } from "@/lib/metrics";
import PlayerPhotoUpload from "@/components/PlayerPhotoUpload";
import { toast } from "sonner";

interface Metric {
  id: string;
  name: string;
  unit: string;
  metric_type: string;
  aggregation: string;
  visible_to_players: boolean;
}

interface Evaluation {
  metric_id: string;
  value: number;
  created_at: string;
}

interface PlayerData {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
  player_number: number | null;
  photo_url: string | null;
  results_visible: boolean | null;
}

interface ProgramData {
  name: string;
  results_public: boolean;
}

export default function PlayerDashboard() {
  const { playerInfo, refreshPlayer } = useAuth();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [program, setProgram] = useState<ProgramData | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  const canSeeResults = player
    ? player.results_visible === true || (player.results_visible === null && program?.results_public === true)
    : false;

  useEffect(() => {
    if (!playerInfo) return;
    const fetchData = async () => {
      const [pRes, prRes, mRes, eRes] = await Promise.all([
        supabase.from("players").select("id, first_name, last_name, grade, positions, player_number, photo_url, results_visible").eq("id", playerInfo.id).single(),
        supabase.from("programs").select("name, results_public").eq("id", playerInfo.program_id).single(),
        supabase.from("metrics").select("id, name, unit, metric_type, aggregation, visible_to_players").eq("program_id", playerInfo.program_id).order("sort_order"),
        supabase.from("evaluations").select("metric_id, value, created_at").eq("player_id", playerInfo.id).order("created_at"),
      ]);
      setPlayer(pRes.data);
      setProgram(prRes.data);
      setMetrics(mRes.data || []);
      setEvals(eRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [playerInfo]);

  if (loading || !player) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center animate-scale-in">
          <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-20 w-20 rounded-3xl shadow-glow animate-pulse-soft object-cover" />
          <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const evalsByMetric = new Map<string, number[]>();
  evals.forEach((e) => {
    const arr = evalsByMetric.get(e.metric_id) || [];
    arr.push(e.value);
    evalsByMetric.set(e.metric_id, arr);
  });

  const visibleMetrics = metrics.filter((m) => m.visible_to_players);

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-8 animate-fade-in">
      {/* Player hero */}
      <div className="page-hero mb-5">
        <div className="flex items-center gap-4">
          <PlayerPhotoUpload
            playerId={player.id}
            currentUrl={player.photo_url}
            onUploaded={async (url) => {
              await supabase.from("players").update({ photo_url: url }).eq("id", player.id);
              setPlayer({ ...player, photo_url: url });
              toast.success("Photo updated");
              refreshPlayer();
            }}
            size="lg"
            className="border-2 border-white/30 rounded-full"
          />
          <div>
            <h1 className="text-2xl font-extrabold text-white">
              {player.first_name} {player.last_name}
            </h1>
            <p className="text-sm text-white/70">{program?.name}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {player.player_number && (
                <span className="rounded-lg bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">#{player.player_number}</span>
              )}
              {player.grade && (
                <span className="rounded-lg bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">Grade {player.grade}</span>
              )}
              {player.positions?.map((p) => (
                <span key={p} className="rounded-lg bg-white/15 px-2 py-0.5 text-xs font-medium text-white/90">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="evaluations" className="w-full">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="evaluations" className="flex-1 gap-1.5">
            <Eye className="h-4 w-4" /> My Evaluations
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex-1 gap-1.5">
            <User className="h-4 w-4" /> My Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="evaluations">
          {canSeeResults ? (
            <Card className="section-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Eye className="h-5 w-5" /> My Evaluations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {visibleMetrics.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No metrics to display yet.</p>
                ) : (
                  visibleMetrics.map((m) => {
                    const vals = evalsByMetric.get(m.id) || [];
                    const computed = vals.length > 0
                      ? aggregateValues(vals, m.aggregation as any, m.metric_type as any)
                      : null;

                    return (
                      <div key={m.id} className="rounded-xl bg-muted/40 p-3.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-sm">{m.name}</span>
                            {m.unit && <span className="text-xs text-muted-foreground ml-1">({m.unit})</span>}
                          </div>
                          {computed !== null ? (
                            <span className="text-xl font-extrabold">{computed.toFixed(1)}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                        {vals.length > 1 && (
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            {vals.map((v, i) => (
                              <Badge key={i} variant="secondary" className="text-xs font-medium">{v}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="section-card">
              <CardContent className="py-12 text-center">
                <Lock className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-lg font-bold mb-1">Results Not Yet Available</h3>
                <p className="text-sm text-muted-foreground">
                  Your coach hasn't published evaluation results yet. Check back later!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="profile">
          <PlayerProfileSettings playerId={player.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
