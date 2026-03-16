import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { getSportCategories, formatCategory } from "@/lib/sports";
import { track } from "@/services/analyticsService";

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
  aggregation: string;
  max_attempts: number;
}

export default function MetricsManager() {
  const { coach } = useAuth();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteEvalCount, setDeleteEvalCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newMetric, setNewMetric] = useState({
    name: "", unit: "", category: "other", metric_type: "measured", min_value: "", max_value: "", aggregation: "best", max_attempts: "1",
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
      if (coach) track("metric_configure", coach.program_id, coach.id, { label: newMetric.metric_type, source: "settings" });
      setAddOpen(false);
      setNewMetric({ name: "", unit: "", category: "other", metric_type: "measured", min_value: "", max_value: "", aggregation: "best", max_attempts: "1" });
      fetchMetrics();
    }
  };

  const confirmDelete = async (metric: Metric) => {
    setDeleteTarget({ id: metric.id, name: metric.name });
    setDeleteEvalCount(null);
    // Fetch evaluation count for this metric
    const { count } = await supabase
      .from("evaluations")
      .select("id", { count: "exact", head: true })
      .eq("metric_id", metric.id);
    setDeleteEvalCount(count ?? 0);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("metrics").delete().eq("id", deleteTarget.id);
    if (error) toast.error("Failed to delete metric");
    else { toast.success(`"${deleteTarget.name}" deleted`); fetchMetrics(); }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const categoryColor = (cat: string) => {
    const colors = ["bg-primary", "bg-secondary", "bg-accent", "bg-destructive", "bg-muted text-muted-foreground"];
    const categories = getSportCategories(coach?.sport || "baseball");
    const idx = categories.indexOf(cat);
    return idx >= 0 && idx < colors.length ? colors[idx] : colors[colors.length - 1];
  };

  const sportCategories = getSportCategories(coach?.sport || "baseball");

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
                        {sportCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{formatCategory(cat)}</SelectItem>
                        ))}
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
                <div className="space-y-2">
                  <Label>Multiple Attempts</Label>
                  <Select value={newMetric.aggregation} onValueChange={(v) => setNewMetric({ ...newMetric, aggregation: v })}>
                    <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="best">Best attempt</SelectItem>
                      <SelectItem value="average">Average all</SelectItem>
                      <SelectItem value="latest">Latest only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Attempts</Label>
                    <Select value={newMetric.max_attempts} onValueChange={(v) => setNewMetric({ ...newMetric, max_attempts: v })}>
                      <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 attempt</SelectItem>
                        <SelectItem value="2">2 attempts</SelectItem>
                        <SelectItem value="3">3 attempts</SelectItem>
                        <SelectItem value="4">4 attempts</SelectItem>
                        <SelectItem value="5">5 attempts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {newMetric.metric_type === "rated" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Value</Label>
                      <Input type="number" value={newMetric.min_value} onChange={(e) => setNewMetric({ ...newMetric, min_value: e.target.value })} placeholder="20" className="tap-target" />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Value</Label>
                      <Input type="number" value={newMetric.max_value} onChange={(e) => setNewMetric({ ...newMetric, max_value: e.target.value })} placeholder="80" className="tap-target" />
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
                  <Badge className={`text-xs ${categoryColor(m.category)}`}>{formatCategory(m.category)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {m.metric_type === "timed" ? "↓ lower better" : m.metric_type === "measured" ? "↑ higher better" : "scale"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    • {m.aggregation === "best" ? "Best" : m.aggregation === "average" ? "Avg" : "Latest"}
                  </span>
                  {m.max_attempts > 1 && (
                    <span className="text-xs text-muted-foreground">
                      • {m.max_attempts} attempts
                    </span>
                  )}
                </div>
              </div>
            </div>
            {isHead && (
              <Button variant="ghost" size="icon" onClick={() => confirmDelete(m)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Metric deletion confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteEvalCount === null ? (
                "Checking for associated scores..."
              ) : deleteEvalCount > 0 ? (
                <>
                  This metric has <span className="font-semibold text-foreground">{deleteEvalCount} score{deleteEvalCount !== 1 ? "s" : ""}</span> recorded across all players and sessions. Deleting it will <span className="font-semibold text-destructive">permanently remove all of those scores</span>. This cannot be undone.
                </>
              ) : (
                "No scores are recorded for this metric. It can be safely deleted."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting || deleteEvalCount === null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : deleteEvalCount && deleteEvalCount > 0 ? `Delete Metric & ${deleteEvalCount} Scores` : "Delete Metric"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
