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

  const filtered = players.filter((p) => {
    const q = search.toLowerCase();
    return p.last_name.toLowerCase().includes(q) || p.first_name.toLowerCase().includes(q);
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

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Score Entry</h1>
        <Button
          variant={stationMode ? "default" : "outline"}
          size="sm"
          onClick={() => { setStationMode(!stationMode); setStationIndex(0); }}
          className="tap-target"
        >
          {stationMode ? "Exit Station" : "Station Mode"}
        </Button>
      </div>

      {/* Metric selector */}
      <div className="mb-4">
        <Select value={selectedMetric} onValueChange={setSelectedMetric}>
          <SelectTrigger className="tap-target text-base font-medium">
            <SelectValue placeholder="Select metric" />
          </SelectTrigger>
          <SelectContent>
            {metrics.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name} ({m.unit})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stationMode ? (
        /* Station mode: cycle through players */
        <div className="space-y-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setStationIndex(0); }} placeholder="Filter players..." className="pl-10 tap-target text-base" />
          </div>

          {stationPlayer && (
            <div className="rounded-xl border-2 border-primary bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">Player {stationIndex + 1} of {filtered.length}</p>
              <p className="text-3xl font-bold mt-1">
                {stationPlayer.player_number && <span className="text-primary">#{stationPlayer.player_number} </span>}
                {stationPlayer.last_name}, {stationPlayer.first_name}
              </p>

              <div className="mt-6 flex items-center justify-center gap-3">
                <Button variant="outline" size="icon" className="tap-target" onClick={() => setStationIndex(Math.max(0, stationIndex - 1))} disabled={stationIndex === 0}>
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
                  className="h-16 w-32 text-center text-3xl font-bold tap-target"
                  autoFocus
                />

                <Button variant="outline" size="icon" className="tap-target" onClick={() => setStationIndex(Math.min(filtered.length - 1, stationIndex + 1))} disabled={stationIndex >= filtered.length - 1}>
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>

              <Button onClick={handleScore} disabled={!value || saving} className="mt-4 w-full tap-target text-lg font-semibold">
                <Check className="mr-2 h-5 w-5" /> Save & Next
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Normal mode: search & select player */
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players..." className="pl-10 tap-target text-base" />
          </div>

          {selectedPlayer ? (
            <div className="rounded-xl border-2 border-primary bg-card p-6 text-center">
              <button onClick={() => setSelectedPlayer(null)} className="text-sm text-muted-foreground hover:text-foreground underline">
                ← Change player
              </button>
              <p className="text-2xl font-bold mt-1">
                {selectedPlayer.player_number && <span className="text-primary">#{selectedPlayer.player_number} </span>}
                {selectedPlayer.last_name}, {selectedPlayer.first_name}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Input
                  ref={inputRef}
                  type="number"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={currentMetric?.unit || "Value"}
                  className="h-16 w-32 text-center text-3xl font-bold tap-target"
                  autoFocus
                />
              </div>
              <Button onClick={handleScore} disabled={!value || saving} className="mt-4 w-full tap-target text-lg font-semibold">
                <Check className="mr-2 h-5 w-5" /> Save Score
              </Button>
            </div>
          ) : (
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPlayer(p); setValue(""); setTimeout(() => inputRef.current?.focus(), 100); }}
                  className="flex w-full items-center rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 tap-target"
                >
                  <span className="font-semibold">
                    {p.player_number && <span className="text-primary mr-1">#{p.player_number}</span>}
                    {p.last_name}, {p.first_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent scores */}
      {recentScores.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Recent Scores</h3>
          <div className="space-y-1">
            {recentScores.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">{s.player.last_name}</span>
                <span className="text-muted-foreground">{s.metric}: {s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
