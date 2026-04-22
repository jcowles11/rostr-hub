/**
 * PracticePlanDetail — View and edit time blocks for a single practice plan.
 * Route: /practice/:id
 *
 * Inline block creation + editing. Blocks are saved individually (no batch).
 * Print button links to /practice/:id/print.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCoachesWithColor } from "@/services/coachService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, Printer, Clock, Users, Edit2, Check,
  X, GripVertical, CalendarDays, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fetchPracticePlan,
  fetchPracticeBlocks,
  createPracticeBlock,
  updatePracticeBlock,
  deletePracticeBlock,
  updatePracticePlan,
  type PracticePlan,
  type PracticeBlockWithCoach,
} from "@/services/practiceService";

// ── Types ──────────────────────────────────────────────────────────

interface Coach {
  id: string;
  full_name: string;
  color: string;
}

interface LocalBlock {
  id: string | null; // null = new unsaved block
  start_time: string;
  end_time: string;
  activity_name: string;
  player_group: string;
  assigned_coach_id: string;
  notes: string;
  sort_order: number;
}

// ── Helpers ────────────────────────────────────────────────────────

function formatTime(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function blockDuration(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// ── Main Component ────────────────────────────────────────────────

export default function PracticePlanDetail() {
  const { id: planId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { coach } = useAuth();
  const programId = coach?.program_id;

  const [plan, setPlan] = useState<PracticePlan | null>(null);
  const [blocks, setBlocks] = useState<PracticeBlockWithCoach[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit header state
  const [editingHeader, setEditingHeader] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editShared, setEditShared] = useState(false);

  // Add block state
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlock, setNewBlock] = useState<LocalBlock>({
    id: null, start_time: "", end_time: "", activity_name: "",
    player_group: "", assigned_coach_id: "", notes: "", sort_order: 0,
  });
  const [saving, setSaving] = useState(false);

  // Inline edit
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editBlock, setEditBlock] = useState<LocalBlock | null>(null);

  const levels: string[] = coach?.program_levels ?? [];

  // ── Data Loading ──────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!planId || !programId) return;
    const [planRes, blocksRes] = await Promise.all([
      fetchPracticePlan(planId),
      fetchPracticeBlocks(planId),
    ]);
    if (planRes.error || !planRes.data) {
      toast.error("Practice plan not found");
      navigate("/practices");
      return;
    }
    setPlan(planRes.data);
    setBlocks(blocksRes.data);

    // Load coaches for assignment dropdown
    const { data: coachRows } = await fetchCoachesWithColor(programId);
    setCoaches(coachRows);
    setLoading(false);
  }, [planId, programId, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Header Edit ───────────────────────────────────────────────

  const startEditHeader = () => {
    if (!plan) return;
    setEditTitle(plan.title);
    setEditNotes(plan.notes || "");
    setEditShared(plan.shared_with_players);
    setEditingHeader(true);
  };

  const saveHeader = async () => {
    if (!plan) return;
    const { data, error } = await updatePracticePlan(plan.id, {
      title: editTitle || "Practice",
      notes: editNotes || null,
      shared_with_players: editShared,
    });
    if (error) { toast.error("Failed to update"); return; }
    setPlan(data);
    setEditingHeader(false);
    toast.success("Plan updated");
  };

  // ── Add Block ─────────────────────────────────────────────────

  const lastBlock = blocks[blocks.length - 1];
  const suggestedStart = lastBlock?.end_time || "15:00";

  const openAddBlock = () => {
    setNewBlock({
      id: null,
      start_time: suggestedStart,
      end_time: "",
      activity_name: "",
      player_group: "",
      assigned_coach_id: "",
      notes: "",
      sort_order: blocks.length,
    });
    setShowAddBlock(true);
  };

  const handleSaveNewBlock = async () => {
    if (!planId || !newBlock.activity_name.trim() || !newBlock.start_time || !newBlock.end_time) {
      toast.error("Activity name, start time, and end time are required");
      return;
    }
    setSaving(true);
    const { error } = await createPracticeBlock({
      practice_plan_id: planId,
      start_time: newBlock.start_time,
      end_time: newBlock.end_time,
      activity_name: newBlock.activity_name,
      player_group: newBlock.player_group || null,
      assigned_coach_id: newBlock.assigned_coach_id || null,
      notes: newBlock.notes || null,
      sort_order: newBlock.sort_order,
    });
    setSaving(false);
    if (error) { toast.error("Failed to add block"); return; }
    toast.success("Block added");
    setShowAddBlock(false);
    // Reload blocks
    const { data } = await fetchPracticeBlocks(planId);
    setBlocks(data);
  };

  // ── Edit Block ────────────────────────────────────────────────

  const startEditBlock = (block: PracticeBlockWithCoach) => {
    setEditingBlockId(block.id);
    setEditBlock({
      id: block.id,
      start_time: block.start_time,
      end_time: block.end_time,
      activity_name: block.activity_name,
      player_group: block.player_group || "",
      assigned_coach_id: block.assigned_coach_id || "",
      notes: block.notes || "",
      sort_order: block.sort_order,
    });
  };

  const saveEditBlock = async () => {
    if (!editBlock?.id || !editBlock.activity_name.trim()) return;
    const { error } = await updatePracticeBlock(editBlock.id, {
      start_time: editBlock.start_time,
      end_time: editBlock.end_time,
      activity_name: editBlock.activity_name,
      player_group: editBlock.player_group || null,
      assigned_coach_id: editBlock.assigned_coach_id || null,
      notes: editBlock.notes || null,
    });
    if (error) { toast.error("Failed to update"); return; }
    setEditingBlockId(null);
    setEditBlock(null);
    const { data } = await fetchPracticeBlocks(planId!);
    setBlocks(data);
    toast.success("Block updated");
  };

  const handleDeleteBlock = async (blockId: string) => {
    const { error } = await deletePracticeBlock(blockId);
    if (error) { toast.error("Failed to delete"); return; }
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    toast.success("Block removed");
  };

  // ── Group concurrent blocks by time slot ──────────────────────

  const timeSlots = useMemo(() => {
    const slots = new Map<string, PracticeBlockWithCoach[]>();
    for (const block of blocks) {
      const key = `${block.start_time}-${block.end_time}`;
      const arr = slots.get(key) || [];
      arr.push(block);
      slots.set(key, arr);
    }
    return [...slots.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [blocks]);

  const totalMinutes = useMemo(() => {
    if (blocks.length === 0) return 0;
    const starts = blocks.map((b) => b.start_time).sort();
    const ends = blocks.map((b) => b.end_time).sort();
    return blockDuration(starts[0], ends[ends.length - 1]);
  }, [blocks]);

  // ── Render ────────────────────────────────────────────────────

  if (loading || !plan) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-4 animate-pulse">
        <div className="h-7 w-56 bg-muted rounded-lg" />
        <div className="h-4 w-40 bg-muted rounded" />
        <div className="space-y-3 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const formatDate = (d: string) => {
    const date = new Date(d + "T12:00:00");
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => navigate("/practices")}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[20px] font-extrabold tracking-tight leading-tight truncate">{plan.title}</h1>
          <p className="text-[11px] text-muted-foreground truncate">
            {formatDate(plan.practice_date)}
            {plan.team_level && ` · ${plan.team_level}`}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => navigate(`/practice/${planId}/print`)}
            aria-label="Print"
          >
            <Printer className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={startEditHeader}
            aria-label="Edit"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Plan notes / shared status */}
      {(plan.notes || plan.shared_with_players) && (
        <Card className="section-card mb-4">
          <CardContent className="py-3">
            {plan.notes && <p className="text-sm text-muted-foreground">{plan.notes}</p>}
            {plan.shared_with_players && (
              <div className="flex items-center gap-1.5 mt-1">
                <Share2 className="h-3 w-3 text-accent" />
                <span className="text-[10px] text-accent font-medium">Shared with players</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {blocks.length} block{blocks.length !== 1 ? "s" : ""}
        </span>
        {totalMinutes > 0 && (
          <span>{totalMinutes} min total</span>
        )}
        {coaches.length > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {coaches.length} coach{coaches.length !== 1 ? "es" : ""}
          </span>
        )}
      </div>

      {/* Time blocks */}
      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-6 text-center mb-4">
          <div>
            <Clock className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="font-bold text-sm mb-1">No blocks yet</p>
            <p className="text-sm text-muted-foreground mb-3">Add your first activity to this practice plan.</p>
            <Button size="sm" onClick={openAddBlock}>
              <Plus className="h-4 w-4 mr-1" /> Add Block
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1 mb-4">
          {timeSlots.map(([timeKey, slotBlocks]) => {
            const [start, end] = timeKey.split("-");
            const dur = blockDuration(start, end);
            const concurrent = slotBlocks.length > 1;

            return (
              <div key={timeKey} className="flex gap-2">
                {/* Time column */}
                <div className="w-20 shrink-0 pt-3 text-right">
                  <p className="text-xs font-bold tabular-nums">{formatTime(start)}</p>
                  <p className="text-[10px] text-muted-foreground">{dur} min</p>
                </div>

                {/* Block cards */}
                <div className={cn("flex-1", concurrent && "grid grid-cols-2 gap-1.5")}>
                  {slotBlocks.map((block) => {
                    const isEditing = editingBlockId === block.id;

                    if (isEditing && editBlock) {
                      return (
                        <Card key={block.id} className="section-card border-primary/30">
                          <CardContent className="p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Input type="time" value={editBlock.start_time} onChange={(e) => setEditBlock({ ...editBlock, start_time: e.target.value })} className="h-8 text-xs" />
                              <Input type="time" value={editBlock.end_time} onChange={(e) => setEditBlock({ ...editBlock, end_time: e.target.value })} className="h-8 text-xs" />
                            </div>
                            <Input value={editBlock.activity_name} onChange={(e) => setEditBlock({ ...editBlock, activity_name: e.target.value })} placeholder="Activity" className="h-8 text-xs" />
                            <div className="grid grid-cols-2 gap-2">
                              <Input value={editBlock.player_group} onChange={(e) => setEditBlock({ ...editBlock, player_group: e.target.value })} placeholder="Group (optional)" className="h-8 text-xs" />
                              <Select value={editBlock.assigned_coach_id || "__none__"} onValueChange={(v) => setEditBlock({ ...editBlock, assigned_coach_id: v === "__none__" ? "" : v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Coach" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">No coach</SelectItem>
                                  {coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex gap-1.5">
                              <Button size="sm" className="h-7 text-xs flex-1" onClick={saveEditBlock}><Check className="h-3 w-3 mr-1" /> Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingBlockId(null); setEditBlock(null); }}><X className="h-3 w-3" /></Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    return (
                      <Card
                        key={block.id}
                        className="section-card cursor-pointer hover:border-primary/20 transition-all"
                        onClick={() => startEditBlock(block)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm">{block.activity_name}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {block.player_group && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{block.player_group}</Badge>
                                )}
                                {block.coach_name && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    {block.coach_color && (
                                      <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: block.coach_color }} />
                                    )}
                                    {block.coach_name}
                                  </span>
                                )}
                              </div>
                              {block.notes && (
                                <p className="text-[10px] text-muted-foreground mt-1 truncate">{block.notes}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Block Button */}
      {!showAddBlock ? (
        <Button variant="outline" className="w-full" onClick={openAddBlock}>
          <Plus className="h-4 w-4 mr-1" /> Add Block
        </Button>
      ) : (
        <Card className="section-card border-primary/30 mb-4">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-bold">New Block</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">Start</label>
                <Input
                  type="time"
                  value={newBlock.start_time}
                  onChange={(e) => setNewBlock({ ...newBlock, start_time: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">End</label>
                <Input
                  type="time"
                  value={newBlock.end_time}
                  onChange={(e) => setNewBlock({ ...newBlock, end_time: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground">Activity</label>
              <Input
                value={newBlock.activity_name}
                onChange={(e) => setNewBlock({ ...newBlock, activity_name: e.target.value })}
                placeholder="e.g. BP Rotations, IF Defense, Stretch"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">Group (optional)</label>
                <Input
                  value={newBlock.player_group}
                  onChange={(e) => setNewBlock({ ...newBlock, player_group: e.target.value })}
                  placeholder="IF, OF, Catchers..."
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">Coach (optional)</label>
                <Select
                  value={newBlock.assigned_coach_id || "__none__"}
                  onValueChange={(v) => setNewBlock({ ...newBlock, assigned_coach_id: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Coach" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No coach</SelectItem>
                    {coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" className="flex-1" disabled={saving || !newBlock.activity_name.trim()} onClick={handleSaveNewBlock}>
                {saving ? "Saving..." : "Add Block"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddBlock(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Header Dialog */}
      {editingHeader && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingHeader(false)}>
          <Card className="section-card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle className="text-base">Edit Plan</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="min-h-[60px]" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editShared} onChange={(e) => setEditShared(e.target.checked)} className="rounded" />
                Share with players
              </label>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={saveHeader}>Save</Button>
                <Button variant="outline" onClick={() => setEditingHeader(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
