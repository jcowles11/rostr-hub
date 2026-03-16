import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "@/contexts/SessionContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Check, ChevronLeft, ChevronRight, X, Loader2, WifiOff, RefreshCw, CalendarPlus, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchPlayerSummaries, type PlayerSummary } from "@/services/playerService";
import { fetchMetricsForScoring, type MetricForScoring } from "@/services/metricService";
import {
  fetchSessionEvaluations,
  fetchPreviousSessionScores,
  saveScore,
  type Evaluation,
  type PreviousScore,
} from "@/services/evaluationService";
import { useRetryQueue, type QueuedScore } from "@/hooks/useRetryQueue";
import { track } from "@/services/analyticsService";

type Player = PlayerSummary;
type Metric = MetricForScoring;

export default function ScoreEntry() {
  const { coach } = useAuth();
  const { selectedSessionId, sessions, setSession, createSession } = useSession();
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
  // Synchronous guard to prevent concurrent saves (React state is async)
  const savingRef = useRef(false);
  // Save status flash: "saved" | "error" | null
  const [lastSaveStatus, setLastSaveStatus] = useState<"saved" | "error" | null>(null);
  const saveFlashTimer = useRef<ReturnType<typeof setTimeout>>();
  // Running count of saves this session for coach confidence
  const [sessionSaveCount, setSessionSaveCount] = useState(0);

  const [previousScores, setPreviousScores] = useState<PreviousScore[]>([]);

  // Retry queue for network failures
  const retryCallbacks = useMemo(() => ({
    onRetrySuccess: (item: QueuedScore) => {
      setRecentScores((prev) => [
        { player: { id: item.input.player_id, first_name: "", last_name: item.playerName } as Player, metric: item.metricName, value: `${item.value}`, attempt: item.input.attempt_number },
        ...prev.slice(0, 9),
      ]);
      setSessionSaveCount((c) => c + 1);
      toast.success(`Retry succeeded: ${item.playerName} — ${item.value}`, { duration: 2000 });
    },
    onRetryExhausted: (item: QueuedScore) => {
      toast.error(`Save failed permanently: ${item.playerName} ${item.metricName} = ${item.value}. Check the retry queue.`, { duration: 5000 });
    },
  }), []);

  const { enqueue, dismissFailed, retryAllFailed, status: retryStatus } = useRetryQueue(retryCallbacks);

  const selectedSession = selectedSessionId !== "all" ? selectedSessionId : "";

  // Reset save count when session changes
  useEffect(() => {
    setSessionSaveCount(0);
  }, [selectedSession]);

  // Fetch players and metrics on mount
  useEffect(() => {
    if (!coach) return;
    Promise.all([
      fetchPlayerSummaries(coach.program_id),
      fetchMetricsForScoring(coach.program_id),
    ]).then(([pRes, mRes]) => {
      setPlayers(pRes.data);
      setMetrics(mRes.data);
      if (mRes.data.length > 0) setSelectedMetric(mRes.data[0].id);
    });
  }, [coach]);

  // Fetch existing evaluations scoped by session
  useEffect(() => {
    if (!coach || !selectedMetric || !selectedSession) {
      setExistingEvals([]);
      return;
    }
    fetchSessionEvaluations(coach.program_id, selectedMetric, coach.id, selectedSession)
      .then(({ data }) => setExistingEvals(data));
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

  // Clamp stationIndex when filtered array shrinks (KI-9b fix)
  useEffect(() => {
    if (stationMode && filtered.length > 0 && stationIndex >= filtered.length) {
      setStationIndex(filtered.length - 1);
    }
  }, [stationMode, filtered.length, stationIndex]);

  // Re-derive activePlayer after filtered is defined (with safe bounds check)
  const resolvedActivePlayer = stationMode
    ? filtered[Math.min(stationIndex, Math.max(0, filtered.length - 1))]
    : selectedPlayer;

  // Fetch previous session scores for the active player + metric
  useEffect(() => {
    if (!coach || !resolvedActivePlayer || !selectedMetric || !selectedSession) {
      setPreviousScores([]);
      return;
    }
    fetchPreviousSessionScores(coach.program_id, resolvedActivePlayer.id, selectedMetric, selectedSession)
      .then(({ data }) => setPreviousScores(data));
  }, [coach, resolvedActivePlayer?.id, selectedMetric, selectedSession]);

  const showSaveFlash = useCallback((status: "saved" | "error") => {
    setLastSaveStatus(status);
    if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current);
    saveFlashTimer.current = setTimeout(() => setLastSaveStatus(null), status === "saved" ? 1500 : 3000);
  }, []);

  const handleScore = useCallback(async () => {
    // Synchronous ref guard — prevents concurrent saves even with rapid Enter key
    if (savingRef.current) return;
    if (!resolvedActivePlayer || !selectedMetric || !value || !coach || !selectedSession) return;

    savingRef.current = true;
    setSaving(true);

    const existing = getPlayerAttemptEval(resolvedActivePlayer.id, currentAttempt);

    const { error, retryable } = await saveScore(
      {
        program_id: coach.program_id,
        player_id: resolvedActivePlayer.id,
        metric_id: selectedMetric,
        coach_id: coach.id,
        value: parseFloat(value),
        attempt_number: currentAttempt,
        session_id: selectedSession,
      },
      existing?.id,
      currentMetric ? {
        min_value: currentMetric.min_value,
        max_value: currentMetric.max_value,
        metric_type: currentMetric.metric_type,
        name: currentMetric.name,
        unit: currentMetric.unit,
      } : undefined
    );

    if (error) {
      if (retryable) {
        // Network/transient error — enqueue for background retry
        enqueue(
          {
            program_id: coach.program_id,
            player_id: resolvedActivePlayer.id,
            metric_id: selectedMetric,
            coach_id: coach.id,
            value: parseFloat(value),
            attempt_number: currentAttempt,
            session_id: selectedSession,
          },
          {
            existingEvalId: existing?.id,
            metricBounds: currentMetric ? {
              min_value: currentMetric.min_value,
              max_value: currentMetric.max_value,
              metric_type: currentMetric.metric_type,
              name: currentMetric.name,
              unit: currentMetric.unit,
            } : undefined,
            lastError: error,
            playerName: resolvedActivePlayer.last_name,
            metricName: currentMetric?.name || "",
          }
        );
        showSaveFlash("error");
        toast.warning(`Score queued for retry: ${resolvedActivePlayer.last_name}`, { duration: 2000 });
        // Clear value and advance — the queue will handle the save
        setValue("");
        if (stationMode) {
          if (stationIndex < filtered.length - 1) {
            setStationIndex((i) => i + 1);
          } else if (maxAttempts > 1 && currentAttempt < maxAttempts) {
            setStationIndex(0);
            setCurrentAttempt((a) => a + 1);
          }
        }
      } else {
        // Validation error — not retryable, coach must fix
        toast.error(error);
        showSaveFlash("error");
      }
    } else {
      setRecentScores((prev) => [
        { player: resolvedActivePlayer, metric: currentMetric?.name || "", value: `${value} ${currentMetric?.unit || ""}`, attempt: currentAttempt },
        ...prev.slice(0, 9),
      ]);
      setSessionSaveCount((c) => c + 1);
      showSaveFlash("saved");
      if (coach) track("score_entry", coach.program_id, coach.id, { label: stationMode ? "station" : "direct", source: "score_page" });
      toast.success(`${resolvedActivePlayer.last_name}: ${value} ${currentMetric?.unit || ""}${maxAttempts > 1 ? ` (Att ${currentAttempt})` : ""}`, { duration: 1500 });
      setValue("");

      if (stationMode) {
        if (stationIndex < filtered.length - 1) {
          setStationIndex((i) => i + 1);
        } else if (maxAttempts > 1 && currentAttempt < maxAttempts) {
          // Last player — wrap to first player on next attempt
          setStationIndex(0);
          setCurrentAttempt((a) => a + 1);
          toast.info(`Starting Attempt ${currentAttempt + 1}`, { duration: 2000 });
        }
      }
    }
    setSaving(false);
    savingRef.current = false;
    inputRef.current?.focus();
  }, [resolvedActivePlayer, selectedMetric, value, coach, selectedSession, currentAttempt, currentMetric, stationMode, stationIndex, filtered.length, maxAttempts, showSaveFlash]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !savingRef.current) handleScore();
  }, [handleScore]);

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

  // Station Mode progress: how many of the filtered players have at least one score for the current metric
  const stationProgress = useMemo(() => {
    if (!stationMode || filtered.length === 0) return { scored: 0, total: 0, pct: 0 };
    const scoredPlayerIds = new Set(existingEvals.map((e) => e.player_id));
    const scored = filtered.filter((p) => scoredPlayerIds.has(p.id)).length;
    return { scored, total: filtered.length, pct: Math.round((scored / filtered.length) * 100) };
  }, [stationMode, filtered, existingEvals]);

  const sessionDisabled = !selectedSession;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 animate-fade-in">
      {/* Hero header */}
      <div className="page-hero mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Score Entry</h1>
            <p className="text-white/70 text-sm mt-0.5">
              {stationMode
                ? `Station Mode — Attempt ${currentAttempt}${maxAttempts > 1 ? ` of ${maxAttempts}` : ""}`
                : "Tap a player to start scoring"}
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

      {/* Event notice — guides coach to create or select a session */}
      {sessionDisabled && (
        <div className="mb-4 rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/50 p-4 text-center space-y-3 animate-fade-in">
          {sessions.length === 0 ? (
            <>
              <CalendarPlus className="h-8 w-8 mx-auto text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Create your first event to start scoring</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Events organize scores by tryout day or session.</p>
              </div>
              <div className="flex gap-2 max-w-xs mx-auto">
                <Input
                  placeholder="e.g. Fall Tryouts Day 1"
                  className="h-10 text-sm rounded-xl flex-1"
                  id="quickSessionName"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const input = e.currentTarget;
                      const name = input.value.trim();
                      if (!name) return;
                      createSession(name).then((s) => {
                        if (s) {
                          toast.success(`Event "${s.name}" created — ready to score!`);
                          input.value = "";
                        } else {
                          toast.error("Failed to create event");
                        }
                      });
                    }
                  }}
                />
                <Button
                  className="h-10 rounded-xl font-bold gradient-primary border-0 shadow-glow"
                  onClick={() => {
                    const input = document.getElementById("quickSessionName") as HTMLInputElement | null;
                    const name = input?.value?.trim();
                    if (!name) { toast.error("Enter an event name"); return; }
                    createSession(name).then((s) => {
                      if (s) {
                        toast.success(`Event "${s.name}" created — ready to score!`);
                        if (input) input.value = "";
                      } else {
                        toast.error("Failed to create event");
                      }
                    });
                  }}
                >
                  Create
                </Button>
              </div>
            </>
          ) : (
            <>
              <Calendar className="h-6 w-6 mx-auto text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Select an event to start scoring</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {sessions.slice(0, 5).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSession(s.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white dark:bg-card hover:border-primary hover:text-primary transition-colors"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              {sessions.length > 5 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">+ {sessions.length - 5} more in header dropdown</p>
              )}
            </>
          )}
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
            <div className="flex items-center gap-2">
              {stationMode && (
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Player {stationIndex + 1} of {filtered.length}
                </p>
              )}
              {/* Save status indicator */}
              {lastSaveStatus === "saved" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400 animate-fade-in">
                  <Check className="h-3 w-3" /> Saved
                </span>
              )}
              {lastSaveStatus === "error" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive animate-fade-in">
                  <X className="h-3 w-3" /> Failed
                </span>
              )}
              {saving && (
                <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {sessionSaveCount > 0 && (
                <span className="text-[10px] font-bold text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
                  {sessionSaveCount} saved
                </span>
              )}
              <button
                onClick={exitStationMode}
                className="text-muted-foreground hover:text-foreground transition-colors rounded-lg p-1"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <p className="text-3xl font-extrabold mt-1">{playerDisplay(resolvedActivePlayer)}</p>

          {/* Station Mode progress bar */}
          {stationMode && stationProgress.total > 0 && (
            <div className="mt-2 mb-1 mx-auto max-w-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {stationProgress.scored}/{stationProgress.total} scored
                </span>
                <span className="text-[10px] font-bold text-primary">
                  {stationProgress.pct}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${stationProgress.pct}%` }}
                />
              </div>
            </div>
          )}

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

            <div className="flex flex-col items-center">
              <Input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentMetric?.unit || "Value"}
                min={currentMetric?.min_value ?? undefined}
                max={currentMetric?.max_value ?? undefined}
                className="h-16 w-32 text-center text-3xl font-extrabold tap-target rounded-xl border-2 border-primary/20 focus:border-primary"
                autoFocus
              />
              {currentMetric?.min_value != null && currentMetric?.max_value != null && (
                <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                  Range: {currentMetric.min_value}–{currentMetric.max_value} {currentMetric.unit}
                </p>
              )}
            </div>

            {stationMode && (
              <Button variant="outline" size="icon" className="tap-target rounded-xl h-14 w-14" onClick={() => { setStationIndex(Math.min(filtered.length - 1, stationIndex + 1)); setValue(""); setCurrentAttempt(1); }} disabled={stationIndex >= filtered.length - 1}>
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}
          </div>

          <Button onClick={handleScore} disabled={!value || saving} className="mt-5 w-full tap-target text-lg font-bold rounded-xl h-14 gradient-primary border-0 shadow-glow hover:shadow-lg transition-all">
            {saving ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</>
            ) : (
              <><Check className="mr-2 h-5 w-5" /> {stationMode ? "Save & Next" : "Save Score"}</>
            )}
          </Button>

          {/* Previous session scores */}
          {previousScores.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5">Previous Sessions</p>
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

      {/* Retry queue status */}
      {(retryStatus.pendingCount > 0 || retryStatus.failedItems.length > 0) && (
        <div className="mb-4 rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/50 p-3 animate-fade-in">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {retryStatus.pendingCount > 0
                  ? `${retryStatus.pendingCount} score${retryStatus.pendingCount !== 1 ? "s" : ""} retrying...`
                  : `${retryStatus.failedItems.length} score${retryStatus.failedItems.length !== 1 ? "s" : ""} failed`}
              </span>
              {retryStatus.isRetrying && <Loader2 className="h-3 w-3 animate-spin text-amber-600" />}
            </div>
            {retryStatus.failedItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                onClick={retryAllFailed}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Retry All
              </Button>
            )}
          </div>
          {retryStatus.failedItems.length > 0 && (
            <div className="space-y-1 mt-2">
              {retryStatus.failedItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between text-xs bg-white/60 dark:bg-black/20 rounded-lg px-2 py-1.5">
                  <span className="font-medium text-amber-900 dark:text-amber-200">
                    {item.playerName} — {item.metricName}: {item.value}
                  </span>
                  <button
                    onClick={() => dismissFailed(item.key)}
                    className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 ml-2"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent scores */}
      {recentScores.length > 0 && (
        <div className="mt-6 animate-fade-in">
          <h3 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Recent Scores</h3>
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
