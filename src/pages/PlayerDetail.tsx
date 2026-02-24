import { useEffect, useState, useRef } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Star, AlertTriangle, Eye, MessageSquare, Send, Phone, HeartPulse, Pencil, Trash2, Plus, Check, X, ExternalLink, ChevronDown, ChevronRight, Award } from "lucide-react";
import PlayerPhotoUpload from "@/components/PlayerPhotoUpload";
import { aggregateValues, AGGREGATION_LABELS } from "@/lib/metrics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getSportPositions, sportHasBatsThrows } from "@/lib/sports";
import { format } from "date-fns";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | null;
  positions: string[] | null;
  jersey_number_preference: number | null;
  player_number: number | null;
  travel_ball_experience: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
  photo_url: string | null;
  bats: string | null;
  throws: string | null;
  profile_slug: string | null;
  profile_public: boolean;
}

interface Evaluation {
  id: string;
  value: number;
  metric_id: string;
  coach_id: string;
  created_at: string;
  session_id: string | null;
}

interface SessionInfo {
  id: string;
  name: string;
  session_date: string;
}

interface Metric { id: string; name: string; unit: string; metric_type: string; category: string; aggregation: string; }
interface Coach { id: string; full_name: string; color: string; }
interface Note { id: string; content: string; flag: string | null; coach_id: string; created_at: string; }
interface ExternalEntry {
  id: string;
  metric_name: string;
  metric_unit: string;
  metric_type: string;
  metric_value: number;
  event_name: string | null;
  event_date: string | null;
  notes: string | null;
  created_at: string;
  evaluator: { id: string; full_name: string; organization_name: string } | null;
}

