import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchGameRoster,
  fetchGames,
  fetchLineup,
  saveLineup,
  updateGame,
  type Game,
  type GameRosterEntry,
  type LineupEntry,
} from "@/services/teamService";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Check,
  UserPlus,
  UserMinus,
  Search,
  Save,
  GripVertical,
  Printer,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
  player_number: number | null;
}

interface LocalLineup {
  player_id: string;
  batting_order: number | null;
  position: string;
}

// ── Positions (sport-agnostic defaults, baseball-focused) ────────

const BASEBALL_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "EH"];

// ── Component ─────────────────────────────────────────────────────

export default function GameDetail() {
  const { id: gameId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { coach } = useAuth();
  const isHead = coach?.role === "head_coach";

  // Data
  const [game, setGame] = useState<Game | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());
  const [rosterEntries, setRosterEntries] = useState<GameRosterEntry[]>([]);
  const [lineupEntries, setLineupEntries] = useState<LocalLineup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dirty-state tracking for unsaved lineup protection
  const savedLineupRef = useRef<string>("[]");
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [otherGames, setOtherGames] = useState<Game[]>([]);
  const [copyingFrom, setCopyingFrom] = useState<string | null>(null);

  // UI state
  const [tab, setTab] = useState<"roster" | "lineup">("roster");
  const [search, setSearch] = useState("");

  // ── Fetch ─────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!coach || !gameId) return;
    setLoading(true);

    const [gRes, pRes, aRes, grRes, lRes] = await Promise.all([
      supabase
        .from("games")
        .select("id, program_id, season_id, name, opponent, team_level, game_date, game_time, location, notes, status, created_by, created_at")
        .eq("id", gameId)
        .single(),
      supabase
        .from("players")
        .select("id, first_name, last_name, grade, positions, player_number")
        .eq("program_id", coach.program_id)
        .order("last_name"),
      supabase
        .from("roster_assignments")
        .select("player_id, assignment")
        .eq("program_id", coach.program_id),
      fetchGameRoster(gameId),
      fetchLineup(gameId),
    ]);

    if (gRes.data) setGame(gRes.data as Game);
    setAllPlayers(pRes.data || []);
    // Build assignment map (lowercase enum value → display)
    const aMap = new Map<string, string>();
    (aRes.data || []).forEach((a: { player_id: string; assignment: string }) => aMap.set(a.player_id, a.assignment));
    setAssignments(aMap);
    setRosterEntries(grRes.data);
    const loadedLineup = lRes.data.map((e) => ({
      player_id: e.player_id,
      batting_order: e.batting_order,
      position: e.position || "",
    }));
    setLineupEntries(loadedLineup);
    savedLineupRef.current = JSON.stringify(loadedLineup);
    setLoading(false);
  }, [coach, gameId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Dirty-state detection ───────────────────────────────────

  const isDirty = useMemo(() => {
    return JSON.stringify(lineupEntries) !== savedLineupRef.current;
  }, [lineupEntries]);

  // Browser close / reload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  /** Navigate away with dirty-state confirmation if needed. */
  const safeNavigate = useCallback(
    (to: string | number) => {
      if (isDirty) {
        const ok = window.confirm(
          "You have unsaved lineup changes. Leave without saving?"
        );
        if (!ok) return;
      }
      if (typeof to === "number") navigate(to);
      else navigate(to);
    },
    [isDirty, navigate]
  );

  // ── Copy lineup from another game ──────────────────────────

  const openCopyDialog = useCallback(async () => {
    if (!coach) return;
    const { data } = await fetchGames(coach.program_id);
    // Exclude current game, only show games that exist
    setOtherGames(data.filter((g) => g.id !== gameId));
    setCopyDialogOpen(true);
  }, [coach, gameId]);

  const handleCopyLineup = useCallback(
    async (sourceGameId: string) => {
      setCopyingFrom(sourceGameId);
      const { data: srcLineup } = await fetchLineup(sourceGameId);
      if (!srcLineup || srcLineup.length === 0) {
        toast.error("That game has no lineup to copy");
        setCopyingFrom(null);
        return;
      }

      // Ensure copied players are on this game's roster
      const currentRosterIds = new Set(rosterEntries.map((r) => r.player_id));
      const missingIds = srcLineup
        .map((e) => e.player_id)
        .filter((pid) => !currentRosterIds.has(pid));

      if (missingIds.length > 0 && gameId) {
        // Batch-add missing players to game roster
        const rows = missingIds.map((pid) => ({
          game_id: gameId,
          player_id: pid,
          status: "active",
        }));
        const { data: newRosterRows, error } = await supabase
          .from("game_rosters")
          .upsert(rows, { onConflict: "game_id,player_id" })
          .select();
        if (error) {
          toast.error("Failed to add players to roster");
          setCopyingFrom(null);
          return;
        }
        if (newRosterRows) {
          setRosterEntries((prev) => [
            ...prev,
            ...(newRosterRows as GameRosterEntry[]),
          ]);
        }
      }

      // Load the lineup into local state
      const copied: LocalLineup[] = srcLineup.map((e) => ({
        player_id: e.player_id,
        batting_order: e.batting_order,
        position: e.position || "",
      }));
      setLineupEntries(copied);
      setCopyDialogOpen(false);
      setCopyingFrom(null);
      toast.success(
        `Copied ${srcLineup.length}-player lineup. Review and save when ready.`
      );
    },
    [gameId, rosterEntries]
  );

  // ── Derived ───────────────────────────────────────────────────

  const rosterPlayerIds = useMemo(
    () => new Set(rosterEntries.map((r) => r.player_id)),
    [rosterEntries]
  );

  const lineupPlayerIds = useMemo(
    () => new Set(lineupEntries.map((l) => l.player_id)),
    [lineupEntries]
  );

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    allPlayers.forEach((p) => m.set(p.id, p));
    return m;
  }, [allPlayers]);

  const rosterPlayers = useMemo(
    () => allPlayers.filter((p) => rosterPlayerIds.has(p.id)),
    [allPlayers, rosterPlayerIds]
  );

  /** Does this player's roster_assignment match the game's team_level (case-insensitive)? */
  const playerMatchesGameLevel = useCallback(
    (playerId: string): boolean => {
      if (!game?.team_level) return false;
      const assign = assignments.get(playerId);
      if (!assign) return false;
      return assign.toLowerCase() === game.team_level.toLowerCase();
    },
    [game?.team_level, assignments]
  );

  const availablePlayers = useMemo(() => {
    const q = search.toLowerCase();
    let result: Player[];

    if (tab === "roster") {
      // Show all, mark which are on roster
      result = allPlayers.filter((p) => {
        const nameMatch =
          p.last_name.toLowerCase().includes(q) ||
          p.first_name.toLowerCase().includes(q) ||
          (p.player_number && String(p.player_number).includes(q));
        return !q || nameMatch;
      });
      // Sort: on-roster first, then matching team level, then alphabetical
      if (game?.team_level) {
        result.sort((a, b) => {
          const aOnRoster = rosterPlayerIds.has(a.id) ? 0 : 1;
          const bOnRoster = rosterPlayerIds.has(b.id) ? 0 : 1;
          if (aOnRoster !== bOnRoster) return aOnRoster - bOnRoster;
          const aMatch = playerMatchesGameLevel(a.id) ? 0 : 1;
          const bMatch = playerMatchesGameLevel(b.id) ? 0 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
          return a.last_name.localeCompare(b.last_name);
        });
      }
    } else {
      // Lineup tab: only show roster players not yet in lineup
      result = allPlayers.filter((p) => {
        if (!rosterPlayerIds.has(p.id)) return false;
        if (lineupPlayerIds.has(p.id)) return false;
        const nameMatch =
          p.last_name.toLowerCase().includes(q) ||
          p.first_name.toLowerCase().includes(q);
        return !q || nameMatch;
      });
    }

    return result;
  }, [allPlayers, search, tab, rosterPlayerIds, lineupPlayerIds, game?.team_level, playerMatchesGameLevel]);

  // ── Game Roster Handlers ──────────────────────────────────────

  const toggleRoster = async (playerId: string) => {
    if (!gameId) return;
    const isOn = rosterPlayerIds.has(playerId);
    if (isOn) {
      // Remove from game roster
      const { error } = await supabase
        .from("game_rosters")
        .delete()
        .eq("game_id", gameId)
        .eq("player_id", playerId);
      if (error) { toast.error("Failed to remove player"); return; }
      setRosterEntries((prev) => prev.filter((r) => r.player_id !== playerId));
      // Also remove from lineup if present
      setLineupEntries((prev) => prev.filter((l) => l.player_id !== playerId));
    } else {
      // Add to game roster
      const { data, error } = await supabase
        .from("game_rosters")
        .insert({ game_id: gameId, player_id: playerId, status: "active" })
        .select()
        .single();
      if (error) { toast.error("Failed to add player"); return; }
      setRosterEntries((prev) => [...prev, data as GameRosterEntry]);
    }
  };

  // ── Lineup Handlers ───────────────────────────────────────────

  const addToLineup = (playerId: string) => {
    const nextOrder = lineupEntries.length + 1;
    setLineupEntries((prev) => [
      ...prev,
      { player_id: playerId, batting_order: nextOrder, position: "" },
    ]);
  };

  const removeFromLineup = (playerId: string) => {
    setLineupEntries((prev) => {
      const filtered = prev.filter((l) => l.player_id !== playerId);
      // Reorder
      return filtered.map((l, i) => ({ ...l, batting_order: i + 1 }));
    });
  };

  const updatePosition = (playerId: string, position: string) => {
    setLineupEntries((prev) =>
      prev.map((l) => (l.player_id === playerId ? { ...l, position } : l))
    );
  };

  const moveInLineup = (playerId: string, direction: "up" | "down") => {
    setLineupEntries((prev) => {
      const idx = prev.findIndex((l) => l.player_id === playerId);
      if (idx < 0) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr.map((l, i) => ({ ...l, batting_order: i + 1 }));
    });
  };

  const handleSaveLineup = async () => {
    if (!gameId) return;
    setSaving(true);
    const { error } = await saveLineup(
      gameId,
      lineupEntries.map((l) => ({
        player_id: l.player_id,
        batting_order: l.batting_order,
        position: l.position || null,
      }))
    );
    if (error) {
      toast.error("Failed to save lineup");
    } else {
      savedLineupRef.current = JSON.stringify(lineupEntries);
      toast.success("Lineup saved");
    }
    setSaving(false);
  };

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded-lg" />
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="flex gap-2 mt-4">
          <div className="h-10 flex-1 bg-muted rounded-xl" />
          <div className="h-10 flex-1 bg-muted rounded-xl" />
        </div>
        <div className="space-y-2 mt-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4 text-center">
        <p className="text-muted-foreground">Game not found.</p>
        <Button variant="ghost" onClick={() => navigate("/teams")} className="mt-4">
          Back to Teams
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => safeNavigate("/teams")}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight truncate">{game.name}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{format(new Date(game.game_date + "T00:00:00"), "EEEE, MMM d, yyyy")}</span>
            {game.team_level && <Badge variant="outline" className="text-[10px]">{game.team_level}</Badge>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-muted/50 p-1 rounded-xl">
        <button
          onClick={() => setTab("roster")}
          className={cn(
            "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
            tab === "roster" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
          )}
        >
          Game Roster ({rosterEntries.length})
        </button>
        <button
          onClick={() => setTab("lineup")}
          className={cn(
            "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
            tab === "lineup" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
          )}
        >
          Lineup ({lineupEntries.length})
        </button>
      </div>

      {/* ── Roster Tab ────────────────────────────────────────── */}
      {tab === "roster" && (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players to add or remove..."
              className="pl-10 tap-target text-base h-12 rounded-xl"
            />
          </div>

          {/* Team level hint when game has a level */}
          {game?.team_level && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground">
              <span className="font-semibold text-primary">{game.team_level}</span> players are shown first. Other players are listed below.
            </div>
          )}

          <div className="space-y-1.5">
            {availablePlayers.map((p, idx) => {
              const isOnRoster = rosterPlayerIds.has(p.id);
              const matchesLevel = playerMatchesGameLevel(p.id);
              const playerLevel = assignments.get(p.id);
              // Show separator between matching-level and non-matching players
              const prevPlayer = idx > 0 ? availablePlayers[idx - 1] : null;
              const prevMatches = prevPlayer ? playerMatchesGameLevel(prevPlayer.id) : false;
              const showSeparator = game?.team_level && !isOnRoster && idx > 0 && prevMatches && !matchesLevel;

              return (
                <div key={p.id}>
                  {showSeparator && (
                    <div className="flex items-center gap-2 py-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Other players</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "player-card transition-colors",
                      isOnRoster && "border-primary/30 bg-primary/5",
                      !isOnRoster && matchesLevel && "border-primary/10"
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {p.player_number ? (
                        <span className="number-badge">{p.player_number}</span>
                      ) : (
                        <span className="number-badge bg-muted text-muted-foreground">—</span>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-[15px] truncate">
                          {p.last_name}, {p.first_name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {playerLevel && (
                            <Badge
                              variant={matchesLevel ? "default" : "outline"}
                              className={cn(
                                "text-[10px] px-1.5 py-0 h-4 font-semibold",
                                matchesLevel && "bg-primary/15 text-primary border-0"
                              )}
                            >
                              {playerLevel}
                            </Badge>
                          )}
                          {p.positions?.map((pos) => (
                            <Badge key={pos} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                              {pos}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleRoster(p.id)}
                      className={cn(
                        "rounded-xl p-2.5 transition-all tap-target",
                        isOnRoster
                          ? "bg-primary text-white hover:bg-primary/80"
                          : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                      )}
                    >
                      {isOnRoster ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Lineup Tab ────────────────────────────────────────── */}
      {tab === "lineup" && (
        <>
          {/* Current lineup */}
          {lineupEntries.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                  Batting Order
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => safeNavigate(`/game/${gameId}/print-lineup`)}
                    className="h-8 rounded-xl text-xs font-bold"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1.5" />
                    Print
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveLineup}
                    disabled={saving || !isDirty}
                    className={cn(
                      "h-8 rounded-xl text-xs font-bold",
                      isDirty && "animate-pulse ring-2 ring-primary/30"
                    )}
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {saving ? "Saving..." : isDirty ? "Save *" : "Saved"}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                {lineupEntries.map((entry, idx) => {
                  const player = playerMap.get(entry.player_id);
                  if (!player) return null;
                  return (
                    <div
                      key={entry.player_id}
                      className="rounded-xl border bg-card p-3 flex items-center gap-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveInLineup(entry.player_id, "up")}
                          disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveInLineup(entry.player_id, "down")}
                          disabled={idx === lineupEntries.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                        >
                          ▼
                        </button>
                      </div>
                      <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold shrink-0">
                        {entry.batting_order}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">
                          {player.last_name}, {player.first_name}
                          {player.player_number ? (
                            <span className="text-muted-foreground font-normal ml-1">#{player.player_number}</span>
                          ) : null}
                        </p>
                      </div>
                      <Select
                        value={entry.position || "_none"}
                        onValueChange={(v) => updatePosition(entry.player_id, v === "_none" ? "" : v)}
                      >
                        <SelectTrigger className="w-20 h-8 rounded-lg text-xs font-semibold">
                          <SelectValue placeholder="Pos" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="_none">—</SelectItem>
                          {BASEBALL_POSITIONS.map((pos) => (
                            <SelectItem key={pos} value={pos}>
                              {pos}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => removeFromLineup(entry.player_id)}
                        className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg transition-colors"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add to lineup */}
          {rosterPlayers.filter((p) => !lineupPlayerIds.has(p.id)).length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-2">
                Available (on game roster)
              </h3>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 h-10 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                {availablePlayers.map((p) => (
                  <div
                    key={p.id}
                    className="player-card"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {p.player_number ? (
                        <span className="number-badge text-xs">{p.player_number}</span>
                      ) : (
                        <span className="number-badge bg-muted text-muted-foreground text-xs">—</span>
                      )}
                      <p className="font-bold text-sm truncate">
                        {p.last_name}, {p.first_name}
                      </p>
                      {p.positions?.map((pos) => (
                        <Badge key={pos} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {pos}
                        </Badge>
                      ))}
                    </div>
                    <button
                      onClick={() => addToLineup(p.id)}
                      className="rounded-xl p-2 bg-muted hover:bg-primary/10 hover:text-primary transition-all tap-target"
                    >
                      <UserPlus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Copy from previous game — shown when lineup is empty */}
          {lineupEntries.length === 0 && rosterPlayers.length > 0 && (
            <div className="rounded-xl border border-dashed bg-card/50 p-6 text-center space-y-3">
              <p className="font-bold text-sm">No lineup yet</p>
              <p className="text-sm text-muted-foreground">
                Add players above or start from a previous game.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={openCopyDialog}
                className="rounded-xl text-xs font-bold"
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy from Previous Game
              </Button>
            </div>
          )}

          {lineupEntries.length === 0 && rosterPlayers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm space-y-3">
              <p>Add players to the game roster first, then build your lineup.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={openCopyDialog}
                className="rounded-xl text-xs font-bold"
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy from Previous Game
              </Button>
            </div>
          )}

          {/* Copy from game — also available when lineup exists (via header) */}
          {lineupEntries.length > 0 && (
            <div className="flex justify-center mt-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={openCopyDialog}
                className="rounded-xl text-xs font-medium text-muted-foreground"
              >
                <Copy className="h-3 w-3 mr-1.5" />
                Replace with another game's lineup
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── Copy Lineup Dialog ───────────────────────────────── */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Copy Lineup from Game</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Select a game to copy its lineup into this game. Players not already on the game roster will be added automatically.
          </p>
          {lineupEntries.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 mb-2 dark:border-amber-900 dark:bg-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                This will replace the current lineup. Save first if you want to keep it.
              </p>
            </div>
          )}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {otherGames.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No other games found.
              </p>
            )}
            {otherGames.map((g) => (
              <button
                key={g.id}
                onClick={() => handleCopyLineup(g.id)}
                disabled={copyingFrom === g.id}
                className={cn(
                  "w-full text-left rounded-xl border bg-card p-3 hover:bg-muted/50 transition-colors",
                  copyingFrom === g.id && "opacity-50"
                )}
              >
                <p className="font-bold text-sm truncate">{g.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>
                    {format(new Date(g.game_date + "T00:00:00"), "MMM d, yyyy")}
                  </span>
                  {g.opponent && <span>vs {g.opponent}</span>}
                  {g.team_level && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                      {g.team_level}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
