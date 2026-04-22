/**
 * Roster — Productized coach-facing roster management.
 *
 * Shows all players with team assignment badges, position info,
 * and grade. Supports filtering by team level, search by name/number/position,
 * and quick navigation to player profiles.
 *
 * Route: /roster
 */
import { useEffect, useState, useMemo } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, UserPlus, Share2, Users, X, Upload, Database, Globe, Trash2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, StatusPill } from "@/components/ui/layout";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getSportPositions, sportHasBatsThrows } from "@/lib/sports";
import RosterUpload from "@/components/RosterUpload";
import DataImport from "@/components/DataImport";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchRosterPlayers,
  createPlayer,
  autoAssignPlayerNumbers,
  deleteAllPlayers,
  getRegistrationCode,
  type PlayerListItem,
} from "@/services/playerService";
import { track } from "@/services/analyticsService";

type Player = PlayerListItem;

interface RosterAssignment {
  player_id: string;
  assignment: string;
}

// ── Level badge color helper ───────────────────────────────────────

function levelBadgeClasses(level: string | null): string {
  if (!level) return "bg-muted/60 text-muted-foreground border-transparent";
  const l = level.toLowerCase();
  if (l === "varsity") return "bg-primary/10 text-primary border-primary/20";
  if (l === "jv") return "bg-orange-500/10 text-orange-600 border-orange-500/20";
  if (l === "freshman") return "bg-green-500/10 text-green-600 border-green-500/20";
  if (l === "cut") return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-accent/10 text-accent-foreground border-accent/20";
}

