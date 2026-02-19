import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
}

interface Assignment {
  id: string;
  player_id: string;
  assignment: string;
}

const ASSIGNMENTS = [
  { value: "varsity", label: "Varsity", color: "bg-primary text-primary-foreground" },
  { value: "jv", label: "JV", color: "bg-secondary text-secondary-foreground" },
  { value: "freshman", label: "Freshman", color: "bg-accent text-accent-foreground" },
  { value: "cut", label: "Cut", color: "bg-destructive text-destructive-foreground" },
];

export default function RosterBoard() {
  const { coach } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<Map<string, Assignment>>(new Map());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const isHead = coach?.role === "head_coach";

  const fetchData = async () => {
    if (!coach) return;
    const [pRes, aRes] = await Promise.all([
      supabase.from("players").select("id, first_name, last_name, grade, positions").eq("program_id", coach.program_id).order("last_name"),
      supabase.from("roster_assignments").select("id, player_id, assignment").eq("program_id", coach.program_id),
    ]);
    setPlayers(pRes.data || []);
    const map = new Map<string, Assignment>();
    (aRes.data || []).forEach((a) => map.set(a.player_id, a));
    setAssignments(map);
  };

  useEffect(() => { fetchData(); }, [coach]);

  const handleAssign = async (playerId: string, assignment: string) => {
    if (!coach || !isHead) return;
    const existing = assignments.get(playerId);
    if (existing) {
      const { error } = await supabase.from("roster_assignments").update({ assignment: assignment as any }).eq("id", existing.id);
      if (error) { toast.error("Failed to update"); return; }
    } else {
      const { error } = await supabase.from("roster_assignments").insert({
        program_id: coach.program_id,
        player_id: playerId,
        assignment: assignment as any,
        assigned_by: coach.id,
      });
      if (error) { toast.error("Failed to assign"); return; }
    }
    fetchData();
  };

  const filtered = players.filter((p) => {
    const q = search.toLowerCase();
    const nameMatch = p.last_name.toLowerCase().includes(q) || p.first_name.toLowerCase().includes(q);
    if (filter === "all") return nameMatch;
    if (filter === "unassigned") return nameMatch && !assignments.has(p.id);
    return nameMatch && assignments.get(p.id)?.assignment === filter;
  });

  const counts = {
    varsity: players.filter((p) => assignments.get(p.id)?.assignment === "varsity").length,
    jv: players.filter((p) => assignments.get(p.id)?.assignment === "jv").length,
    freshman: players.filter((p) => assignments.get(p.id)?.assignment === "freshman").length,
    cut: players.filter((p) => assignments.get(p.id)?.assignment === "cut").length,
    unassigned: players.filter((p) => !assignments.has(p.id)).length,
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <h1 className="text-2xl font-bold mb-4">Roster Board</h1>

      {/* Counts */}
      <div className="flex flex-wrap gap-2 mb-4">
        {ASSIGNMENTS.map((a) => (
          <button key={a.value} onClick={() => setFilter(f => f === a.value ? "all" : a.value)} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-all", filter === a.value ? a.color : "bg-muted text-muted-foreground")}>
            {a.label}: {counts[a.value as keyof typeof counts]}
          </button>
        ))}
        <button onClick={() => setFilter(f => f === "unassigned" ? "all" : "unassigned")} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-all", filter === "unassigned" ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
          Unassigned: {counts.unassigned}
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players..." className="pl-10 tap-target text-base" />
      </div>

      <div className="space-y-1">
        {filtered.map((p) => {
          const assignment = assignments.get(p.id);
          const assignmentInfo = ASSIGNMENTS.find((a) => a.value === assignment?.assignment);
          return (
            <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
              <div>
                <p className="font-semibold">{p.last_name}, {p.first_name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {p.grade && <span>Grade {p.grade}</span>}
                  {p.positions?.map((pos) => <Badge key={pos} variant="secondary" className="text-xs">{pos}</Badge>)}
                </div>
              </div>
              {isHead ? (
                <Select value={assignment?.assignment || ""} onValueChange={(v) => handleAssign(p.id, v)}>
                  <SelectTrigger className="w-28 tap-target">
                    <SelectValue placeholder="Assign" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNMENTS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                assignmentInfo && <Badge className={assignmentInfo.color}>{assignmentInfo.label}</Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
