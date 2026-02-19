import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface Metric {
  id: string;
  name: string;
  unit: string;
  category: string;
  metric_type: string;
  min_value: number | null;
  max_value: number | null;
  is_default: boolean;
  sort_order: number;
}

export default function MetricsManager() {
  const { coach } = useAuth();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newMetric, setNewMetric] = useState({
    name: "", unit: "", category: "other", metric_type: "measured", min_value: "", max_value: "",
  });
  const isHead = coach?.role === "head_coach";

  const fetchMetrics = async () => {
    if (!coach) return;
    const { data } = await supabase.from("metrics").select("*").eq("program_id", coach.program_id).order("sort_order");
    setMetrics(data || []);
  };

  useEffect(() => { fetchMetrics(); }, [coach]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coach) return;
    const { error } = await supabase.from("metrics").insert({
      program_id: coach.program_id,
      name: newMetric.name,
      unit: newMetric.unit,
      category: newMetric.category as any,
      metric_type: newMetric.metric_type as any,
      min_value: newMetric.min_value ? parseFloat(newMetric.min_value) : null,
      max_value: newMetric.max_value ? parseFloat(newMetric.max_value) : null,
      sort_order: metrics.length,
    });
    if (error) toast.error("Failed to add metric");
    else {
      toast.success("Metric added!");
      setAddOpen(false);
      setNewMetric({ name: "", unit: "", category: "other", metric_type: "measured", min_value: "", max_value: "" });
      fetchMetrics();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("metrics").delete().eq("id", id);
    if (error) toast.error("Failed to delete metric");
    else { toast.success("Metric removed"); fetchMetrics(); }
  };

  const categoryColor = (cat: string) => {
    const map: Record<string, string> = { running: "bg-primary", hitting: "bg-secondary", fielding: "bg-accent", pitching: "bg-destructive", other: "bg-muted text-muted-foreground" };
    return map[cat] || map.other;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Metrics</h2>
        {isHead && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="tap-target"><Plus className="mr-1 h-4 w-4" /> Add Metric</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Custom Metric</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={newMetric.name} onChange={(e) => setNewMetric({ ...newMetric, name: e.target.value })} placeholder="30-Yard Dash" required className="tap-target" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input value={newMetric.unit} onChange={(e) => setNewMetric({ ...newMetric, unit: e.target.value })} placeholder="sec, mph, 1-10" className="tap-target" />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={newMetric.category} onValueChange={(v) => setNewMetric({ ...newMetric, category: v })}>
                      <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="hitting">Hitting</SelectItem>
                        <SelectItem value="fielding">Fielding</SelectItem>
                        <SelectItem value="pitching">Pitching</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Scoring Direction</Label>
                  <Select value={newMetric.metric_type} onValueChange={(v) => setNewMetric({ ...newMetric, metric_type: v })}>
                    <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="timed">Timed (lower is better)</SelectItem>
                      <SelectItem value="measured">Measured (higher is better)</SelectItem>
                      <SelectItem value="rated">Rated (scale)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newMetric.metric_type === "rated" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Value</Label>
                      <Input type="number" value={newMetric.min_value} onChange={(e) => setNewMetric({ ...newMetric, min_value: e.target.value })} placeholder="1" className="tap-target" />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Value</Label>
                      <Input type="number" value={newMetric.max_value} onChange={(e) => setNewMetric({ ...newMetric, max_value: e.target.value })} placeholder="10" className="tap-target" />
                    </div>
                  </div>
                )}
                <Button type="submit" className="w-full tap-target">Add Metric</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-2">
        {metrics.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{m.name}</p>
                  {m.unit && <span className="text-xs text-muted-foreground">({m.unit})</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className={`text-xs ${categoryColor(m.category)}`}>{m.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {m.metric_type === "timed" ? "↓ lower better" : m.metric_type === "measured" ? "↑ higher better" : "scale"}
                  </span>
                </div>
              </div>
            </div>
            {isHead && (
              <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
