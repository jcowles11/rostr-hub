/**
 * PracticePlanner — List all practice plans + create new ones.
 * Route: /practices
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarDays, Plus, ClipboardList, Trash2, ChevronRight, Users, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fetchPracticePlans,
  createPracticePlan,
  deletePracticePlan,
  type PracticePlan,
} from "@/services/practiceService";

export default function PracticePlanner() {
  const { currentProgram, user, coachInfo } = useAuth();
  const navigate = useNavigate();
  const programId = currentProgram?.id;
  const isHead = coachInfo?.role === "head_coach";

  const [plans, setPlans] = useState<PracticePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newTitle, setNewTitle] = useState("Practice");
  const [newLevel, setNewLevel] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const levels: string[] = currentProgram?.levels ?? [];

  const loadPlans = useCallback(async () => {
    if (!programId) return;
    const { data, error } = await fetchPracticePlans(programId);
    if (error) toast.error("Failed to load practice plans");
    setPlans(data);
    setLoading(false);
  }, [programId]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const handleCreate = async () => {
    if (!programId || !newDate) return;
    setCreating(true);
    const { data, error } = await createPracticePlan({
      program_id: programId,
      practice_date: newDate,
      title: newTitle || "Practice",
      team_level: newLevel || null,
      notes: newNotes || null,
      created_by: user?.id,
    });
    setCreating(false);
    if (error || !data) {
      toast.error(error || "Failed to create plan");
      return;
    }
    toast.success("Practice plan created");
    setShowCreate(false);
    setNewTitle("Practice");
    setNewLevel("");
    setNewNotes("");
    navigate(`/practice/${data.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, planId: string) => {
    e.stopPropagation();
    if (!window.confirm("Delete this practice plan and all its blocks?")) return;
    const { error } = await deletePracticePlan(planId);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Practice plan deleted");
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  // Group plans by upcoming vs past
  const today = new Date().toISOString().split("T")[0];
  const upcoming = plans.filter((p) => p.practice_date >= today);
  const past = plans.filter((p) => p.practice_date < today);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-24">
      <div className="page-hero mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-white/80" />
            <div>
              <h1 className="text-xl font-extrabold text-white">Practice Plans</h1>
              <p className="text-sm text-white/70">
                {plans.length} plan{plans.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-white/20 text-white border-0 hover:bg-white/30"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> New Plan
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : plans.length === 0 ? (
        <Card className="section-card">
          <CardContent className="py-16 text-center">
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="text-lg font-bold mb-1">No Practice Plans Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first practice plan to start organizing team sessions.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Create Practice Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Upcoming
              </h2>
              <div className="space-y-2">
                {upcoming.reverse().map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isHead={isHead}
                    onDelete={handleDelete}
                    onClick={() => navigate(`/practice/${plan.id}`)}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            </div>
          )}
          {/* Past */}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Past
              </h2>
              <div className="space-y-2">
                {past.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isHead={isHead}
                    onDelete={handleDelete}
                    onClick={() => navigate(`/practice/${plan.id}`)}
                    formatDate={formatDate}
                    dimmed
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">New Practice Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Practice" />
            </div>
            {levels.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Team Level</label>
                <Select value={newLevel} onValueChange={setNewLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="All levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All levels</SelectItem>
                    {levels.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Focus areas, weather notes, etc." className="min-h-[60px]" />
            </div>
            <Button className="w-full" disabled={!newDate || creating} onClick={handleCreate}>
              {creating ? "Creating..." : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Plan Card ──────────────────────────────────────────────────────

function PlanCard({
  plan,
  isHead,
  onDelete,
  onClick,
  formatDate,
  dimmed,
}: {
  plan: PracticePlan;
  isHead: boolean;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onClick: () => void;
  formatDate: (d: string) => string;
  dimmed?: boolean;
}) {
  return (
    <Card
      className={cn(
        "section-card cursor-pointer transition-all hover:shadow-md hover:border-primary/20",
        dimmed && "opacity-60"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm truncate">{plan.title}</h3>
            {plan.team_level && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{plan.team_level}</Badge>
            )}
            {plan.shared_with_players && (
              <Share2 className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{formatDate(plan.practice_date)}</p>
          {plan.notes && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{plan.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isHead && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => onDelete(e, plan.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
