import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Check, ChevronLeft, ChevronRight } from "lucide-react";
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
}

export default function ScoreEntry() {
  const { coach } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [recentScores, setRecentScores] = useState<{ player: Player; metric: string; value: string }[]>([]);
  const [stationMode, setStationMode] = useState(false);
  const [stationIndex, setStationIndex] = useState(0);
  const [sortBy, setSortBy] = useState<"alpha" | "number">("alpha");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!coach) return;
    Promise.all([
      supabase.from("players").select("id, first_name, last_name, player_number").eq("program_id", coach.program_id).order("last_name").order("first_name"),
      supabase.from("metrics").select("id, name, unit, category, metric_type, min_value, max_value").eq("program_id", coach.program_id).order("sort_order"),
    ]).then(([pRes, mRes]) => {
      setPlayers(pRes.data || []);
      setMetrics(mRes.data || []);
      if (mRes.data && mRes.data.length > 0) setSelectedMetric(mRes.data[0].id);
    });
  }, [coach]);

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

  const handleScore = async () => {
    const player = stationMode ? filtered[stationIndex] : selectedPlayer;
    if (!player || !selectedMetric || !value || !coach) return;
    setSaving(true);

    const { error } = await supabase.from("evaluations").insert({
      program_id: coach.program_id,
      player_id: player.id,
      metric_id: selectedMetric,
      coach_id: coach.id,
      value: parseFloat(value),
    });

    if (error) {
      toast.error("Failed to save score");
    } else {
      setRecentScores((prev) => [
        { player, metric: currentMetric?.name || "", value: `${value} ${currentMetric?.unit || ""}` },
        ...prev.slice(0, 9),
      ]);
      toast.success(`${player.last_name}: ${value} ${currentMetric?.unit || ""}`, { duration: 1500 });
      setValue("");

      if (stationMode && stationIndex < filtered.length - 1) {
        setStationIndex((i) => i + 1);
      }
    }
    setSaving(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleScore();
  };

  const stationPlayer = stationMode ? filtered[stationIndex] : null;

  const playerDisplay = (p: Player) => (
    <>
      {p.player_number && <span className="text-primary font-extrabold">#{p.player_number} </span>}
      {p.last_name}, {p.first_name}
    </>
  );

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 animate-fade-in">
      {/* Hero header */}
      <div className="page-hero mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Score Entry</h1>
            <p className="text-white/70 text-sm mt-0.5">
              {stationMode ? "Station Mode — cycle through players" : "Select a player to score"}
            </p>
          </div>
          <Button
            variant={stationMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setStationMode(!stationMode); setStationIndex(0); }}
            className={cn(
              "tap-target font-bold rounded-xl transition-all",
              stationMode
                ? "bg-white/20 hover:bg-white/30 text-white border-0"
                : "bg-white/10 hover:bg-white/20 text-white border-white/20"
            )}
          >
            {stationMode ? "Exit Station" : "Station Mode"}
          </Button>
        </div>
      </div>

      {/* Metric selector */}
      <div className="mb-4">
        <Select value={selectedMetric} onValueChange={setSelectedMetric}>
          <SelectTrigger className="tap-target text-base font-semibold h-12 rounded-xl">
            <SelectValue placeholder="Select metric" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {metrics.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name} ({m.unit})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stationMode ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setStationIndex(0); }} placeholder="Filter players..." className="pl-10 tap-target text-base h-12 rounded-xl" />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="tap-target h-12 w-12 rounded-xl shrink-0"
              title={sortBy === "alpha" ? "Sort by number" : "Sort alphabetically"}
              onClick={() => setSortBy(sortBy === "alpha" ? "number" : "alpha")}
            >
              {sortBy === "alpha" ? <span className="font-bold text-sm">A-Z</span> : <span className="font-bold text-sm">#</span>}
            </Button>
          </div>
          <div>
            <Button
              variant="outline"
              size="icon"
              className="tap-target h-12 w-12 rounded-xl shrink-0"
              title={sortBy === "alpha" ? "Sort by number" : "Sort alphabetically"}
              onClick={() => setSortBy(sortBy === "alpha" ? "number" : "alpha")}
            >
              {sortBy === "alpha" ? <span className="font-bold text-sm">A-Z</span> : <span className="font-bold text-sm">#</span>}
            </Button>
          </div>

          {stationPlayer && (
            <div className="section-card p-6 text-center border-2 border-primary/30 shadow-elevated animate-scale-in">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Player {stationIndex + 1} of {filtered.length}</p>
              <p className="text-3xl font-extrabold mt-2">{playerDisplay(stationPlayer)}</p>

              <div className="mt-6 flex items-center justify-center gap-3">
                <Button variant="outline" size="icon" className="tap-target rounded-xl h-14 w-14" onClick={() => setStationIndex(Math.max(0, stationIndex - 1))} disabled={stationIndex === 0}>
                  <ChevronLeft className="h-6 w-6" />
                </Button>

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

                <Button variant="outline" size="icon" className="tap-target rounded-xl h-14 w-14" onClick={() => setStationIndex(Math.min(filtered.length - 1, stationIndex + 1))} disabled={stationIndex >= filtered.length - 1}>
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>

              <Button onClick={handleScore} disabled={!value || saving} className="mt-5 w-full tap-target text-lg font-bold rounded-xl h-14 gradient-primary border-0 shadow-glow hover:shadow-lg transition-all">
                <Check className="mr-2 h-5 w-5" /> Save & Next
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players..." className="pl-10 tap-target text-base h-12 rounded-xl" />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="tap-target h-12 w-12 rounded-xl shrink-0"
              title={sortBy === "alpha" ? "Sort by number" : "Sort alphabetically"}
              onClick={() => setSortBy(sortBy === "alpha" ? "number" : "alpha")}
            >
              {sortBy === "alpha" ? <span className="font-bold text-sm">A-Z</span> : <span className="font-bold text-sm">#</span>}
            </Button>
          </div>

          {selectedPlayer ? (
            <div className="section-card p-6 text-center border-2 border-primary/30 shadow-elevated animate-scale-in">
              <button onClick={() => setSelectedPlayer(null)} className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                ← Change player
              </button>
              <p className="text-2xl font-extrabold mt-2">{playerDisplay(selectedPlayer)}</p>
              <div className="mt-5 flex items-center justify-center gap-3">
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
              </div>
              <Button onClick={handleScore} disabled={!value || saving} className="mt-5 w-full tap-target text-lg font-bold rounded-xl h-14 gradient-primary border-0 shadow-glow hover:shadow-lg transition-all">
                <Check className="mr-2 h-5 w-5" /> Save Score
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto stagger-list">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPlayer(p); setValue(""); setTimeout(() => inputRef.current?.focus(), 100); }}
                  className="player-card tap-target"
                >
                  <div className="flex items-center gap-3">
                    {p.player_number ? (
                      <span className="number-badge">{p.player_number}</span>
                    ) : (
                      <span className="number-badge bg-muted text-muted-foreground">—</span>
                    )}
                    <span className="font-bold text-[15px]">{p.last_name}, {p.first_name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
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
                <span className="text-muted-foreground font-medium">{s.metric}: {s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
