import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchGames,
  createGame,
  deleteGame,
  fetchGameRoster,
  type Game,
  type GameRosterEntry,
} from "@/services/teamService";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Users,
  CalendarPlus,
  Search,
  Trash2,
  ChevronRight,
  MapPin,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
  player_number: number | null;
}

interface Assignment {
  player_id: string;
  assignment: string;
}

// ── Component ─────────────────────────────────────────────────────

export default function TeamManagement() {
  const { coach } = useAuth();
  const navigate = useNavigate();
  const isHead = coach?.role === "head_coach";
  const levels = coach?.program_levels || ["Varsity", "JV", "Freshman"];

  // Data
  const [players, setPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Create game dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newGame, setNewGame] = useState({ name: "", opponent: "", team_level: "", game_date: "", location: "" });
  const [creating, setCreating] = useState(false);

  // Delete game dialog
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);

  // ── Fetch data ────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!coach) return;
    const [pRes, aRes, gRes] = await Promise.all([
      supabase
        .from("players")
        .select("id, first_name, last_name, grade, positions, player_number")
        .eq("program_id", coach.program_id)
        .order("last_name"),
      supabase
        .from("roster_assignments")
        .select("player_id, assignment")
        .eq("program_id", coach.program_id),
      fetchGames(coach.program_id),
    ]);
    setPlayers(pRes.data || []);
    setAssignments((aRes.data as Assignment[]) || []);
    setGames(gRes.data);
  }, [coach]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived data ──────────────────────────────────────────────

  const assignmentMap = useMemo(() => {
    const m = new Map<string, string>();
    assignments.forEach((a) => m.set(a.player_id, a.assignment));
    return m;
  }, [assignments]);

  // Build a case-insensitive lookup from assignment enum values to display-level names.
  // roster_assignments stores lowercase ("varsity"), programs.levels stores display case ("Varsity").
  const enumToLevel = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((l) => m.set(l.toLowerCase(), l));
    return m;
  }, [levels]);

  const playersByLevel = useMemo(() => {
    const map = new Map<string, Player[]>();
    levels.forEach((l) => map.set(l, []));
    map.set("unassigned", []);

    players.forEach((p) => {
      const rawLevel = assignmentMap.get(p.id);
      // Resolve enum value to display-level via case-insensitive match
      const displayLevel = rawLevel ? (enumToLevel.get(rawLevel.toLowerCase()) ?? null) : null;
      if (displayLevel && map.has(displayLevel)) {
        map.get(displayLevel)!.push(p);
      } else if (!rawLevel) {
        map.get("unassigned")!.push(p);
      } else {
        // Assigned to a level not in programs.levels — treat as unassigned
        map.get("unassigned")!.push(p);
      }
    });
    return map;
  }, [players, assignmentMap, levels, enumToLevel]);

  const filteredPlayers = useMemo(() => {
    const pool = selectedLevel === "all"
      ? players
      : (playersByLevel.get(selectedLevel) || []);

    if (!search.trim()) return pool;
    const q = search.toLowerCase();
    return pool.filter(
      (p) =>
        p.last_name.toLowerCase().includes(q) ||
        p.first_name.toLowerCase().includes(q) ||
        (p.player_number && String(p.player_number).includes(q))
    );
  }, [selectedLevel, players, playersByLevel, search]);

  const filteredGames = useMemo(() => {
    if (selectedLevel === "all") return games;
    return games.filter((g) => g.team_level === selectedLevel || !g.team_level);
  }, [games, selectedLevel]);

  // ── Counts ────────────────────────────────────────────────────

  const levelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    levels.forEach((l) => counts.set(l, playersByLevel.get(l)?.length || 0));
    counts.set("unassigned", playersByLevel.get("unassigned")?.length || 0);
    return counts;
  }, [levels, playersByLevel]);

  // ── Team Assignment Handler ────────────────────────────────────

  const handleAssign = async (playerId: string, newLevel: string) => {
    if (!coach || !isHead) return;
    // Check if assignment already exists
    const existing = assignments.find((a) => a.player_id === playerId);
    if (existing) {
      const { error } = await supabase
        .from("roster_assignments")
        .update({ assignment: newLevel as any })
        .eq("program_id", coach.program_id)
        .eq("player_id", playerId);
      if (error) { toast.error("Failed to update assignment"); return; }
    } else {
      const { error } = await supabase
        .from("roster_assignments")
        .insert({
          program_id: coach.program_id,
          player_id: playerId,
          assignment: newLevel as any,
          assigned_by: coach.id,
        });
      if (error) { toast.error("Failed to assign player"); return; }
    }
    // Optimistic update
    setAssignments((prev) => {
      const filtered = prev.filter((a) => a.player_id !== playerId);
      return [...filtered, { player_id: playerId, assignment: newLevel }];
    });
    toast.success("Assignment updated");
  };

  // ── Handlers ──────────────────────────────────────────────────

  const handleCreateGame = async () => {
    if (!coach || !newGame.name.trim()) return;
    setCreating(true);
    const { data, error } = await createGame({
      program_id: coach.program_id,
      name: newGame.name.trim(),
      created_by: coach.id,
      opponent: newGame.opponent.trim() || undefined,
      team_level: newGame.team_level || undefined,
      game_date: newGame.game_date || undefined,
      location: newGame.location.trim() || undefined,
    });
    if (error) {
      toast.error("Failed to create game");
    } else if (data) {
      toast.success(`"${data.name}" created`);
      setGames((prev) => [data, ...prev]);
    }
    setShowCreate(false);
    setNewGame({ name: "", opponent: "", team_level: "", game_date: "", location: "" });
    setCreating(false);
  };

  const handleDeleteGame = async () => {
    if (!deleteTarget) return;
    const { error } = await deleteGame(deleteTarget.id);
    if (error) {
      toast.error("Failed to delete game");
    } else {
      toast.success("Game deleted");
      setGames((prev) => prev.filter((g) => g.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 animate-fade-in">
      {/* Hero */}
      <div className="page-hero mb-5">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Team Management
        </h1>
        <p className="text-white/70 text-sm mt-0.5">
          {players.length} players • {games.length} game{games.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Level filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedLevel("all")}
          className={cn(
            "rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200",
            selectedLevel === "all"
              ? "gradient-primary text-white"
              : "bg-card border text-muted-foreground hover:text-foreground"
          )}
        >
          All ({players.length})
        </button>
        {levels.filter((l) => l.toLowerCase() !== "cut").map((level) => (
          <button
            key={level}
            onClick={() => setSelectedLevel((prev) => (prev === level ? "all" : level))}
            className={cn(
              "rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200",
              selectedLevel === level
                ? "bg-primary text-white"
                : "bg-card border text-muted-foreground hover:text-foreground"
            )}
          >
            {level} ({levelCounts.get(level) || 0})
          </button>
        ))}
        <button
          onClick={() => setSelectedLevel((prev) => (prev === "unassigned" ? "all" : "unassigned"))}
          className={cn(
            "rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200",
            selectedLevel === "unassigned"
              ? "bg-foreground text-background"
              : "bg-card border text-muted-foreground hover:text-foreground"
          )}
        >
          Unassigned ({levelCounts.get("unassigned") || 0})
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players..."
          className="pl-10 tap-target text-base h-12 rounded-xl"
        />
      </div>

      {/* ── Team Roster Section ───────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {selectedLevel === "all" ? "All Players" : selectedLevel === "unassigned" ? "Unassigned" : `${selectedLevel} Roster`}
          </h2>
          <span className="text-xs text-muted-foreground">{filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""}</span>
        </div>

        {filteredPlayers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {search ? "No players match your search." : "No players assigned to this level."}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredPlayers.map((p) => {
              const rawLevel = assignmentMap.get(p.id);
              const displayLevel = rawLevel ? (enumToLevel.get(rawLevel.toLowerCase()) ?? rawLevel) : null;
              return (
                <div
                  key={p.id}
                  className="player-card"
                >
                  <div
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/player/${p.id}`, { state: { playerIds: filteredPlayers.map((x) => x.id), source: selectedLevel === "all" ? "team" : selectedLevel } })}
                  >
                    {p.player_number ? (
                      <span className="number-badge">{p.player_number}</span>
                    ) : (
                      <span className="number-badge bg-muted text-muted-foreground">—</span>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-[15px] truncate">
                        {p.last_name}, {p.first_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {p.grade && (
                          <span className="text-xs text-muted-foreground">
                            Grade {p.grade}
                          </span>
                        )}
                        {p.positions?.map((pos) => (
                          <Badge
                            key={pos}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-4 font-medium"
                          >
                            {pos}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isHead ? (
                      <Select
                        value={rawLevel || ""}
                        onValueChange={(v) => handleAssign(p.id, v)}
                      >
                        <SelectTrigger className="w-24 h-8 tap-target rounded-xl font-semibold text-[11px]">
                          <SelectValue placeholder="Assign" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {levels.map((l) => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      displayLevel && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold"
                        >
                          {displayLevel}
                        </Badge>
                      )
                    )}
                    <ChevronRight
                      className="h-4 w-4 text-muted-foreground cursor-pointer"
                      onClick={() => navigate(`/player/${p.id}`, { state: { playerIds: filteredPlayers.map((x) => x.id), source: selectedLevel === "all" ? "team" : selectedLevel } })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Games Section ─────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Games
          </h2>
          {isHead && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-xl text-xs font-bold"
              onClick={() => {
                setNewGame((prev) => ({
                  ...prev,
                  team_level: selectedLevel !== "all" && selectedLevel !== "unassigned" ? selectedLevel : "",
                }));
                setShowCreate(true);
              }}
            >
              <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
              Add Game
            </Button>
          )}
        </div>

        {filteredGames.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {isHead ? "No games scheduled. Tap \"Add Game\" to create one." : "No games scheduled yet."}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredGames.map((g) => (
              <div
                key={g.id}
                onClick={() => navigate(`/game/${g.id}`)}
                className="rounded-xl border bg-card p-3.5 cursor-pointer hover:bg-accent/50 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[15px] truncate">{g.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(g.game_date + "T00:00:00"), "MMM d, yyyy")}
                      </span>
                      {g.game_time && (
                        <span>{g.game_time.slice(0, 5)}</span>
                      )}
                      {g.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {g.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {g.team_level && (
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {g.team_level}
                      </Badge>
                    )}
                    <Badge
                      variant={g.status === "completed" ? "secondary" : g.status === "cancelled" ? "destructive" : "default"}
                      className="text-[10px] font-semibold"
                    >
                      {g.status}
                    </Badge>
                    {isHead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(g);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create Game Dialog ────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>New Game</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Game Name *
              </label>
              <Input
                value={newGame.name}
                onChange={(e) => setNewGame((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. vs Lincoln High"
                className="rounded-xl"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Opponent
              </label>
              <Input
                value={newGame.opponent}
                onChange={(e) => setNewGame((p) => ({ ...p, opponent: e.target.value }))}
                placeholder="Opponent name"
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Date
                </label>
                <Input
                  type="date"
                  value={newGame.game_date}
                  onChange={(e) => setNewGame((p) => ({ ...p, game_date: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Team Level
                </label>
                <Select
                  value={newGame.team_level}
                  onValueChange={(v) => setNewGame((p) => ({ ...p, team_level: v }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {levels.filter((l) => l.toLowerCase() !== "cut").map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Location
              </label>
              <Input
                value={newGame.location}
                onChange={(e) => setNewGame((p) => ({ ...p, location: e.target.value }))}
                placeholder="Field or venue name"
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateGame}
              disabled={!newGame.name.trim() || creating}
              className="rounded-xl"
            >
              {creating ? "Creating..." : "Create Game"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the game and its roster and lineup data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGame}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Game
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
