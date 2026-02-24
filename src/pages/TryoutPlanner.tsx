import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, SlidersHorizontal, Plus, Trash2, Pencil, Check, X, ArrowLeft, Clock, Ruler, Star } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { getSportCategories, formatCategory } from "@/lib/sports";

interface Session {
  id: string;
  name: string;
  session_date: string;
  notes: string | null;
}

interface Metric {
  id: string;
  name: string;
  unit: string;
  category: string;
  metric_type: string;
  aggregation: string;
  max_attempts: number;
  sort_order: number;
  min_value: number | null;
  max_value: number | null;
}

export default function TryoutPlanner() {
  const { coach } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  // Session form
  const [addingSession, setAddingSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionDate, setNewSessionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionName, setEditSessionName] = useState("");
  const [editSessionDate, setEditSessionDate] = useState("");

  // Metric inline edit
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);
  const [editMetric, setEditMetric] = useState<Partial<Metric>>({});

  // Add metric dialog
  const [addMetricOpen, setAddMetricOpen] = useState(false);
  const [newMetric, setNewMetric] = useState({
    name: "", unit: "", category: "other", metric_type: "measured", aggregation: "best", max_attempts: "1", min_value: "", max_value: "",
  });

  const isHead = coach?.role === "head_coach";
  const sportCategories = getSportCategories(coach?.sport || "baseball");

  const fetchData = async () => {
    if (!coach) return;
    const [sRes, mRes] = await Promise.all([
      supabase.from("tryout_sessions").select("*").eq("program_id", coach.program_id).order("session_date", { ascending: true }),
      supabase.from("metrics").select("*").eq("program_id", coach.program_id).order("sort_order"),
    ]);
    setSessions(sRes.data || []);
    setMetrics(mRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [coach]);

  // Sessions CRUD
  const addSession = async () => {
    if (!coach || !newSessionName.trim()) return;
    const { error } = await supabase.from("tryout_sessions").insert({
      program_id: coach.program_id,
      name: newSessionName.trim(),
      session_date: newSessionDate,
    });
    if (error) toast.error("Failed to add event");
    else { toast.success("Event added!"); setAddingSession(false); setNewSessionName(""); fetchData(); }
  };

  const updateSession = async (id: string) => {
    if (!editSessionName.trim()) return;
    const { error } = await supabase.from("tryout_sessions").update({ name: editSessionName.trim(), session_date: editSessionDate }).eq("id", id);
    if (error) toast.error("Failed to update");
    else { toast.success("Event updated!"); setEditingSessionId(null); fetchData(); }
  };

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from("tryout_sessions").delete().eq("id", id);
    if (error) toast.error("Failed to delete event");
    else { toast.success("Event deleted"); fetchData(); }
  };

  // Metric inline edit
  const startEditMetric = (m: Metric) => {
    setEditingMetricId(m.id);
    setEditMetric({ name: m.name, unit: m.unit, max_attempts: m.max_attempts, aggregation: m.aggregation, metric_type: m.metric_type });
  };

  const saveMetric = async (id: string) => {
    const { error } = await supabase.from("metrics").update({
      name: editMetric.name,
      unit: editMetric.unit,
      max_attempts: editMetric.max_attempts,
      aggregation: editMetric.aggregation as "best" | "average" | "latest",
      metric_type: editMetric.metric_type as "timed" | "measured" | "rated",
    }).eq("id", id);
    if (error) toast.error("Failed to update metric");
    else { toast.success("Metric updated!"); setEditingMetricId(null); fetchData(); }
  };

  const addMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coach) return;
    const { error } = await supabase.from("metrics").insert({
      program_id: coach.program_id,
      name: newMetric.name,
      unit: newMetric.unit,
      category: newMetric.category,
      metric_type: newMetric.metric_type,
      min_value: newMetric.min_value ? parseFloat(newMetric.min_value) : null,
      max_value: newMetric.max_value ? parseFloat(newMetric.max_value) : null,
      sort_order: metrics.length,
      aggregation: newMetric.aggregation,
      max_attempts: parseInt(newMetric.max_attempts) || 1,
    } as any);
    if (error) toast.error("Failed to add metric");
    else {
      toast.success("Metric added!");
      setAddMetricOpen(false);
      setNewMetric({ name: "", unit: "", category: "other", metric_type: "measured", aggregation: "best", max_attempts: "1", min_value: "", max_value: "" });
      fetchData();
    }
  };

  const deleteMetric = async (id: string) => {
    const { error } = await supabase.from("metrics").delete().eq("id", id);
    if (error) toast.error("Failed to delete metric");
    else { toast.success("Metric removed"); fetchData(); }
  };

  // Group metrics by category
  const grouped = sportCategories
    .map((cat) => ({ category: cat, items: metrics.filter((m) => m.category === cat) }))
    .filter((g) => g.items.length > 0);

  const typeIcon = (t: string) => {
    if (t === "timed") return <Clock className="h-3 w-3" />;
    if (t === "measured") return <Ruler className="h-3 w-3" />;
    return <Star className="h-3 w-3" />;
  };

  const typeLabel = (t: string) => {
    if (t === "timed") return "↓ Lower better";
    if (t === "measured") return "↑ Higher better";
    return "Scale";
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 pb-24 animate-fade-in">
      {/* Hero */}
      <div className="page-hero mb-6">
        <button onClick={() => navigate("/settings")} className="flex items-center gap-1 text-white/70 hover:text-white text-sm mb-3 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to More
        </button>
        <h1 className="text-2xl font-extrabold text-white">Tryout Planner</h1>
        <p className="text-white/70 text-sm mt-1">Plan your events and configure metrics in one place.</p>
        <div className="flex gap-4 mt-3">
          <div className="glass-card px-3 py-2 rounded-xl">
            <p className="text-white text-lg font-extrabold">{sessions.length}</p>
            <p className="text-white/60 text-[10px] uppercase font-bold">Events</p>
          </div>
          <div className="glass-card px-3 py-2 rounded-xl">
            <p className="text-white text-lg font-extrabold">{metrics.length}</p>
            <p className="text-white/60 text-[10px] uppercase font-bold">Metrics</p>
          </div>
          <div className="glass-card px-3 py-2 rounded-xl">
            <p className="text-white text-lg font-extrabold">{sportCategories.filter((c) => metrics.some((m) => m.category === c)).length}</p>
            <p className="text-white/60 text-[10px] uppercase font-bold">Categories</p>
          </div>
        </div>
      </div>

      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-6">
        {/* Events */}
        <Card className="section-card h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Events
              </CardTitle>
              {isHead && !addingSession && (
                <Button size="sm" variant="outline" className="rounded-xl text-xs h-8" onClick={() => setAddingSession(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {addingSession && (
              <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                <Input
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g. Fall Tryouts"
                  className="h-9 rounded-lg text-sm"
                  autoFocus
                />
                <Input
                  type="date"
                  value={newSessionDate}
                  onChange={(e) => setNewSessionDate(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 rounded-lg text-xs font-bold" onClick={addSession} disabled={!newSessionName.trim()}>Save</Button>
                  <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => setAddingSession(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {sessions.length === 0 && !addingSession && (
              <p className="text-sm text-muted-foreground text-center py-6">No events planned yet.</p>
            )}

            {sessions.map((s) => (
              <div key={s.id} className="rounded-xl border bg-card px-3.5 py-3 transition-all">
                {editingSessionId === s.id ? (
                  <div className="space-y-2">
                    <Input value={editSessionName} onChange={(e) => setEditSessionName(e.target.value)} className="h-8 rounded-lg text-sm font-medium" autoFocus />
                    <Input type="date" value={editSessionDate} onChange={(e) => setEditSessionDate(e.target.value)} className="h-8 rounded-lg text-sm" />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-7 rounded-lg text-xs" onClick={() => updateSession(s.id)}><Check className="h-3 w-3 mr-1" /> Save</Button>
                      <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => setEditingSessionId(null)}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(s.session_date + "T12:00:00"), "MMM d, yyyy")}</p>
                    </div>
                    {isHead && (
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" onClick={() => { setEditingSessionId(s.id); setEditSessionName(s.name); setEditSessionDate(s.session_date); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={() => deleteSession(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Metrics by category */}
         <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold">Metrics Overview</h2>
            </div>
            {isHead && (
              <Dialog open={addMetricOpen} onOpenChange={setAddMetricOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-xl text-xs h-8">
                    <Plus className="h-3 w-3 mr-1" /> Add Metric
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Tryout Metric</DialogTitle></DialogHeader>
                  <form onSubmit={addMetric} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={newMetric.name} onChange={(e) => setNewMetric({ ...newMetric, name: e.target.value })} placeholder="e.g. 60-Yard Dash" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Unit</Label>
                        <Input value={newMetric.unit} onChange={(e) => setNewMetric({ ...newMetric, unit: e.target.value })} placeholder="sec, mph, 1-10" />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={newMetric.category} onValueChange={(v) => setNewMetric({ ...newMetric, category: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {sportCategories.map((cat) => (
                              <SelectItem key={cat} value={cat}>{formatCategory(cat)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Scoring Direction</Label>
                        <Select value={newMetric.metric_type} onValueChange={(v) => setNewMetric({ ...newMetric, metric_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="timed">Timed (lower ↓)</SelectItem>
                            <SelectItem value="measured">Measured (higher ↑)</SelectItem>
                            <SelectItem value="rated">Rated (scale)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Aggregation</Label>
                        <Select value={newMetric.aggregation} onValueChange={(v) => setNewMetric({ ...newMetric, aggregation: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="best">Best attempt</SelectItem>
                            <SelectItem value="average">Average all</SelectItem>
                            <SelectItem value="latest">Latest only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Max Attempts</Label>
                      <Select value={newMetric.max_attempts} onValueChange={(v) => setNewMetric({ ...newMetric, max_attempts: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} attempt{n > 1 ? "s" : ""}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {newMetric.metric_type === "rated" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Min Value</Label>
                          <Input type="number" value={newMetric.min_value} onChange={(e) => setNewMetric({ ...newMetric, min_value: e.target.value })} placeholder="20" />
                        </div>
                        <div className="space-y-2">
                          <Label>Max Value</Label>
                          <Input type="number" value={newMetric.max_value} onChange={(e) => setNewMetric({ ...newMetric, max_value: e.target.value })} placeholder="80" />
                        </div>
                      </div>
                    )}
                    <Button type="submit" className="w-full">Add Metric</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {grouped.length === 0 && (
            <Card className="section-card">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground text-sm">No metrics configured yet.</p>
                {isHead && (
                  <Button size="sm" variant="outline" className="mt-3 rounded-xl text-xs" onClick={() => setAddMetricOpen(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Add your first metric
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {grouped.map(({ category, items }) => (
            <Card key={category} className="section-card">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  {formatCategory(category)}
                  <Badge variant="secondary" className="ml-2 text-[10px]">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1.5">
                {items.map((m) => (
                  <div key={m.id} className="rounded-lg border bg-muted/20 px-3 py-2.5">
                    {editingMetricId === m.id && isHead ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={editMetric.name || ""}
                            onChange={(e) => setEditMetric({ ...editMetric, name: e.target.value })}
                            className="h-8 rounded-lg text-sm font-medium"
                            placeholder="Name"
                          />
                          <Input
                            value={editMetric.unit || ""}
                            onChange={(e) => setEditMetric({ ...editMetric, unit: e.target.value })}
                            className="h-8 rounded-lg text-sm"
                            placeholder="Unit"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Select value={editMetric.metric_type} onValueChange={(v) => setEditMetric({ ...editMetric, metric_type: v })}>
                            <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="timed">Timed ↓</SelectItem>
                              <SelectItem value="measured">Measured ↑</SelectItem>
                              <SelectItem value="rated">Rated</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={editMetric.aggregation} onValueChange={(v) => setEditMetric({ ...editMetric, aggregation: v })}>
                            <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="best">Best</SelectItem>
                              <SelectItem value="average">Average</SelectItem>
                              <SelectItem value="latest">Latest</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={String(editMetric.max_attempts)} onValueChange={(v) => setEditMetric({ ...editMetric, max_attempts: parseInt(v) })}>
                            <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} att.</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 h-7 rounded-lg text-xs font-bold" onClick={() => saveMetric(m.id)}>
                            <Check className="h-3 w-3 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => setEditingMetricId(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{m.name}</p>
                            {m.unit && <span className="text-xs text-muted-foreground">({m.unit})</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              {typeIcon(m.metric_type)} {typeLabel(m.metric_type)}
                            </span>
                            <span className="text-[11px] text-muted-foreground">· {m.aggregation === "best" ? "Best" : m.aggregation === "average" ? "Avg" : "Latest"}</span>
                            <span className="text-[11px] text-muted-foreground">· {m.max_attempts} att.</span>
                          </div>
                        </div>
                        {isHead && (
                          <div className="flex items-center gap-0.5">
                            <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" onClick={() => startEditMetric(m)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={() => deleteMetric(m.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
