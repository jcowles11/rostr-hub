import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "@/contexts/SessionContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  player_number: number | null;
}

interface Metric {
  id: string;
  name: string;
  unit: string;
  category: string;
  metric_type: string;
  min_value: number | null;
  max_value: number | null;
  max_attempts: number;
}

interface Evaluation {
  id: string;
  player_id: string;
  metric_id: string;
  attempt_number: number;
  value: number;
}

interface PreviousScore {
  session_name: string;
  session_date: string;
  attempt_number: number;
  value: number;
}

export default function ScoreEntry() {
  const { coach } = useAuth();
  const { selectedSessionId } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [recentScores, setRecentScores] = useState<{ player: Player; metric: string; value: string; attempt: number }[]>([]);
  const [stationMode, setStationMode] = useState(false);
  const [stationIndex, setStationIndex] = useState(0);
  const [sortBy, setSortBy] = useState<"alpha" | "number">("alpha");
  const [existingEvals, setExistingEvals] = useState<Evaluation[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const [previousScores, setPreviousScores] = useState<PreviousScore[]>([]);

  const selectedSession = selectedSessionId !== "all" ? selectedSessionId : "";

  // Fetch players and metrics on mount
  useEffect(() => {
    if (!coach) return;
    Promise.all([
      supabase.from("players").select("id, first_name, last_name, player_number").eq("program_id", coach.program_id).order("last_name").order("first_name"),
      supabase.from("metrics").select("id, name, unit, category, metric_type, min_value, max_value, max_attempts").eq("program_id", coach.program_id).order("sort_order"),
    ]).then(([pRes, mRes]) => {
      setPlayers(pRes.data || []);
      setMetrics(mRes.data || []);
      if (mRes.data && mRes.data.length > 0) setSelectedMetric(mRes.data[0].id);
    });
  }, [coach]);

  // Fetch existing evaluations scoped by session
  useEffect(() => {
    if (!coach || !selectedMetric || !selectedSession) {
      setExistingEvals([]);
      return;
    }
    supabase
      .from("evaluations")
      .select("id, player_id, metric_id, attempt_number, value")
      .eq("program_id", coach.program_id)
      .eq("metric_id", selectedMetric)
      .eq("coach_id", coach.id)
      .eq("session_id", selectedSession)
      .then(({ data }) => setExistingEvals(data || []));
  }, [coach, selectedMetric, selectedSession, recentScores]);

  const filtered = players
    .filter((p) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
      const reverseName = `${p.last_name} ${p.first_name}`.toLowerCase();
      const numStr = p.player_number != null ? String(p.player_number) : "";
      return fullName.includes(q) || reverseName.includes(q) || numStr.includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "number") {
        const aNum = a.player_number ?? Infinity;
        const bNum = b.player_number ?? Infinity;
        return aNum - bNum;
      }
      return a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
    });

  const currentMetric = metrics.find((m) => m.id === selectedMetric);
  const maxAttempts = currentMetric?.max_attempts || 1;

  const getPlayerAttemptEval = (playerId: string, attempt: number) => {
    return existingEvals.find(
      (e) => e.player_id === playerId && e.attempt_number === attempt
    );
  };

  // Re-derive activePlayer after filtered is defined
  const resolvedActivePlayer = stationMode ? filtered[stationIndex] : selectedPlayer;

  // Fetch previous session scores for the active player + metric
  useEffect(() => {
    if (!coach || !resolvedActivePlayer || !selectedMetric || !selectedSession) {
      setPreviousScores([]);
      return;
    }
    supabase
      .from("evaluations")
      .select("attempt_number, value, session_id")
      .eq("program_id", coach.program_id)
      .eq("metric_id", selectedMetric)
      .eq("player_id", resolvedActivePlayer.id)
      .neq("session_id", selectedSession)
      .then(async ({ data }) => {
        if (!data || data.length === 0) {
          setPreviousScores([]);
          return;
        }
        const sessionIds = [...new Set(data.map((d) => d.session_id).filter(Boolean))] as string[];
        const { data: sessData } = await supabase
          .from("tryout_sessions")
          .select("id, name, session_date")
          .in("id", sessionIds);
        const sessMap = new Map((sessData || []).map((s) => [s.id, s]));
        setPreviousScores(
          data
            .filter((d) => d.session_id && sessMap.has(d.session_id))
            .map((d) => ({
              session_name: sessMap.get(d.session_id!)?.name || "",
              session_date: sessMap.get(d.session_id!)?.session_date || "",
              attempt_number: d.attempt_number,
              value: d.value,
            }))
        );
      });
  }, [coach, resolvedActivePlayer?.id, selectedMetric, selectedSession]);

  const handleScore = async () => {
    if (!resolvedActivePlayer || !selectedMetric || !value || !coach || !selectedSession) return;
    setSaving(true);

    const existing = getPlayerAttemptEval(resolvedActivePlayer.id, currentAttempt);

    let error;
    if (existing) {
      ({ error } = await supabase.from("evaluations").update({ value: parseFloat(value) }).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("evaluations").insert({
        program_id: coach.program_id,
        player_id: resolvedActivePlayer.id,
        metric_id: selectedMetric,
        coach_id: coach.id,
        value: parseFloat(value),
        attempt_number: currentAttempt,
        session_id: selectedSession,
      }));
    }

    if (error) {
      toast.error("Failed to save score");
    } else {
      setRecentScores((prev) => [
        { player: resolvedActivePlayer, metric: currentMetric?.name || "", value: `${value} ${currentMetric?.unit || ""}`, attempt: currentAttempt },
        ...prev.slice(0, 9),
      ]);
      toast.success(`${resolvedActivePlayer.last_name}: ${value} ${currentMetric?.unit || ""}${maxAttempts > 1 ? ` (Att ${currentAttempt})` : ""}`, { duration: 1500 });
      setValue("");

      if (stationMode) {
        if (stationIndex < filtered.length - 1) {
          setStationIndex((i) => i + 1);
        }
      }
    }
    setSaving(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleScore();
  };

  const enterStationMode = (playerIndex?: number) => {
    setStationMode(true);
    setStationIndex(playerIndex ?? 0);
    setSelectedPlayer(null);
    setValue("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const exitStationMode = () => {
    setStationMode(false);
    setSelectedPlayer(null);
    setValue("");
  };

  const selectPlayerDirect = (p: Player) => {
    const idx = filtered.findIndex((fp) => fp.id === p.id);
    enterStationMode(idx >= 0 ? idx : 0);
  };


  const playerDisplay = (p: Player) => (
    <>
      {p.player_number && <span className="text-primary font-extrabold">#{p.player_number} </span>}
      {p.last_name}, {p.first_name}
    </>
  );

  const AttemptSelector = () => {
    if (maxAttempts <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-1.5 my-3">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Attempt:</span>
        {Array.from({ length: maxAttempts }, (_, i) => i + 1).map((att) => {
          const hasScore = resolvedActivePlayer ? !!getPlayerAttemptEval(resolvedActivePlayer.id, att) : false;
          return (
            <button
              key={att}
              onClick={() => { setCurrentAttempt(att); setValue(""); inputRef.current?.focus(); }}
              className={cn(
                "h-9 w-9 rounded-lg text-sm font-bold transition-all border",
                currentAttempt === att
                  ? "bg-primary text-primary-foreground border-primary shadow-md scale-110"
                  : hasScore
                    ? "bg-accent/20 text-accent-foreground border-accent/30"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
              )}
            >
              {att}
            </button>
          );
        })}
      </div>
    );
  };

  const currentExistingScore = resolvedActivePlayer ? getPlayerAttemptEval(resolvedActivePlayer.id, currentAttempt) : null;

  const sessionDisabled = !selectedSession;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 animate-fade-in">
      {/* Hero header */}
      <div className="page-hero mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Score Entry</h1>
            <p className="text-white/70 text-sm mt-0.5">
              {stationMode ? "Station Mode — cycle through players" : "Tap a player to start scoring"}
            </p>
          </div>
          <Button
            variant={stationMode ? "default" : "outline"}
            size="sm"
            onClick={() => stationMode ? exitStationMode() : enterStationMode()}
            className={cn(
              "tap-target font-bold rounded-xl transition-all",
              stationMode
                ? "bg-white/20 hover:bg-white/30 text-white border-0"
                : "bg-white/10 hover:bg-white/20 text-white border-white/20"
            )}
            disabled={sessionDisabled}
          >
            {stationMode ? "Exit Station" : "Station Mode"}
          </Button>
        </div>
      </div>

      {/* Session notice */}
      {sessionDisabled && (
        <div className="mb-4 rounded-xl bg-muted/60 p-3 text-center">
          <p className="text-sm text-muted-foreground font-medium">Select a session from the header to start scoring.</p>
        </div>
      )}

      {/* Metric selector */}
      <div className="mb-4">
        <Select value={selectedMetric} onValueChange={(v) => { setSelectedMetric(v); setCurrentAttempt(1); setValue(""); }} disabled={sessionDisabled}>
          <SelectTrigger className="tap-target text-base font-semibold h-12 rounded-xl">
            <SelectValue placeholder="Select metric" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {metrics.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name} ({m.unit}){m.max_attempts > 1 ? ` · ${m.max_attempts} attempts` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search & sort */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (stationMode) setStationIndex(0); }}
            placeholder="Search players..."
            className="pl-10 tap-target text-base h-12 rounded-xl"
            disabled={sessionDisabled}
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="tap-target h-12 w-12 rounded-xl shrink-0"
          title={sortBy === "alpha" ? "Sort by number" : "Sort alphabetically"}
          onClick={() => setSortBy(sortBy === "alpha" ? "number" : "alpha")}
          disabled={sessionDisabled}
        >
          {sortBy === "alpha" ? <span className="font-bold text-sm">A-Z</span> : <span className="font-bold text-sm">#</span>}
        </Button>
      </div>

      {/* Active scoring card */}
      {resolvedActivePlayer && !sessionDisabled ? (
        <div className="section-card p-6 text-center border-2 border-primary/30 shadow-elevated animate-scale-in mb-4">
          <div className="flex items-center justify-between">
            {stationMode && (
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Player {stationIndex + 1} of {filtered.length}
              </p>
            )}
            <button
              onClick={exitStationMode}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors rounded-lg p-1"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-3xl font-extrabold mt-1">{playerDisplay(resolvedActivePlayer)}</p>

          <AttemptSelector />

          {currentExistingScore && (
            <p className="text-xs text-muted-foreground mb-2">
              Current: <span className="font-bold text-foreground">{currentExistingScore.value} {currentMetric?.unit}</span>
              {" "}(will overwrite)
            </p>
          )}

          <div className="flex items-center justify-center gap-3">
            {stationMode && (
              <Button variant="outline" size="icon" className="tap-target rounded-xl h-14 w-14" onClick={() => { setStationIndex(Math.max(0, stationIndex - 1)); setValue(""); setCurrentAttempt(1); }} disabled={stationIndex === 0}>
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}

            <Input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentMetric?.unit || "Value"}
              className="h-16 w-32 text-center text-3xl font-extrabold tap-target rounded-xl border-2 border-primary/20 focus:border-primary"
              autoFocus
            />

            {stationMode && (
              <Button variant="outline" size="icon" className="tap-target rounded-xl h-14 w-14" onClick={() => { setStationIndex(Math.min(filtered.length - 1, stationIndex + 1)); setValue(""); setCurrentAttempt(1); }} disabled={stationIndex >= filtered.length - 1}>
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}
          </div>

          <Button onClick={handleScore} disabled={!value || saving} className="mt-5 w-full tap-target text-lg font-bold rounded-xl h-14 gradient-primary border-0 shadow-glow hover:shadow-lg transition-all">
            <Check className="mr-2 h-5 w-5" /> {stationMode ? "Save & Next" : "Save Score"}
          </Button>

          {/* Previous session scores */}
          {previousScores.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Previous Sessions</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {previousScores.map((ps, i) => (
                  <span key={i} className="inline-block rounded-lg bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground">
                    {ps.value} {currentMetric?.unit} <span className="opacity-60">({ps.session_name}{maxAttempts > 1 ? ` Att ${ps.attempt_number}` : ""})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Player list */}
      {!resolvedActivePlayer && !sessionDisabled && (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto stagger-list">
          {filtered.map((p) => {
            const attemptDots = maxAttempts > 1 ? Array.from({ length: maxAttempts }, (_, i) => {
              const ev = getPlayerAttemptEval(p.id, i + 1);
              return ev ? ev.value : null;
            }) : null;

            return (
              <button
                key={p.id}
                onClick={() => selectPlayerDirect(p)}
                className="player-card tap-target"
              >
                <div className="flex items-center gap-3">
                  {p.player_number ? (
                    <span className="number-badge">{p.player_number}</span>
                  ) : (
                    <span className="number-badge bg-muted text-muted-foreground">—</span>
                  )}
                  <div>
                    <span className="font-bold text-[15px]">{p.last_name}, {p.first_name}</span>
                    {attemptDots && (
                      <div className="flex gap-1 mt-0.5">
                        {attemptDots.map((val, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-block rounded px-1.5 py-0 text-[10px] font-semibold",
                              val !== null
                                ? "bg-accent/20 text-accent-foreground"
                                : "bg-muted/60 text-muted-foreground/50"
                            )}
                          >
                            {val !== null ? `${val}` : `Att ${i + 1}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Recent scores */}
      {recentScores.length > 0 && (
        <div className="mt-6 animate-fade-in">
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Scores</h3>
          <div className="space-y-1.5">
            {recentScores.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
                <span className="font-semibold">
                  {s.player.player_number && <span className="text-primary mr-1">#{s.player.player_number}</span>}
                  {s.player.last_name}
                </span>
                <span className="text-muted-foreground font-medium">
                  {s.metric}: {s.value}{s.attempt > 1 ? ` (Att ${s.attempt})` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
