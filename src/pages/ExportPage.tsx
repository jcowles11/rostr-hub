import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
}

interface Metric { id: string; name: string; unit: string; }

export default function ExportPage() {
  const { coach } = useAuth();
  const [loading, setLoading] = useState(false);

  const exportRosterCSV = async () => {
    if (!coach) return;
    setLoading(true);

    const [pRes, aRes, mRes, eRes] = await Promise.all([
      supabase.from("players").select("*").eq("program_id", coach.program_id).order("last_name"),
      supabase.from("roster_assignments").select("player_id, assignment").eq("program_id", coach.program_id),
      supabase.from("metrics").select("id, name, unit").eq("program_id", coach.program_id).order("sort_order"),
      supabase.from("evaluations").select("player_id, metric_id, value").eq("program_id", coach.program_id),
    ]);

    const players = pRes.data || [];
    const assignments = new Map((aRes.data || []).map((a) => [a.player_id, a.assignment]));
    const metrics = mRes.data || [];
    const evals = eRes.data || [];

    // Compute averages per player per metric
    const avgMap = new Map<string, Map<string, number[]>>();
    evals.forEach((e) => {
      if (!avgMap.has(e.player_id)) avgMap.set(e.player_id, new Map());
      const pMap = avgMap.get(e.player_id)!;
      if (!pMap.has(e.metric_id)) pMap.set(e.metric_id, []);
      pMap.get(e.metric_id)!.push(e.value);
    });

    const headers = ["Last Name", "First Name", "Grade", "Positions", ...metrics.map((m) => `${m.name} (${m.unit})`), "Assignment"];
    const rows = players.map((p) => {
      const pAvgs = avgMap.get(p.id);
      const metricCols = metrics.map((m) => {
        const vals = pAvgs?.get(m.id);
        return vals ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "";
      });
      return [
        p.last_name,
        p.first_name,
        p.grade?.toString() || "",
        (p.positions || []).join("; "),
        ...metricCols,
        assignments.get(p.id) || "Unassigned",
      ];
    });

    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tryout-roster-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
    setLoading(false);
  };

  const exportPlayerReports = async () => {
    if (!coach) return;
    setLoading(true);

    const [pRes, mRes, eRes, nRes, cRes, aRes] = await Promise.all([
      supabase.from("players").select("*").eq("program_id", coach.program_id).order("last_name"),
      supabase.from("metrics").select("id, name, unit").eq("program_id", coach.program_id).order("sort_order"),
      supabase.from("evaluations").select("player_id, metric_id, value, coach_id").eq("program_id", coach.program_id),
      supabase.from("player_notes").select("player_id, content, flag, coach_id, created_at").eq("program_id", coach.program_id).order("created_at", { ascending: false }),
      supabase.from("coaches").select("id, full_name").eq("program_id", coach.program_id),
      supabase.from("roster_assignments").select("player_id, assignment").eq("program_id", coach.program_id),
    ]);

    const players = pRes.data || [];
    const metrics = mRes.data || [];
    const evals = eRes.data || [];
    const notes = nRes.data || [];
    const coachMap = new Map((cRes.data || []).map((c) => [c.id, c.full_name]));
    const assignMap = new Map((aRes.data || []).map((a) => [a.player_id, a.assignment]));

    let text = `TRYOUT REPORT - ${coach.program_name}\nGenerated: ${new Date().toLocaleDateString()}\n${"=".repeat(60)}\n\n`;

    players.forEach((p) => {
      text += `${p.last_name}, ${p.first_name}`;
      if (p.grade) text += ` | Grade ${p.grade}`;
      if (p.positions?.length) text += ` | ${p.positions.join(", ")}`;
      const assign = assignMap.get(p.id);
      if (assign) text += ` | ${assign.toUpperCase()}`;
      text += `\n${"-".repeat(40)}\n`;

      // Metrics
      metrics.forEach((m) => {
        const mEvals = evals.filter((e) => e.player_id === p.id && e.metric_id === m.id);
        if (mEvals.length === 0) return;
        const avg = mEvals.reduce((s, e) => s + e.value, 0) / mEvals.length;
        const details = mEvals.map((e) => `${coachMap.get(e.coach_id) || "?"}: ${e.value}`).join(", ");
        text += `  ${m.name}: ${avg.toFixed(1)} ${m.unit}  (${details})\n`;
      });

      // Notes
      const pNotes = notes.filter((n) => n.player_id === p.id);
      if (pNotes.length > 0) {
        text += `  Notes:\n`;
        pNotes.forEach((n) => {
          text += `    [${coachMap.get(n.coach_id) || "?"}${n.flag ? ` - ${n.flag}` : ""}] ${n.content}\n`;
        });
      }
      text += "\n";
    });

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tryout-reports-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Reports exported!");
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 space-y-4">
      <h1 className="text-2xl font-bold">Export & Reports</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Download className="h-5 w-5" /> Roster CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Export all players with average scores and assignments</p>
          <Button className="w-full tap-target" onClick={exportRosterCSV} disabled={loading}>
            Download CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" /> Player Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Detailed report cards with all scores, coach evaluations, and notes</p>
          <Button className="w-full tap-target" onClick={exportPlayerReports} disabled={loading}>
            Download Reports
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