export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const { coach } = useAuth();
  const { selectedSessionId, sessions: globalSessions } = useSession();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<Player | null>(null);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [sessionInfos, setSessionInfos] = useState<SessionInfo[]>([]);
  const [externalEntries, setExternalEntries] = useState<ExternalEntry[]>([]);
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());
  const [newNote, setNewNote] = useState("");
  const [newFlag, setNewFlag] = useState<string>("");
  const [coachFilter, setCoachFilter] = useState<string>("all");
  const [editingEval, setEditingEval] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addingMetric, setAddingMetric] = useState<string | null>(null);
  const [addValue, setAddValue] = useState("");
  const [savingEval, setSavingEval] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  const sport = coach?.sport || "baseball";
  const sportPositions = getSportPositions(sport);
  const showBatsThrows = sportHasBatsThrows(sport);

  const fetchAll = async () => {
    if (!coach || !id) return;
    const [pRes, eRes, mRes, cRes, nRes, sRes] = await Promise.all([
      supabase.from("players").select("*").eq("id", id).single(),
      supabase.from("evaluations").select("id, value, metric_id, coach_id, created_at, session_id").eq("player_id", id),
      supabase.from("metrics").select("id, name, unit, metric_type, category, aggregation").eq("program_id", coach.program_id).order("sort_order"),
      supabase.from("coaches").select("id, full_name, color").eq("program_id", coach.program_id),
      supabase.from("player_notes").select("id, content, flag, coach_id, created_at").eq("player_id", id).order("created_at", { ascending: false }),
      supabase.from("tryout_sessions").select("id, name, session_date").eq("program_id", coach.program_id).order("session_date", { ascending: false }),
    ]);
    setPlayer(pRes.data);
    setEvals(eRes.data || []);
    setMetrics(mRes.data || []);
    setCoaches(cRes.data || []);
    setNotes(nRes.data || []);
    setSessionInfos(sRes.data || []);

    // Fetch external evaluator entries for this player
    const { data: extData } = await supabase
      .from("evaluator_entries")
      .select("id, metric_name, metric_unit, metric_type, metric_value, event_name, event_date, notes, created_at, evaluator_id")
      .eq("player_id", id)
      .order("created_at", { ascending: false });

    if (extData && extData.length > 0) {
      const evalIds = [...new Set(extData.map((e) => e.evaluator_id))];
      const { data: evaluators } = await supabase
        .from("evaluators")
        .select("id, full_name, organization_name")
        .in("id", evalIds);
      const evalMap = new Map(evaluators?.map((ev) => [ev.id, ev]) || []);
      setExternalEntries(
        extData.map((e) => ({
          ...e,
          evaluator: evalMap.get(e.evaluator_id) || null,
        }))
      );
    } else {
      setExternalEntries([]);
    }
  };

  useEffect(() => {
    fetchAll();
    if (!coach || !id) return;
    const channel = supabase
      .channel(`player-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluations", filter: `player_id=eq.${id}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "player_notes", filter: `player_id=eq.${id}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [coach, id]);

  const getCoach = (cid: string) => coaches.find((c) => c.id === cid);

  const filteredEvals = coachFilter === "all" ? evals : evals.filter((e) => e.coach_id === coachFilter);

  // Group evals by session
  const sessionMap = new Map<string, SessionInfo>(sessionInfos.map((s) => [s.id, s]));
  const evalsBySession = new Map<string, Evaluation[]>();
  filteredEvals.forEach((e) => {
    const key = e.session_id || "unsorted";
    const arr = evalsBySession.get(key) || [];
    arr.push(e);
    evalsBySession.set(key, arr);
  });

  // Sort session keys: newest first, "unsorted" last
  const sessionKeys = [...evalsBySession.keys()].sort((a, b) => {
    if (a === "unsorted") return 1;
    if (b === "unsorted") return -1;
    const aDate = sessionMap.get(a)?.session_date || "";
    const bDate = sessionMap.get(b)?.session_date || "";
    return bDate.localeCompare(aDate);
  });

  // Aggregate evals across ALL sessions for each metric
  const evalsByMetric = new Map<string, Evaluation[]>();
  filteredEvals.forEach((e) => {
    const arr = evalsByMetric.get(e.metric_id) || [];
    arr.push(e);
    evalsByMetric.set(e.metric_id, arr);
  });

  const toggleMetric = (key: string) => {
    setExpandedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderEvalChip = (e: Evaluation) => {
    const c = getCoach(e.coach_id);
    const isEditing = editingEval === e.id;
    const isOwnEval = e.coach_id === coach?.id;

    if (isEditing) {
      return (
        <span key={e.id} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white shadow-sm animate-fade-in" style={{ backgroundColor: c?.color || "hsl(var(--primary))" }}>
          <Input
            ref={editInputRef}
            type="number"
            inputMode="decimal"
            value={editValue}
            onChange={(ev) => setEditValue(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") handleUpdateEval(e.id);
              if (ev.key === "Escape") setEditingEval(null);
            }}
            className="h-6 w-16 text-center text-xs font-bold bg-white/20 border-white/30 text-white rounded"
            autoFocus
          />
          <button onClick={() => handleUpdateEval(e.id)} className="hover:bg-white/20 rounded p-0.5"><Check className="h-3 w-3" /></button>
          <button onClick={() => setEditingEval(null)} className="hover:bg-white/20 rounded p-0.5"><X className="h-3 w-3" /></button>
        </span>
      );
    }

    return (
      <span
        key={e.id}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white shadow-sm group",
          isOwnEval && "cursor-pointer"
        )}
        style={{ backgroundColor: c?.color || "hsl(var(--primary))" }}
        onClick={() => {
          if (!isOwnEval) return;
          setEditingEval(e.id);
          setEditValue(e.value.toString());
          setTimeout(() => editInputRef.current?.focus(), 50);
        }}
      >
        {c?.full_name?.split(" ")[0] || "?"}: {e.value}
        {isOwnEval && (
          <>
            <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <button
              onClick={(ev) => { ev.stopPropagation(); handleDeleteEval(e.id); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20 rounded p-0.5"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </>
        )}
      </span>
    );
  };

  const addNote = async () => {
    if (!coach || !id || !newNote.trim()) return;
    const flagValue = newFlag as "standout" | "needs_second_look" | "concern" | undefined;
    const { error } = await supabase.from("player_notes").insert({
      program_id: coach.program_id,
      player_id: id,
      coach_id: coach.id,
      content: newNote,
      flag: flagValue || null,
    });
    if (error) toast.error("Failed to add note");
    else { setNewNote(""); setNewFlag(""); fetchAll(); }
  };

  const handleAddEval = async (metricId: string) => {
    if (!coach || !id || !addValue) return;
    setSavingEval(true);
    const { error } = await supabase.from("evaluations").insert({
      program_id: coach.program_id,
      player_id: id,
      metric_id: metricId,
      coach_id: coach.id,
      value: parseFloat(addValue),
    });
    if (error) toast.error("Failed to add score");
    else { setAddingMetric(null); setAddValue(""); toast.success("Score added"); fetchAll(); }
    setSavingEval(false);
  };

  const handleUpdateEval = async (evalId: string) => {
    if (!editValue) return;
    setSavingEval(true);
    const { error } = await supabase.from("evaluations").update({ value: parseFloat(editValue) }).eq("id", evalId);
    if (error) toast.error("Failed to update score");
    else { setEditingEval(null); toast.success("Score updated"); fetchAll(); }
    setSavingEval(false);
  };

  const handleDeleteEval = async (evalId: string) => {
    const { error } = await supabase.from("evaluations").delete().eq("id", evalId);
    if (error) toast.error("Failed to delete score");
    else { toast.success("Score deleted"); fetchAll(); }
  };

  if (!player) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <img src={rostrLogo} alt="Loading" className="mx-auto h-12 w-12 rounded-2xl animate-pulse-soft object-cover" />
    </div>
  );

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-8 animate-fade-in">
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Player hero card */}
      <div className="page-hero mb-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <PlayerPhotoUpload
              playerId={player.id}
              currentUrl={player.photo_url}
              onUploaded={async (url) => {
                await supabase.from("players").update({ photo_url: url }).eq("id", player.id);
                setPlayer({ ...player, photo_url: url });
                toast.success("Photo updated");
              }}
              size="lg"
              className="border-2 border-white/30 rounded-full"
            />
            <button
              onClick={() => {
                const num = prompt("Enter player number:", player.player_number?.toString() || "");
                if (num === null) return;
                const parsed = num.trim() === "" ? null : parseInt(num);
                if (num.trim() !== "" && (isNaN(parsed!) || parsed! < 0)) { toast.error("Invalid number"); return; }
                supabase.from("players").update({ player_number: parsed }).eq("id", player.id).then(({ error }) => {
                  if (error) toast.error("Failed to update");
                  else { setPlayer({ ...player, player_number: parsed }); toast.success("Player number updated"); }
                });
              }}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-extrabold text-white hover:bg-primary/80 transition-colors cursor-pointer shadow-md"
              title="Tap to edit player number"
            >
              {player.player_number ?? "#"}
            </button>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">
              {player.last_name}, {player.first_name}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {player.grade && <span className="rounded-lg bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">Grade {player.grade}</span>}
              {player.positions?.map((p) => <span key={p} className="rounded-lg bg-white/15 px-2 py-0.5 text-xs font-medium text-white/90">{p}</span>)}
              {player.jersey_number_preference && <span className="rounded-lg bg-white/15 px-2 py-0.5 text-xs font-medium text-white/90">Jersey #{player.jersey_number_preference}</span>}
              {player.bats && player.throws && <span className="rounded-lg bg-white/15 px-2 py-0.5 text-xs font-medium text-white/90">B/T: {player.bats}/{player.throws}</span>}
              {player.bats && !player.throws && <span className="rounded-lg bg-white/15 px-2 py-0.5 text-xs font-medium text-white/90">Bats: {player.bats}</span>}
              {!player.bats && player.throws && <span className="rounded-lg bg-white/15 px-2 py-0.5 text-xs font-medium text-white/90">Throws: {player.throws}</span>}
              <button
                onClick={() => setEditingProfile(!editingProfile)}
                className="rounded-lg bg-white/10 hover:bg-white/20 px-2 py-0.5 text-xs font-medium text-white/70 hover:text-white transition-colors"
              >
                <Pencil className="h-3 w-3 inline mr-0.5" /> Edit
              </button>
            </div>
          </div>
        </div>
        {/* Public profile link */}
        <div className="mt-3 flex items-center gap-2">
          {player.profile_public && player.profile_slug ? (
            <a
              href={`/p/${player.profile_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-1 text-xs font-semibold text-white transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> View Public Profile
            </a>
          ) : (
            <span className="text-xs text-white/40 italic">Public profile not enabled</span>
          )}
        </div>
        {player.travel_ball_experience && <p className="text-sm text-white/60 mt-2">Travel: {player.travel_ball_experience}</p>}
      </div>

      {/* Editable profile section */}
      {editingProfile && (
        <Card className="section-card mb-4 animate-fade-in border-2 border-primary/20">
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Position(s)</Label>
              <div className="flex flex-wrap gap-1.5">
                {sportPositions.map((pos) => (
                  <button
                    key={pos}
                    onClick={async () => {
                      const current = player.positions || [];
                      const updated = current.includes(pos) ? current.filter((p) => p !== pos) : [...current, pos];
                      const { error } = await supabase.from("players").update({ positions: updated }).eq("id", player.id);
                      if (error) toast.error("Failed to update");
                      else setPlayer({ ...player, positions: updated });
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border",
                      (player.positions || []).includes(pos)
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Bats</Label>
                  <Select
                    value={player.bats || ""}
                    onValueChange={async (v) => {
                      const { error } = await supabase.from("players").update({ bats: v }).eq("id", player.id);
                      if (error) toast.error("Failed to update");
                      else setPlayer({ ...player, bats: v });
                    }}
                  >
                    <SelectTrigger className="tap-target h-10 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="R">Right (R)</SelectItem>
                      <SelectItem value="L">Left (L)</SelectItem>
                      <SelectItem value="S">Switch (S)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Throws</Label>
                  <Select
                    value={player.throws || ""}
                    onValueChange={async (v) => {
                      const { error } = await supabase.from("players").update({ throws: v }).eq("id", player.id);
                      if (error) toast.error("Failed to update");
                      else setPlayer({ ...player, throws: v });
                    }}
                  >
                    <SelectTrigger className="tap-target h-10 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="R">Right (R)</SelectItem>
                      <SelectItem value="L">Left (L)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={() => setEditingProfile(false)}>
              Done
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Coach filter */}
      <div className="mb-4">
        <Select value={coachFilter} onValueChange={setCoachFilter}>
          <SelectTrigger className="tap-target rounded-xl h-12 font-semibold"><SelectValue placeholder="Filter by coach" /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Coaches</SelectItem>
            {coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Scores by metric - aggregated with expandable history */}
      <Card className="section-card mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-lg font-bold">Evaluations</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {metrics.map((m) => {
            const mEvals = (evalsByMetric.get(m.id) || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const vals = mEvals.map((e) => e.value);
            const computed = vals.length > 0 ? aggregateValues(vals, m.aggregation as any, m.metric_type as any) : null;
            const label = AGGREGATION_LABELS[m.aggregation] || "Best";
            const isAdding = addingMetric === m.id;
            const isExpanded = expandedMetrics.has(m.id);

            return (
              <div key={m.id} className="rounded-xl bg-muted/40 p-3 transition-colors hover:bg-muted/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {mEvals.length > 0 && (
                      <button onClick={() => toggleMetric(m.id)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    )}
                    <div className="min-w-0">
                      <span className="font-semibold text-sm">{m.name}</span>
                      {mEvals.length > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-1.5 font-medium">({label} of {mEvals.length})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {computed !== null && (
                      <span className="text-xl font-extrabold">{computed?.toFixed(1)} <span className="text-xs font-medium text-muted-foreground">{m.unit}</span></span>
                    )}
                    <button
                      onClick={() => { setAddingMetric(isAdding ? null : m.id); setAddValue(""); setTimeout(() => addInputRef.current?.focus(), 50); }}
                      className="rounded-lg p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Add score"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Add score inline */}
                {isAdding && (
                  <div className="flex items-center gap-2 mt-2 animate-fade-in">
                    <Input ref={addInputRef} type="number" inputMode="decimal" value={addValue} onChange={(e) => setAddValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddEval(m.id); if (e.key === "Escape") setAddingMetric(null); }} placeholder={m.unit} className="h-9 w-24 text-center font-bold rounded-lg" />
                    <Button size="sm" disabled={!addValue || savingEval} onClick={() => handleAddEval(m.id)} className="h-9 rounded-lg gradient-primary border-0"><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingMetric(null)} className="h-9 rounded-lg"><X className="h-4 w-4" /></Button>
                  </div>
                )}

                {mEvals.length === 0 && !isAdding && <p className="text-xs text-muted-foreground mt-1">No scores yet</p>}

                {/* Expandable score history */}
                {isExpanded && mEvals.length > 0 && (
                  <div className="mt-2 space-y-1 animate-fade-in border-t border-border/50 pt-2">
                    {mEvals.map((e) => {
                      const c = getCoach(e.coach_id);
                      const sessInfo = e.session_id ? sessionMap.get(e.session_id) : null;
                      const dateStr = format(new Date(e.created_at), "MMM d, yyyy");
                      return (
                        <div key={e.id} className="flex items-center gap-2 text-xs">
                          {renderEvalChip(e)}
                          <span className="text-muted-foreground">{dateStr}</span>
                          {sessInfo && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 font-medium">{sessInfo.name}</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}


          {metrics.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No metrics configured</p>}
        </CardContent>
      </Card>

      {/* External Evaluations */}
      {externalEntries.length > 0 && (
        <Card className="section-card mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Award className="h-5 w-5 text-accent" /> External Evaluations
            </CardTitle>
            <p className="text-xs text-muted-foreground">Scores from verified evaluators & showcases</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {externalEntries.map((entry) => (
              <div key={entry.id} className="rounded-xl bg-muted/40 p-3 transition-colors hover:bg-muted/60">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="font-semibold text-sm">{entry.metric_name}</span>
                    {entry.metric_unit && <span className="text-xs text-muted-foreground ml-1">({entry.metric_unit})</span>}
                  </div>
                  <span className="text-lg font-extrabold">{Number(entry.metric_value).toFixed(1)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {entry.evaluator && (
                    <Link to={`/evaluator/${entry.evaluator.id}`}>
                      <Badge variant="outline" className="text-[10px] gap-1 border-accent/30 text-accent font-medium px-1.5 py-0 hover:bg-accent/10 transition-colors cursor-pointer">
                        <Award className="h-2.5 w-2.5" />
                        {entry.evaluator.full_name}{entry.evaluator.organization_name ? `, ${entry.evaluator.organization_name}` : ""}
                      </Badge>
                    </Link>
                  )}
                  {(entry.event_name || entry.event_date) && (
                    <span className="text-[10px] text-muted-foreground">
                      {entry.event_name}{entry.event_date ? ` • ${format(new Date(entry.event_date + "T00:00:00"), "MMM d, yyyy")}` : ""}
                    </span>
                  )}
                </div>
                {entry.notes && <p className="text-xs text-muted-foreground mt-1 italic">{entry.notes}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card className="section-card mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-lg font-bold flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {notes.map((n) => {
            const c = getCoach(n.coach_id);
            return (
              <div key={n.id} className="rounded-xl border p-3.5 transition-colors hover:bg-muted/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold" style={{ color: c?.color }}>{c?.full_name}</span>
                  <div className="flex items-center gap-1.5">
                    {n.flag === "standout" && <Star className="h-3.5 w-3.5 text-secondary fill-secondary" />}
                    {n.flag === "concern" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    {n.flag === "needs_second_look" && <Eye className="h-3.5 w-3.5 text-primary" />}
                    <span className="text-[10px] text-muted-foreground font-medium">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed">{n.content}</p>
              </div>
            );
          })}

          {/* Add note */}
          <div className="space-y-3 pt-3 border-t">
            <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="tap-target rounded-xl" />
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {["standout", "needs_second_look", "concern"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setNewFlag(newFlag === f ? "" : f)}
                    className={cn(
                      "rounded-xl px-2.5 py-1.5 text-xs font-semibold border-2 transition-all duration-200",
                      newFlag === f ? "border-primary bg-primary/10 scale-105" : "border-transparent hover:bg-muted"
                    )}
                  >
                    {f === "standout" && <Star className="h-3 w-3 inline mr-1 text-secondary fill-secondary" />}
                    {f === "concern" && <AlertTriangle className="h-3 w-3 inline mr-1 text-destructive" />}
                    {f === "needs_second_look" && <Eye className="h-3 w-3 inline mr-1 text-primary" />}
                    {f.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={addNote} disabled={!newNote.trim()} className="tap-target rounded-xl gradient-primary border-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact info */}
      {(player.emergency_contact_name || player.medical_notes) && (
        <Card className="section-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <HeartPulse className="h-5 w-5" /> Contact & Medical
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {player.emergency_contact_name && (
              <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-semibold">{player.emergency_contact_name}</p>
                  {player.emergency_contact_phone && <p className="text-muted-foreground">{player.emergency_contact_phone}</p>}
                </div>
              </div>
            )}
            {player.medical_notes && (
              <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-3">
                <p className="text-xs font-bold text-destructive mb-1">Medical Notes</p>
                <p className="text-sm">{player.medical_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