export default function Roster() {
  const { coach } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<RosterAssignment[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"alpha" | "number">("alpha");
  const [newPlayer, setNewPlayer] = useState({ first_name: "", last_name: "", grade: "", bats: "", throws: "" });
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dataImportOpen, setDataImportOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const levels = useMemo(() => coach?.program_levels || [], [coach]);
  const sport = coach?.sport || "baseball";
  const positions = getSportPositions(sport);
  const showBatsThrows = sportHasBatsThrows(sport);

  const togglePosition = (pos: string) => {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  // ── Data loading ─────────────────────────────────────────────────

  const loadPlayers = async () => {
    if (!coach) return;
    const [pRes, aRes] = await Promise.all([
      fetchRosterPlayers(coach.program_id),
      supabase
        .from("roster_assignments")
        .select("player_id, assignment")
        .eq("program_id", coach.program_id),
    ]);
    if (pRes.error) {
      console.error("Failed to fetch players:", pRes.error);
      toast.error("Failed to load roster");
    }
    setPlayers(pRes.data);
    setAssignments((aRes.data as RosterAssignment[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!coach) return;
    loadPlayers();
  }, [coach]);

  // ── Derived data ─────────────────────────────────────────────────

  const assignmentMap = useMemo(() => {
    const m = new Map<string, string>();
    assignments.forEach((a) => m.set(a.player_id, a.assignment));
    return m;
  }, [assignments]);

  // Case-insensitive enum→display level mapping
  const enumToLevel = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((l) => m.set(l.toLowerCase(), l));
    return m;
  }, [levels]);

  const getPlayerLevel = (playerId: string): string | null => {
    const raw = assignmentMap.get(playerId);
    if (!raw) return null;
    return enumToLevel.get(raw.toLowerCase()) ?? raw;
  };

  // Level counts for filter pills
  const levelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    levels.forEach((l) => counts.set(l, 0));
    let unassigned = 0;

    players.forEach((p) => {
      const level = getPlayerLevel(p.id);
      if (level && counts.has(level)) {
        counts.set(level, (counts.get(level) || 0) + 1);
      } else {
        unassigned++;
      }
    });
    return { levels: counts, unassigned };
  }, [players, assignmentMap, levels, enumToLevel]);

  // Filtered + sorted player list
  const filtered = useMemo(() => {
    return players
      .filter((p) => {
        // Level filter
        if (levelFilter !== "all") {
          const level = getPlayerLevel(p.id);
          if (levelFilter === "unassigned") {
            if (level) return false;
          } else {
            if (level !== levelFilter) return false;
          }
        }
        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchesName = p.last_name.toLowerCase().includes(q) || p.first_name.toLowerCase().includes(q);
          const matchesNumber = p.player_number !== null && String(p.player_number).includes(q);
          const matchesPosition = p.positions?.some((pos) => pos.toLowerCase().includes(q)) ?? false;
          if (!matchesName && !matchesNumber && !matchesPosition) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "number") {
          return (a.player_number ?? Infinity) - (b.player_number ?? Infinity);
        }
        return a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
      });
  }, [players, search, sortBy, levelFilter, assignmentMap, enumToLevel]);

  // ── Handlers ─────────────────────────────────────────────────────

  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coach || adding) return;
    if (!newPlayer.first_name.trim() || !newPlayer.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }
    setAdding(true);
    try {
      const { error } = await createPlayer({
        program_id: coach.program_id,
        first_name: newPlayer.first_name.trim(),
        last_name: newPlayer.last_name.trim(),
        grade: newPlayer.grade ? parseInt(newPlayer.grade) : null,
        positions: selectedPositions.length > 0 ? selectedPositions : [],
        bats: newPlayer.bats || null,
        throws: newPlayer.throws || null,
      });
      if (error) {
        toast.error(`Failed to add player: ${error}`);
      } else {
        toast.success("Player added!");
        if (coach) track("player_create", coach.program_id, coach.id, { source: "roster_page" });
        setNewPlayer({ first_name: "", last_name: "", grade: "", bats: "", throws: "" });
        setSelectedPositions([]);
        setAddOpen(false);
        loadPlayers();
      }
    } catch {
      toast.error("Something went wrong adding the player");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!coach) return;
    setDeletingAll(true);
    const playerIds = players.map((p) => p.id);
    const { error } = await deleteAllPlayers(coach.program_id, playerIds);
    if (error) {
      toast.error("Failed to delete players");
    } else {
      toast.success(`Deleted ${players.length} players and all their data`);
      setPlayers([]);
      setAssignments([]);
    }
    setDeletingAll(false);
    setDeleteAllOpen(false);
  };

  const copyRegLink = async () => {
    if (!coach) return;
    const { code } = await getRegistrationCode(coach.program_id);
    if (code) {
      const link = `${window.location.origin}/register/${code}`;
      navigator.clipboard.writeText(link);
      toast.success("Registration link copied!");
    }
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-8 animate-fade-in">
      {/* Header */}
      <PageHeader
        className="mb-4"
        title="Roster"
        subtitle={
          players.length > 0
            ? `${players.length} player${players.length !== 1 ? "s" : ""}${levelCounts.unassigned > 0 ? ` · ${levelCounts.unassigned} unassigned` : ""}`
            : "Build your program roster"
        }
        right={
          <div className="flex items-center gap-1">
            {levelCounts.unassigned > 0 && (
              <StatusPill tone="attention" className="mr-1">
                {levelCounts.unassigned} open
              </StatusPill>
            )}
          <button
            className="flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Import roster"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            className="flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Share registration link"
            onClick={copyRegLink}
          >
            <Share2 className="h-4 w-4" />
          </button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 rounded-xl text-xs font-bold gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Player
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Add Player</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">First Name</Label>
                    <Input value={newPlayer.first_name} onChange={(e) => setNewPlayer({ ...newPlayer, first_name: e.target.value })} required className="h-11 rounded-xl" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Last Name</Label>
                    <Input value={newPlayer.last_name} onChange={(e) => setNewPlayer({ ...newPlayer, last_name: e.target.value })} required className="h-11 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Grade</Label>
                  <Input type="number" value={newPlayer.grade} onChange={(e) => setNewPlayer({ ...newPlayer, grade: e.target.value })} placeholder="9-12" className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Position(s)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {positions.map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => togglePosition(pos)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border",
                          selectedPositions.includes(pos)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
                {showBatsThrows && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Bats</Label>
                      <Select value={newPlayer.bats} onValueChange={(v) => setNewPlayer({ ...newPlayer, bats: v })}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="R">Right (R)</SelectItem>
                          <SelectItem value="L">Left (L)</SelectItem>
                          <SelectItem value="S">Switch (S)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Throws</Label>
                      <Select value={newPlayer.throws} onValueChange={(v) => setNewPlayer({ ...newPlayer, throws: v })}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="R">Right (R)</SelectItem>
                          <SelectItem value="L">Left (L)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <Button type="submit" disabled={adding} className="w-full h-11 font-bold rounded-xl">
                  {adding ? "Adding..." : "Add Player"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, number, or position..."
          className="pl-9 h-10 rounded-xl text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Level filter pills + sort toggle */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-1 flex-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setLevelFilter("all")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap border",
              levelFilter === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            All ({players.length})
          </button>
          {levels
            .filter((l) => l.toLowerCase() !== "cut")
            .map((level) => (
              <button
                key={level}
                onClick={() => setLevelFilter(levelFilter === level ? "all" : level)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap border",
                  levelFilter === level
                    ? "bg-primary text-white border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {level} ({levelCounts.levels.get(level) || 0})
              </button>
            ))}
          {levelCounts.unassigned > 0 && (
            <button
              onClick={() => setLevelFilter(levelFilter === "unassigned" ? "all" : "unassigned")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap border",
                levelFilter === "unassigned"
                  ? "bg-muted-foreground text-background border-muted-foreground"
                  : "bg-card text-muted-foreground border-border border-dashed hover:text-foreground"
              )}
            >
              Unassigned ({levelCounts.unassigned})
            </button>
          )}
        </div>
        <button
          className="flex items-center justify-center h-8 w-8 rounded-lg border bg-card text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={sortBy === "alpha" ? "Sort by number" : "Sort alphabetically"}
          onClick={() => setSortBy(sortBy === "alpha" ? "number" : "alpha")}
        >
          <span className="text-xs font-bold">{sortBy === "alpha" ? "A-Z" : "#"}</span>
        </button>
      </div>

      {/* Player count bar */}
      {!loading && filtered.length > 0 && filtered.length !== players.length && (
        <p className="text-xs text-muted-foreground mb-2 px-0.5">
          Showing {filtered.length} of {players.length} players
        </p>
      )}

      {/* Player list */}
      <div className="space-y-1 stagger-list">
        {loading ? (
          <div className="space-y-1.5 animate-pulse">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card px-3 py-2.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-muted rounded w-32" />
                  <div className="h-3 bg-muted rounded w-20" />
                </div>
                <div className="w-14 h-5 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center animate-fade-in">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <UserPlus className="h-7 w-7 text-muted-foreground/40" />
            </div>
            {players.length === 0 ? (
              <>
                <p className="font-semibold text-sm">No players on your roster yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-[240px] mx-auto">
                  Add players manually, import from a spreadsheet, or share a registration link.
                </p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" className="rounded-xl text-xs font-bold gap-1.5" onClick={() => setAddOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Player
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl text-xs font-bold gap-1.5" onClick={() => setUploadOpen(true)}>
                    <Upload className="h-3.5 w-3.5" />
                    Import
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="font-semibold text-sm">No players match your filters</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search or filter.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs font-bold mt-3"
                  onClick={() => { setSearch(""); setLevelFilter("all"); }}
                >
                  Clear Filters
                </Button>
              </>
            )}
          </div>
        ) : (
          filtered.map((p) => {
            const level = getPlayerLevel(p.id);
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/player/${p.id}`, { state: { playerIds: filtered.map((x) => x.id), source: levelFilter === "all" ? "roster" : levelFilter } })}
                className="flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-all duration-150 hover:bg-muted/40 hover:border-primary/15 active:scale-[0.995]"
              >
                {/* Number badge */}
                {p.photo_url ? (
                  <img src={p.photo_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/8 shrink-0">
                    <span className={cn("text-sm font-bold", p.player_number ? "text-primary" : "text-muted-foreground/40")}>
                      {p.player_number ?? "—"}
                    </span>
                  </div>
                )}

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate leading-tight">
                    {p.last_name}, {p.first_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {p.positions && p.positions.length > 0 && (
                      <span className="text-xs text-muted-foreground font-medium">
                        {p.positions.slice(0, 2).join(" / ")}
                      </span>
                    )}
                    {p.grade && (
                      <span className="text-xs text-muted-foreground">
                        {p.positions && p.positions.length > 0 ? "·" : ""} Gr. {p.grade}
                      </span>
                    )}
                  </div>
                </div>

                {/* Team level badge */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn(
                    "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border",
                    levelBadgeClasses(level)
                  )}>
                    {level || "Unassigned"}
                  </span>
                  {p.profile_public && p.profile_slug && (
                    <span
                      role="button"
                      title="Public profile"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/p/${p.profile_slug}`, "_blank");
                      }}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Globe className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Utility actions — bottom (only when roster is not empty) */}
      {!loading && players.length > 0 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <div className="flex gap-2">
            <button
              className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
              onClick={async () => {
                const { assignedCount, error } = await autoAssignPlayerNumbers(players);
                if (assignedCount === 0 && !error) toast.info("All players already have numbers");
                else if (error) toast.error("Failed to assign numbers");
                else { toast.success(`Assigned numbers to ${assignedCount} player${assignedCount !== 1 ? "s" : ""}`); loadPlayers(); }
              }}
            >
              Auto-number
            </button>
            <span className="text-muted-foreground/30">·</span>
            <button className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors" onClick={() => setDataImportOpen(true)}>
              Import Scores
            </button>
            <span className="text-muted-foreground/30">·</span>
            <button className="text-xs text-destructive/70 hover:text-destructive font-medium transition-colors" onClick={() => setDeleteAllOpen(true)}>
              Clear All
            </button>
          </div>
        </div>
      )}

      <RosterUpload open={uploadOpen} onOpenChange={setUploadOpen} onSuccess={loadPlayers} />
      <DataImport open={dataImportOpen} onOpenChange={setDataImportOpen} onSuccess={loadPlayers} />

      <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all {players.length} players?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete every player on this roster along with all their evaluations, notes, and roster assignments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} disabled={deletingAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingAll ? "Deleting..." : "Delete All Players"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
