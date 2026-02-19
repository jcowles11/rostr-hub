import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  player_number: number | null;
}

interface Assignment {
  id: string;
  player_id: string;
  assignment: string;
}

const LEVEL_COLORS = [
  "gradient-primary text-white",
  "bg-secondary text-secondary-foreground",
  "bg-accent text-accent-foreground",
  "bg-primary/70 text-white",
  "bg-destructive text-destructive-foreground",
];

const LEVEL_BG_LIGHT = [
  "bg-primary/10 text-primary",
  "bg-secondary/10 text-secondary",
  "bg-accent/10 text-accent",
  "bg-primary/10 text-primary",
  "bg-destructive/10 text-destructive",
];

export default function RosterBoard() {
  const { coach } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<Map<string, Assignment>>(new Map());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const isHead = coach?.role === "head_coach";

  const levels = coach?.program_levels || ["Varsity", "JV", "C", "Freshman", "Cut"];

  const fetchData = async () => {
    if (!coach) return;
    const [pRes, aRes] = await Promise.all([
      supabase.from("players").select("id, first_name, last_name, grade, positions, player_number").eq("program_id", coach.program_id).order("last_name"),
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

  const counts = new Map<string, number>();
  levels.forEach((l) => counts.set(l, players.filter((p) => assignments.get(p.id)?.assignment === l).length));
  const unassignedCount = players.filter((p) => !assignments.has(p.id)).length;

  const getLevelColor = (level: string, type: "pill" | "badge") => {
    const idx = levels.indexOf(level);
    const arr = type === "pill" ? LEVEL_COLORS : LEVEL_BG_LIGHT;
    return arr[idx % arr.length];
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 animate-fade-in">
      {/* Hero */}
      <div className="page-hero mb-5">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Roster Board</h1>
        <p className="text-white/70 text-sm mt-0.5">{players.length} players • {unassignedCount} unassigned</p>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {levels.map((level) => (
          <button key={level} onClick={() => setFilter(f => f === level ? "all" : level)} className={cn(
            "rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200",
            filter === level ? getLevelColor(level, "pill") : "bg-card border text-muted-foreground hover:text-foreground"
          )}>
            {level} ({counts.get(level) || 0})
          </button>
        ))}
        <button onClick={() => setFilter(f => f === "unassigned" ? "all" : "unassigned")} className={cn(
          "rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200",
          filter === "unassigned" ? "bg-foreground text-background" : "bg-card border text-muted-foreground hover:text-foreground"
        )}>
          Unassigned ({unassignedCount})
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players..." className="pl-10 tap-target text-base h-12 rounded-xl" />
      </div>

      <div className="space-y-2 stagger-list">
        {filtered.map((p) => {
          const assignment = assignments.get(p.id);
          const assignedLevel = assignment?.assignment;
          return (
            <div key={p.id} className="player-card">
              <div className="flex items-center gap-3">
                {p.player_number ? (
                  <span className="number-badge">{p.player_number}</span>
                ) : (
                  <span className="number-badge bg-muted text-muted-foreground">—</span>
                )}
                <div>
                  <p className="font-bold text-[15px]">{p.last_name}, {p.first_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {p.grade && <span className="text-xs text-muted-foreground">Grade {p.grade}</span>}
                    {p.positions?.map((pos) => <Badge key={pos} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">{pos}</Badge>)}
                  </div>
                </div>
              </div>
              {isHead ? (
                <Select value={assignedLevel || ""} onValueChange={(v) => handleAssign(p.id, v)}>
                  <SelectTrigger className="w-28 tap-target rounded-xl font-semibold text-xs">
                    <SelectValue placeholder="Assign" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                assignedLevel && <Badge className={cn("rounded-lg font-bold", getLevelColor(assignedLevel, "badge"))}>{assignedLevel}</Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
