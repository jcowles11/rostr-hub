import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Star, AlertTriangle, Eye, MessageSquare, Send } from "lucide-react";
import { aggregateValues, AGGREGATION_LABELS } from "@/lib/metrics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
  jersey_number_preference: number | null;
  player_number: number | null;
  travel_ball_experience: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
}

interface Evaluation {
  id: string;
  value: number;
  metric_id: string;
  coach_id: string;
  created_at: string;
}

interface Metric { id: string; name: string; unit: string; metric_type: string; category: string; aggregation: string; }
interface Coach { id: string; full_name: string; color: string; }
interface Note { id: string; content: string; flag: string | null; coach_id: string; created_at: string; }

export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const { coach } = useAuth();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<Player | null>(null);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newFlag, setNewFlag] = useState<string>("");
  const [coachFilter, setCoachFilter] = useState<string>("all");

  const fetchAll = async () => {
    if (!coach || !id) return;
    const [pRes, eRes, mRes, cRes, nRes] = await Promise.all([
      supabase.from("players").select("*").eq("id", id).single(),
      supabase.from("evaluations").select("*").eq("player_id", id),
      supabase.from("metrics").select("id, name, unit, metric_type, category, aggregation").eq("program_id", coach.program_id).order("sort_order"),
      supabase.from("coaches").select("id, full_name, color").eq("program_id", coach.program_id),
      supabase.from("player_notes").select("id, content, flag, coach_id, created_at").eq("player_id", id).order("created_at", { ascending: false }),
    ]);
    setPlayer(pRes.data);
    setEvals(eRes.data || []);
    setMetrics(mRes.data || []);
    setCoaches(cRes.data || []);
    setNotes(nRes.data || []);
  };

  useEffect(() => {
    fetchAll();
    if (!coach || !id) return;
    const channel = supabase
      .channel(`player-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluations", filter: `player_id=eq.${id}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "player_notes", filter: `player_id=eq.${id}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [coach, id]);

  const getCoach = (cid: string) => coaches.find((c) => c.id === cid);

  const filteredEvals = coachFilter === "all" ? evals : evals.filter((e) => e.coach_id === coachFilter);

  // Group evals by metric
  const evalsByMetric = new Map<string, Evaluation[]>();
  filteredEvals.forEach((e) => {
    const arr = evalsByMetric.get(e.metric_id) || [];
    arr.push(e);
    evalsByMetric.set(e.metric_id, arr);
  });

  const addNote = async () => {
    if (!coach || !id || !newNote.trim()) return;
    const flagValue = newFlag as "standout" | "needs_second_look" | "concern" | undefined;
    const { error } = await supabase.from("player_notes").insert({
      program_id: coach.program_id,
      player_id: id,
      coach_id: coach.id,
      content: newNote,
      flag: flagValue || null,
    });
    if (error) toast.error("Failed to add note");
    else { setNewNote(""); setNewFlag(""); fetchAll(); }
  };

  if (!player) return <div className="p-4 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-8">
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-4">
        <h1 className="text-2xl font-bold">
          {player.player_number && <span className="text-primary">#{player.player_number} </span>}
          {player.last_name}, {player.first_name}
        </h1>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {player.grade && <Badge variant="secondary">Grade {player.grade}</Badge>}
          {player.positions?.map((p) => <Badge key={p} variant="outline">{p}</Badge>)}
          {player.jersey_number_preference && <Badge>#{player.jersey_number_preference}</Badge>}
        </div>
        {player.travel_ball_experience && <p className="text-sm text-muted-foreground mt-1">Travel: {player.travel_ball_experience}</p>}
      </div>

      {/* Coach filter */}
      <div className="mb-4">
        <Select value={coachFilter} onValueChange={setCoachFilter}>
          <SelectTrigger className="tap-target"><SelectValue placeholder="Filter by coach" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Coaches</SelectItem>
            {coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Scores by metric */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-lg">Evaluations</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {metrics.map((m) => {
            const mEvals = evalsByMetric.get(m.id) || [];
            if (mEvals.length === 0) return null;
            const vals = mEvals.map((e) => e.value);
            const computed = aggregateValues(vals, m.aggregation as any, m.metric_type as any);
            const label = AGGREGATION_LABELS[m.aggregation] || "Best";
            return (
              <div key={m.id} className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="font-medium text-sm">{m.name}</span>
                    <span className="text-xs text-muted-foreground ml-1">({label} of {mEvals.length})</span>
                  </div>
                  <span className="text-lg font-bold">{computed?.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">{m.unit}</span></span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {mEvals.map((e) => {
                    const c = getCoach(e.coach_id);
                    return (
                      <span key={e.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-primary-foreground" style={{ backgroundColor: c?.color || "hsl(var(--primary))" }}>
                        {c?.full_name?.split(" ")[0] || "?"}: {e.value}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {evalsByMetric.size === 0 && <p className="text-sm text-muted-foreground text-center py-4">No evaluations yet</p>}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {notes.map((n) => {
            const c = getCoach(n.coach_id);
            return (
              <div key={n.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: c?.color }}>{c?.full_name}</span>
                  <div className="flex items-center gap-1">
                    {n.flag === "standout" && <Star className="h-3 w-3 text-secondary" />}
                    {n.flag === "concern" && <AlertTriangle className="h-3 w-3 text-destructive" />}
                    {n.flag === "needs_second_look" && <Eye className="h-3 w-3 text-primary" />}
                    <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <p className="text-sm">{n.content}</p>
              </div>
            );
          })}

          {/* Add note */}
          <div className="space-y-2 pt-2 border-t">
            <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="tap-target" />
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {["standout", "needs_second_look", "concern"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setNewFlag(newFlag === f ? "" : f)}
                    className={cn("rounded-md px-2 py-1 text-xs font-medium border transition-colors", newFlag === f ? "border-primary bg-primary/10" : "border-transparent")}
                  >
                    {f === "standout" && <Star className="h-3 w-3 inline mr-1 text-secondary" />}
                    {f === "concern" && <AlertTriangle className="h-3 w-3 inline mr-1 text-destructive" />}
                    {f === "needs_second_look" && <Eye className="h-3 w-3 inline mr-1 text-primary" />}
                    {f.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={addNote} disabled={!newNote.trim()} className="tap-target">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact info */}
      {(player.emergency_contact_name || player.medical_notes) && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Contact & Medical</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {player.emergency_contact_name && <p><span className="text-muted-foreground">Emergency:</span> {player.emergency_contact_name} {player.emergency_contact_phone}</p>}
            {player.medical_notes && <p><span className="text-muted-foreground">Medical:</span> {player.medical_notes}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
