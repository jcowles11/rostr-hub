"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Bell,
  Play,
  Clock,
  ChevronLeft,
  ChevronRight,
  Zap,
  Plus,
  X,
  MapPin,
  Box,
  Trees,
  Building,
  Swords,
  ArrowRight,
  ClipboardList,
  Calendar,
  Copy,
  Trash2,
  Loader2,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { SavedPill } from "@/components/atoms/saved-pill";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { cn } from "@/lib/utils";
import { comingSoon } from "@/lib/coming-soon";
import {
  addBlockAction,
  addCustomDrillAction,
  applyAIPracticePlanAction,
  createPlanAction,
  deletePlanAction,
  duplicatePlanAction,
  generatePracticePlanAction,
  recordAIPlanFeedbackAction,
  removeBlockAction,
  reorderBlocksAction,
  updateBlockAction,
  updatePlanAction,
  type ApplyAIPracticePlanMode,
} from "./actions";
import type {
  FieldConstraint,
  PlanCategory,
  PlanLane,
  PracticeDrill,
  PracticePlan,
  PracticePlanWithBlocks,
} from "@/lib/services/practice-plans";
import type { AIPlanProposalBlock } from "@/lib/services/ai-coach";

/**
 * /app/practice — Practice planner (client editor).
 *
 * The full UI from the previous client-only build, now backed by server
 * actions. Optimistic updates keep the rhythm snappy; useTransition +
 * router.refresh() pull authoritative state after each mutation.
 *
 * Layout intentionally preserved from the previous build — no redesign.
 */

// ── Categories (mirrors PlanCategory in service layer) ──────

const CATEGORY_LABEL: Record<PlanCategory, string> = {
  hit: "Hitting",
  def: "Defense",
  bases: "Baserunning",
  pitch: "Pitching",
  cond: "Conditioning",
  warm: "Warm-up",
  cool: "Cool-down",
};

const CATEGORY_COLOR: Record<PlanCategory, { bg: string; text: string; border: string }> = {
  hit: { bg: "bg-red", text: "text-red", border: "border-l-red" },
  def: { bg: "bg-grass", text: "text-grass", border: "border-l-grass" },
  bases: { bg: "bg-amber", text: "text-amber", border: "border-l-amber" },
  pitch: { bg: "bg-sky", text: "text-sky", border: "border-l-sky" },
  cond: { bg: "bg-dirt", text: "text-dirt", border: "border-l-dirt" },
  warm: { bg: "bg-amber", text: "text-amber", border: "border-l-amber" },
  cool: { bg: "bg-dirt", text: "text-dirt", border: "border-l-dirt" },
};

const CAT_FILTERS: Array<{ value: PlanCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "hit", label: "Hitting" },
  { value: "def", label: "Defense" },
  { value: "pitch", label: "Pitching" },
  { value: "bases", label: "Baserunning" },
  { value: "cond", label: "Conditioning" },
];

// Field constraint options (UI label + AI hint copy preserved)

const FIELD_CONSTRAINTS: { value: FieldConstraint; label: string; icon: React.ReactNode; sub: string }[] = [
  { value: "full_field", label: "Full field", icon: <MapPin className="w-3.5 h-3.5" />, sub: "Mound, infield, outfield, cages — all yours." },
  { value: "cages_only", label: "Cages only", icon: <Box className="w-3.5 h-3.5" />, sub: "BP, tee work, machine reps. No live defense." },
  { value: "generic_grass", label: "Open grass", icon: <Trees className="w-3.5 h-3.5" />, sub: "Soccer field, park — no infield dirt or mound." },
  { value: "indoor_gym", label: "Indoor / gym", icon: <Building className="w-3.5 h-3.5" />, sub: "Conditioning, dry-line work, walk-throughs." },
  { value: "parking_lot", label: "Parking lot", icon: <MapPin className="w-3.5 h-3.5" />, sub: "Long toss, agility, speed work only." },
];

// ── Optimistic block model ──────────────────────────────────

/**
 * Optimistic actions applied to the local block list. Each one mirrors a
 * server-action it triggers; on error we toast and trust the next
 * router.refresh() to reconcile.
 */
type BlockAction =
  | { kind: "add"; tempId: string; category: PlanCategory; drillName: string; durationMin: number; lane: PlanLane; focusText: string | null; drillId: string | null }
  | { kind: "remove"; blockId: string }
  | { kind: "update"; blockId: string; durationMin?: number; lane?: PlanLane }
  | { kind: "reorder"; orderedIds: string[] }
  | { kind: "swap-temp-id"; tempId: string; realId: string };

interface UIBlock {
  id: string;
  sequence: number;
  lane: PlanLane;
  category: PlanCategory;
  drillName: string;
  focusText: string | null;
  durationMin: number;
}

function applyBlockAction(blocks: UIBlock[], action: BlockAction): UIBlock[] {
  switch (action.kind) {
    case "add":
      return [
        ...blocks,
        {
          id: action.tempId,
          sequence: blocks.length + 1,
          lane: action.lane,
          category: action.category,
          drillName: action.drillName,
          focusText: action.focusText,
          durationMin: action.durationMin,
        },
      ];
    case "remove":
      return blocks.filter((b) => b.id !== action.blockId);
    case "update":
      return blocks.map((b) =>
        b.id === action.blockId
          ? {
              ...b,
              ...(action.durationMin !== undefined ? { durationMin: action.durationMin } : {}),
              ...(action.lane !== undefined ? { lane: action.lane } : {}),
            }
          : b,
      );
    case "reorder": {
      const byId = new Map(blocks.map((b) => [b.id, b]));
      return action.orderedIds
        .map((id, i) => {
          const b = byId.get(id);
          return b ? { ...b, sequence: i + 1 } : null;
        })
        .filter((b): b is UIBlock => b !== null);
    }
    case "swap-temp-id":
      return blocks.map((b) => (b.id === action.tempId ? { ...b, id: action.realId } : b));
  }
}

// ── Editor ───────────────────────────────────────────────────

export interface PracticeEditorProps {
  programId: string;
  programName: string;
  programLevels: string[];
  today: string;
  activePlan: PracticePlanWithBlocks | null;
  recentPlans: PracticePlan[];
  drillLibrary: PracticeDrill[];
}

export function PracticeEditor({
  programName,
  programLevels,
  today,
  activePlan,
  recentPlans,
  drillLibrary,
}: PracticeEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isDemo = pathname?.startsWith("/demo") ?? false;
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [customDrillOpen, setCustomDrillOpen] = useState(false);

  // Save state for the SavedPill in the planner header. Flips
  // "saving" while a transition runs, then "saved" briefly after.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  useEffect(() => {
    if (isPending) {
      setSaveState("saving");
    } else if (saveState === "saving") {
      setSaveState("saved");
    }
    // saveState→"saved" self-clears via SavedPill's dwell timer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  // AI Assistant Coach state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProposal, setAiProposal] = useState<{
    summary: string | null;
    blocks: AIPlanProposalBlock[];
    /** Echoed back from generate action — sent to apply action for logging. */
    aiContext?: Record<string, unknown>;
    model?: string;
    tokensIn?: number;
    tokensOut?: number;
  } | null>(null);
  const [aiApplying, setAiApplying] = useState(false);
  /**
   * After a successful apply, the action returns generationId. We keep
   * it in state so the post-apply feedback bar can attach 👍/👎 to the
   * right log row. Cleared on rating submit or by closing the bar.
   */
  const [pendingFeedback, setPendingFeedback] = useState<{
    generationId: string;
    insertedCount: number;
    mode: ApplyAIPracticePlanMode;
  } | null>(null);

  // Server-authoritative blocks for the active plan
  const serverBlocks: UIBlock[] = useMemo(
    () =>
      (activePlan?.blocks ?? []).map((b) => ({
        id: b.id,
        sequence: b.sequence,
        lane: b.lane,
        category: b.category,
        drillName: b.drillName,
        focusText: b.focusText,
        durationMin: b.durationMin,
      })),
    [activePlan],
  );

  const [blocks, applyOptimistic] = useOptimistic(serverBlocks, applyBlockAction);

  // Field constraint persists to the plan
  const [fieldConstraint, setFieldConstraint] = useState<FieldConstraint>(
    activePlan?.fieldConstraint ?? "full_field",
  );
  useEffect(() => {
    setFieldConstraint(activePlan?.fieldConstraint ?? "full_field");
  }, [activePlan?.id, activePlan?.fieldConstraint]);

  // Persist constraint changes
  const onConstraintChange = (c: FieldConstraint) => {
    setFieldConstraint(c);
    if (!activePlan) return;
    startTransition(async () => {
      const r = await updatePlanAction({
        planId: activePlan.id,
        fieldConstraint: c,
      });
      if (r.error) toast.error("Couldn't save field constraint", { description: r.error });
    });
  };

  // ── Block actions wired to server ──────────────────────

  const addBlockFromDrill = (drill: { name: string; defaultDuration: number; focus: string | null; category: PlanCategory; id?: string | null }, lane: PlanLane = "main") => {
    if (!activePlan) {
      toast.error("Create a plan first");
      setCreateOpen(true);
      return;
    }
    const tempId = `tmp-${Date.now()}`;
    startTransition(async () => {
      applyOptimistic({
        kind: "add",
        tempId,
        category: drill.category,
        drillName: drill.name,
        durationMin: drill.defaultDuration,
        lane,
        focusText: drill.focus,
        drillId: drill.id ?? null,
      });
      const r = await addBlockAction({
        planId: activePlan.id,
        category: drill.category,
        drillName: drill.name,
        durationMin: drill.defaultDuration,
        lane,
        focusText: drill.focus,
        drillId: drill.id ?? null,
      });
      if (r.error) {
        toast.error("Couldn't add block", { description: r.error });
        return;
      }
      if (r.blockId) applyOptimistic({ kind: "swap-temp-id", tempId, realId: r.blockId });
      toast.success(`Added: ${drill.name}`, {
        description: lane === "secondary" ? "Runs in parallel with the previous main block." : undefined,
      });
      router.refresh();
    });
  };

  const removeBlock = (blockId: string) => {
    if (!activePlan) return;
    startTransition(async () => {
      applyOptimistic({ kind: "remove", blockId });
      const r = await removeBlockAction(blockId);
      if (r.error) toast.error("Couldn't remove", { description: r.error });
      router.refresh();
    });
  };

  const moveBlock = (blockId: string, dir: -1 | 1) => {
    if (!activePlan) return;
    const ids = blocks.map((b) => b.id);
    const idx = ids.indexOf(blockId);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= ids.length) return;
    const reordered = [...ids];
    [reordered[idx], reordered[next]] = [reordered[next], reordered[idx]];
    startTransition(async () => {
      applyOptimistic({ kind: "reorder", orderedIds: reordered });
      const r = await reorderBlocksAction(activePlan.id, reordered);
      if (r.error) toast.error("Couldn't reorder", { description: r.error });
      router.refresh();
    });
  };

  const updateDuration = (blockId: string, duration: number) => {
    if (!activePlan) return;
    const safe = Math.max(1, Math.min(180, duration));
    startTransition(async () => {
      applyOptimistic({ kind: "update", blockId, durationMin: safe });
      const r = await updateBlockAction({
        blockId,
        planId: activePlan.id,
        durationMin: safe,
      });
      if (r.error) toast.error("Couldn't save duration", { description: r.error });
      // Don't refresh on every keystroke — only when the user moves on
    });
  };

  const toggleLane = (blockId: string) => {
    if (!activePlan) return;
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    const newLane: PlanLane = block.lane === "main" ? "secondary" : "main";
    startTransition(async () => {
      applyOptimistic({ kind: "update", blockId, lane: newLane });
      const r = await updateBlockAction({
        blockId,
        planId: activePlan.id,
        lane: newLane,
      });
      if (r.error) toast.error("Couldn't toggle lane", { description: r.error });
      router.refresh();
    });
  };

  // ── AI Assistant Coach actions ──────────────────────────

  /**
   * Kick off plan generation. Doesn't mutate anything — opens the
   * proposal modal once Claude returns. Coach picks Append vs Replace.
   *
   * Defaults available time to current plan's main-lane sum (if any
   * blocks exist) or 90 minutes; can be changed in the proposal modal.
   */
  const generateAIPlan = (focus?: string) => {
    if (!activePlan) {
      toast.error("Create a plan first");
      setCreateOpen(true);
      return;
    }
    const defaultMinutes =
      blocks.filter((b) => b.lane === "main").reduce((s, b) => s + b.durationMin, 0) ||
      90;
    setAiLoading(true);
    (async () => {
      const r = await generatePracticePlanAction({
        planId: activePlan.id,
        fieldConstraint,
        availableMinutes: defaultMinutes,
        teamLevel: activePlan.teamLevel,
        focus: focus?.trim() || null,
      });
      setAiLoading(false);
      if (r.error) {
        // Demo mode: AI is intentionally disabled (see /lib/demo-guard
        // — no Anthropic call ever leaves the server). Surface the
        // friendlier "not available in demo" copy instead of leaking
        // the env-var hint that's only relevant to a real coach.
        if (isDemo && r.notConfigured) {
          toast.error("AI Assistant Coach isn't available in demo mode", {
            description: "Sign up free to use it on your real roster.",
          });
        } else {
          toast.error(
            r.notConfigured ? "AI Assistant Coach not configured" : "Couldn't draft plan",
            { description: r.error },
          );
        }
        return;
      }
      if (!r.blocks || r.blocks.length === 0) {
        toast.error("AI returned no blocks", { description: "Try again." });
        return;
      }
      setAiProposal({
        summary: r.summary ?? null,
        blocks: r.blocks,
        aiContext: r.aiContext,
        model: r.model,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
      });
    })();
  };

  const applyAIPlan = (mode: ApplyAIPracticePlanMode) => {
    if (!activePlan || !aiProposal) return;
    setAiApplying(true);
    (async () => {
      const r = await applyAIPracticePlanAction(
        activePlan.id,
        aiProposal.blocks,
        mode,
        aiProposal.aiContext,
        {
          model: aiProposal.model,
          tokensIn: aiProposal.tokensIn,
          tokensOut: aiProposal.tokensOut,
        },
      );
      setAiApplying(false);
      if (r.error) {
        toast.error("Couldn't apply plan", { description: r.error });
        return;
      }
      const insertedCount = r.insertedCount ?? aiProposal.blocks.length;
      toast.success(
        mode === "replace"
          ? `Replaced plan with ${insertedCount} AI blocks`
          : `Added ${insertedCount} AI blocks`,
      );
      // Surface the feedback bar only when logging succeeded — without
      // a generationId there's nothing to attach the rating to.
      if (r.generationId) {
        setPendingFeedback({ generationId: r.generationId, insertedCount, mode });
      }
      setAiProposal(null);
      router.refresh();
    })();
  };

  const submitFeedback = (rating: 1 | -1, note: string | null) => {
    if (!pendingFeedback) return;
    const generationId = pendingFeedback.generationId;
    // Optimistically dismiss the bar so the coach gets instant ack;
    // failure shows a toast and they can re-rate via a fresh apply.
    setPendingFeedback(null);
    (async () => {
      const r = await recordAIPlanFeedbackAction({
        generationId,
        rating,
        note: note?.trim() || null,
      });
      if (r.error) {
        toast.error("Couldn't save feedback", { description: r.error });
        return;
      }
      toast.success(rating === 1 ? "Thanks — noted as helpful" : "Thanks — noted");
    })();
  };

  // ── Plan actions ────────────────────────────────────────

  const switchPlan = (planId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("plan", planId);
    router.push(`/app/practice?${params.toString()}`);
  };

  const duplicateActive = () => {
    if (!activePlan) return;
    const next = prompt(
      "Duplicate to which date? (YYYY-MM-DD)",
      offsetDate(today, 1),
    );
    if (!next) return;
    startTransition(async () => {
      const r = await duplicatePlanAction(activePlan.id, next);
      if (r.error) {
        toast.error("Couldn't duplicate", { description: r.error });
        return;
      }
      toast.success("Duplicated");
      if (r.planId) switchPlan(r.planId);
      else router.refresh();
    });
  };

  const renameActive = () => {
    if (!activePlan) return;
    const next = prompt("Rename plan", activePlan.name);
    if (!next || next === activePlan.name) return;
    startTransition(async () => {
      const r = await updatePlanAction({ planId: activePlan.id, name: next });
      if (r.error) {
        toast.error("Couldn't rename", { description: r.error });
        return;
      }
      router.refresh();
    });
  };

  const deleteActive = () => {
    if (!activePlan) return;
    if (!confirm(`Delete "${activePlan.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      const r = await deletePlanAction(activePlan.id);
      if (r.error) {
        toast.error("Couldn't delete", { description: r.error });
        return;
      }
      toast.success("Plan deleted");
      router.push("/app/practice");
    });
  };

  // ── Render ──────────────────────────────────────────────

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: programName },
          { label: "Practice" },
          { label: activePlan?.name ?? "Plans" },
        ]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" />, onClick: () => comingSoon("Notifications") },
          {
            kind: "ghost",
            label: "Duplicate",
            onClick: duplicateActive,
          },
          {
            kind: "ghost",
            label: "Rename",
            onClick: renameActive,
          },
          {
            kind: "primary",
            label: "Publish to team",
            onClick: () =>
              comingSoon("Publish to team", "Player + parent broadcast — next sprint."),
          },
        ]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="max-w-layout-app mx-auto">
          <PageHeader
            activePlan={activePlan}
            recentPlans={recentPlans}
            today={today}
            onSwitch={switchPlan}
            onCreate={() => setCreateOpen(true)}
            onDelete={deleteActive}
            isPending={isPending}
          />
          <SubsystemSwitcher />

          {!activePlan ? (
            <EmptyState onCreate={() => setCreateOpen(true)} today={today} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-5 mt-6">
              <DrillLibraryPanel
                drills={drillLibrary}
                onAdd={(d, lane) =>
                  addBlockFromDrill(
                    {
                      id: d.id,
                      name: d.name,
                      defaultDuration: d.defaultDuration,
                      focus: d.focus,
                      category: d.category,
                    },
                    lane,
                  )
                }
                onAddCustom={() => setCustomDrillOpen(true)}
              />
              <PlanColumn
                planName={activePlan.name}
                planDate={activePlan.planDate}
                blocks={blocks}
                saveState={saveState}
                onRemove={removeBlock}
                onMove={moveBlock}
                onUpdateDuration={updateDuration}
                onToggleLane={toggleLane}
              />
              <RightColumn
                fieldConstraint={fieldConstraint}
                onFieldConstraintChange={onConstraintChange}
                blocks={blocks}
                onGenerateAI={generateAIPlan}
                aiLoading={aiLoading}
              />
            </div>
          )}
        </div>
      </div>

      <CreatePlanModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDate={today}
        programLevels={programLevels}
      />

      <CustomDrillModal
        open={customDrillOpen}
        onOpenChange={setCustomDrillOpen}
      />

      <AIProposalModal
        proposal={aiProposal}
        applying={aiApplying}
        existingBlockCount={blocks.length}
        onClose={() => setAiProposal(null)}
        onApply={applyAIPlan}
      />

      <AIFeedbackModal
        pending={pendingFeedback}
        onClose={() => setPendingFeedback(null)}
        onSubmit={submitFeedback}
      />
    </>
  );
}

// ── Page header (plan picker + actions) ─────────────────────

function PageHeader({
  activePlan,
  recentPlans,
  today,
  onSwitch,
  onCreate,
  onDelete,
  isPending,
}: {
  activePlan: PracticePlanWithBlocks | null;
  recentPlans: PracticePlan[];
  today: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  // Sibling-day navigation: prev/next plans in the recent list (sorted desc)
  const idx = activePlan
    ? recentPlans.findIndex((p) => p.id === activePlan.id)
    : -1;
  const newer = idx > 0 ? recentPlans[idx - 1] : null;
  const older = idx >= 0 && idx < recentPlans.length - 1 ? recentPlans[idx + 1] : null;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex-1 min-w-[260px]">
        <h1 className="font-display text-[28px] sm:text-[32px] font-semibold tracking-[-0.03em] leading-[1.1]">
          {activePlan ? activePlan.name : "Practice planner"}
        </h1>
        <div className="text-[12.5px] text-ink-3 mt-1 flex items-center gap-2 flex-wrap">
          {activePlan ? (
            <>
              <span className="font-mono">
                {new Date(activePlan.planDate + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <span className="text-ink-4">·</span>
              <PlanPicker
                recentPlans={recentPlans}
                activeId={activePlan.id}
                onSwitch={onSwitch}
                onCreate={onCreate}
                today={today}
              />
              {isPending && (
                <>
                  <span className="text-ink-4">·</span>
                  <span className="text-[11px] text-red font-semibold animate-pulse">saving…</span>
                </>
              )}
            </>
          ) : (
            <span>No plan loaded. Pick one below or create a new one.</span>
          )}
        </div>
      </div>
      <div className="flex gap-1.5">
        {older && (
          <Button variant="secondary" size="sm" onClick={() => onSwitch(older.id)}>
            <ChevronLeft className="w-3.5 h-3.5" />
            {new Date(older.planDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </Button>
        )}
        {newer && (
          <Button variant="secondary" size="sm" onClick={() => onSwitch(newer.id)}>
            {new Date(newer.planDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        )}
        {activePlan && (
          <Button variant="secondary" size="sm" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function PlanPicker({
  recentPlans,
  activeId,
  onSwitch,
  onCreate,
  today: _today,
}: {
  recentPlans: PracticePlan[];
  activeId: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  today: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <Calendar className="w-3 h-3 text-ink-3" />
      <select
        value={activeId}
        onChange={(e) => {
          if (e.target.value === "__new") onCreate();
          else onSwitch(e.target.value);
        }}
        className="bg-transparent text-[12px] font-semibold text-ink outline-none cursor-pointer hover:text-red"
      >
        {recentPlans.map((p) => (
          <option key={p.id} value={p.id}>
            {new Date(p.planDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {p.name}
          </option>
        ))}
        <option value="__new">+ New plan…</option>
      </select>
    </div>
  );
}

function EmptyState({ onCreate, today }: { onCreate: () => void; today: string }) {
  return (
    <div className="mt-6 p-10 bg-card border border-dashed border-hair rounded-lg text-center">
      <div className="inline-flex w-12 h-12 rounded-full bg-red-soft text-red items-center justify-center mb-3">
        <ClipboardList className="w-6 h-6" />
      </div>
      <h2 className="font-display text-[20px] font-semibold tracking-tight">
        No practice plan yet
      </h2>
      <p className="text-[13px] text-ink-3 mt-2 max-w-[440px] mx-auto leading-relaxed">
        Create a plan for{" "}
        <b className="text-ink">
          {new Date(today + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </b>{" "}
        — or any date — and add blocks from your drill library. Plans save
        automatically and stick around across reloads.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 bg-red hover:bg-red/90 text-white rounded-sm text-[13px] font-bold"
      >
        <Plus className="w-4 h-4" />
        Create today&apos;s plan
      </button>
    </div>
  );
}

// ── Subsystem switcher (links to live ABs + intrasquad) ──────

function SubsystemSwitcher() {
  return (
    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-card border-2 border-red rounded-md p-3 flex items-center gap-3">
        <span className="w-8 h-8 rounded-md bg-red text-white flex items-center justify-center shrink-0">
          <ClipboardList className="w-4 h-4" />
        </span>
        <div className="flex-1">
          <div className="text-[12.5px] font-display font-semibold tracking-tight">
            Practice plans
          </div>
          <div className="text-[10.5px] text-ink-3 mt-0.5">You&apos;re here</div>
        </div>
      </div>
      <Link
        href="/app/practice/live-abs"
        className="bg-card border-2 border-red/40 rounded-md p-3 flex items-center gap-3 hover:border-red transition-colors"
      >
        <span className="w-8 h-8 rounded-md bg-red text-white flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4" />
        </span>
        <div className="flex-1">
          <div className="text-[12.5px] font-display font-semibold tracking-tight flex items-center gap-1.5">
            Live at-bats
            <ArrowRight className="w-3 h-3 text-red" />
          </div>
          <div className="text-[10.5px] text-ink-3 mt-0.5">
            Indoor cage · pitch-by-pitch · roster data
          </div>
        </div>
      </Link>
      <Link
        href="/app/practice/intrasquad"
        className="bg-card border-2 border-red/40 rounded-md p-3 flex items-center gap-3 hover:border-red transition-colors"
      >
        <span className="w-8 h-8 rounded-md bg-red text-white flex items-center justify-center shrink-0">
          <Swords className="w-4 h-4" />
        </span>
        <div className="flex-1">
          <div className="text-[12.5px] font-display font-semibold tracking-tight flex items-center gap-1.5">
            Intrasquad scrimmage
            <ArrowRight className="w-3 h-3 text-red" />
          </div>
          <div className="text-[10.5px] text-ink-3 mt-0.5">
            Two-team builder · pitching rotation · base rules
          </div>
        </div>
      </Link>
    </div>
  );
}

// ── Drill library panel ─────────────────────────────────────

function DrillLibraryPanel({
  drills,
  onAdd,
  onAddCustom,
}: {
  drills: PracticeDrill[];
  onAdd: (drill: PracticeDrill, lane?: PlanLane) => void;
  onAddCustom: () => void;
}) {
  const [activeCat, setActiveCat] = useState<PlanCategory | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return drills.filter((d) => {
      if (activeCat !== "all" && d.category !== activeCat) return false;
      if (query.trim() && !`${d.name} ${d.focus ?? ""}`.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
  }, [drills, activeCat, query]);

  return (
    <div className="bg-card border border-hair rounded-lg self-start lg:sticky lg:top-[72px]">
      <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-2.5">
        <h3 className="font-display text-[14px] font-semibold tracking-tight">Drill library</h3>
        <span className="ml-auto font-mono text-[10.5px] text-ink-3 font-semibold">
          {filtered.length}/{drills.length}
        </span>
      </div>
      <div className="px-4 pt-3 pb-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search drills, focus…"
          icon={<Search className="w-3.5 h-3.5" />}
        />
      </div>
      <div className="flex gap-1 px-3.5 pb-2.5 flex-wrap">
        {CAT_FILTERS.map((c) => (
          <button
            key={c.value}
            onClick={() => setActiveCat(c.value)}
            className={cn(
              "px-2 py-1 rounded-full text-[10.5px] font-semibold transition-colors",
              activeCat === c.value ? "bg-ink text-white" : "bg-paper text-ink-2 hover:text-ink",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="pb-3 max-h-[calc(100vh-300px)] overflow-auto">
        {filtered.length === 0 && (
          <div className="px-4 py-6 text-[12px] text-ink-3 text-center">
            No drills match.
            <button
              onClick={onAddCustom}
              className="block mx-auto mt-2 text-red font-semibold hover:underline"
            >
              + Add custom drill
            </button>
          </div>
        )}
        {filtered.map((d) => (
          <div
            key={d.id}
            className="mx-2 mb-1 px-2.5 py-2 rounded-sm border border-transparent hover:bg-paper hover:border-hair transition-colors group"
          >
            <div className="flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", CATEGORY_COLOR[d.category].bg)} />
              <span className="text-[12.5px] font-semibold flex-1 leading-tight">{d.name}</span>
              <span className="font-mono text-[10.5px] text-ink-3 font-semibold">
                {d.defaultDuration}m
              </span>
              {d.source === "custom" && (
                <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-red">★</span>
              )}
            </div>
            {d.focus && (
              <div className="text-[10.5px] text-ink-3 mt-0.5 ml-[13px] leading-tight">
                {d.focus}
              </div>
            )}
            <div className="mt-1.5 ml-[13px] flex gap-1.5">
              <button
                onClick={() => onAdd(d, "main")}
                className="flex items-center gap-1 px-2 py-0.5 bg-red text-white rounded-xs text-[10px] font-bold uppercase tracking-[0.06em] hover:bg-red/90"
              >
                <Plus className="w-2.5 h-2.5" /> Add
              </button>
              <button
                onClick={() => onAdd(d, "secondary")}
                className="flex items-center gap-1 px-2 py-0.5 bg-paper border border-hair text-ink-2 rounded-xs text-[10px] font-bold uppercase tracking-[0.06em] hover:border-ink"
                title="Add as a parallel block (e.g. bullpen during BP)"
              >
                + Parallel
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={onAddCustom}
          className="mx-2 mt-2 mb-1 w-[calc(100%-1rem)] py-2 border border-dashed border-hair rounded-sm text-[11.5px] font-semibold text-ink-3 hover:border-ink hover:text-ink"
        >
          + Add custom drill
        </button>
      </div>
    </div>
  );
}

// ── Plan column ──────────────────────────────────────────────

function PlanColumn({
  planName,
  planDate,
  blocks,
  saveState,
  onRemove,
  onMove,
  onUpdateDuration,
  onToggleLane,
}: {
  planName: string;
  planDate: string;
  blocks: UIBlock[];
  saveState: "idle" | "saving" | "saved";
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onUpdateDuration: (id: string, duration: number) => void;
  onToggleLane: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5 min-w-0">
      <div className="bg-card border border-hair rounded-lg">
        <div className="p-5 border-b border-hair-2 flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="font-display text-[20px] font-semibold tracking-[-0.02em]">
              {planName}
            </div>
            <div className="font-mono text-[12.5px] text-ink-3 mt-0.5">
              {new Date(planDate + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
          {/* Live save indicator: flips Saving… → Saved → fades. Falls
              back to a steady "Auto-saves" hint when fully idle so the
              coach knows changes don't need a manual save button. */}
          {saveState === "idle" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-grass-dim text-grass text-[10px] font-bold uppercase tracking-[0.04em]">
              ● Auto-saves
            </span>
          ) : (
            <SavedPill state={saveState} />
          )}
        </div>

        <PlanTotals blocks={blocks} />
        <PlanTimeline blocks={blocks} />

        <div className="p-5 flex flex-col gap-2">
          {blocks.length === 0 ? (
            <div className="py-10 border-2 border-dashed border-hair rounded-md text-center text-[13px] text-ink-3">
              Empty plan. Click <b className="text-ink">Add</b> on any drill in
              the library to get started.
            </div>
          ) : (
            blocks.map((b, i) => (
              <BlockRow
                key={b.id}
                block={b}
                index={i}
                isFirst={i === 0}
                isLast={i === blocks.length - 1}
                onRemove={() => onRemove(b.id)}
                onMoveUp={() => onMove(b.id, -1)}
                onMoveDown={() => onMove(b.id, 1)}
                onUpdateDuration={(d) => onUpdateDuration(b.id, d)}
                onToggleLane={() => onToggleLane(b.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Plan totals (TIME-BY-CATEGORY, parallel-aware) ──────────

function PlanTotals({ blocks }: { blocks: UIBlock[] }) {
  const wallClock = blocks.filter((b) => b.lane === "main").reduce((s, b) => s + b.durationMin, 0);
  const byCategory = blocks.reduce((acc, b) => {
    acc[b.category] = (acc[b.category] ?? 0) + b.durationMin;
    return acc;
  }, {} as Record<PlanCategory, number>);

  const displayCats: PlanCategory[] = ["hit", "def", "bases", "pitch"];
  const otherTime =
    (byCategory.warm ?? 0) +
    (byCategory.cool ?? 0) +
    (byCategory.cond ?? 0);

  return (
    <div className="border-b border-hair-2">
      <div className="px-5 pt-4 pb-1 flex items-baseline gap-3">
        <div>
          <div className="type-label">Total practice</div>
          <div className="font-mono text-[28px] font-bold tracking-[-0.03em] leading-none mt-1">
            {Math.floor(wallClock / 60)}:{String(wallClock % 60).padStart(2, "0")}
            <span className="text-[14px] text-ink-3 ml-1.5 font-normal">hrs</span>
          </div>
        </div>
        <div className="text-[11.5px] text-ink-3 ml-2">
          Wall-clock duration. Parallel blocks (e.g. bullpen during BP) don&apos;t add to this.
        </div>
      </div>

      <div className="px-5 pt-3 pb-4 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {displayCats.map((c) => {
          const m = byCategory[c] ?? 0;
          const pct = wallClock > 0 ? Math.round((m / wallClock) * 100) : 0;
          return <CategoryCell key={c} category={c} minutes={m} pctOfWall={pct} />;
        })}
        <CategoryCell
          category="cond"
          minutes={otherTime}
          pctOfWall={wallClock > 0 ? Math.round((otherTime / wallClock) * 100) : 0}
          altLabel="Other"
        />
      </div>
    </div>
  );
}

function CategoryCell({
  category,
  minutes,
  pctOfWall,
  altLabel,
}: {
  category: PlanCategory;
  minutes: number;
  pctOfWall: number;
  altLabel?: string;
}) {
  const color = CATEGORY_COLOR[category];
  return (
    <div className="bg-paper rounded-md p-2.5">
      <div className="flex items-center gap-1.5">
        <span className={cn("w-1.5 h-1.5 rounded-full", color.bg)} />
        <span className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.06em]">
          {altLabel ?? CATEGORY_LABEL[category]}
        </span>
      </div>
      <div className="font-mono text-[18px] font-bold tracking-[-0.02em] mt-1 leading-none">
        {minutes}
        <span className="text-[10px] text-ink-3 ml-0.5 font-normal">m</span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-card overflow-hidden">
        <div
          className={cn("h-full", color.bg)}
          style={{ width: `${Math.min(100, pctOfWall)}%` }}
        />
      </div>
      <div className="text-[10px] text-ink-3 mt-1">
        {minutes > 0 ? `${pctOfWall}% of practice` : "—"}
      </div>
    </div>
  );
}

function PlanTimeline({ blocks }: { blocks: UIBlock[] }) {
  const mainBlocks = blocks.filter((b) => b.lane === "main");
  const totalMain = mainBlocks.reduce((s, b) => s + b.durationMin, 0);
  if (totalMain === 0) return null;

  return (
    <div className="px-5 py-4 border-b border-hair-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3 mb-1.5">
        Main-field timeline
      </div>
      <div className="flex h-9 rounded-md overflow-hidden">
        {mainBlocks.map((b) => (
          <div
            key={b.id}
            className={cn("flex items-center justify-center text-white text-[9.5px] font-semibold px-1 truncate", CATEGORY_COLOR[b.category].bg)}
            style={{ width: `${(b.durationMin / totalMain) * 100}%` }}
            title={`${CATEGORY_LABEL[b.category]} · ${b.durationMin}m`}
          >
            <span className="truncate">{CATEGORY_LABEL[b.category]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Block row ────────────────────────────────────────────

function BlockRow({
  block,
  index,
  isFirst,
  isLast,
  onRemove,
  onMoveUp,
  onMoveDown,
  onUpdateDuration,
  onToggleLane,
}: {
  block: UIBlock;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateDuration: (m: number) => void;
  onToggleLane: () => void;
}) {
  const c = CATEGORY_COLOR[block.category];
  return (
    <div className="flex gap-3">
      {/* Reorder rail. Each chevron is a 32px touch target (was ~12px) so
          a coach can move blocks accurately on a phone without zooming. */}
      <div className="shrink-0 w-10 flex flex-col items-center pt-1 gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className="w-8 h-8 inline-flex items-center justify-center text-ink-3 hover:text-ink hover:bg-paper rounded-sm disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Move up"
        >
          <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
        </button>
        <div className="font-mono text-[11px] text-ink-3">{index + 1}</div>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className="w-8 h-8 inline-flex items-center justify-center text-ink-3 hover:text-ink hover:bg-paper rounded-sm disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Move down"
        >
          <ChevronRight className="w-3.5 h-3.5 rotate-90" />
        </button>
      </div>
      <div
        className={cn(
          "flex-1 rounded-md p-3.5 border-l-[3px] border bg-paper border-hair",
          c.border,
          block.lane === "secondary" && "ring-1 ring-amber/30 bg-amber-soft/20",
        )}
      >
        <div className="flex items-start gap-2.5 flex-wrap">
          <span className={cn("type-label", c.text)}>
            {CATEGORY_LABEL[block.category]}
          </span>
          {block.lane === "secondary" && (
            <span className="inline-flex items-center px-1.5 py-0.5 bg-amber text-white rounded-xs text-[9px] font-bold tracking-[0.06em] uppercase">
              ⇉ Parallel
            </span>
          )}
          <span className="font-display text-[14.5px] font-semibold tracking-tight flex-1 min-w-[200px]">
            {block.drillName}
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={180}
              defaultValue={block.durationMin}
              onBlur={(e) => {
                const n = Math.max(1, parseInt(e.target.value, 10) || 0);
                if (n !== block.durationMin) onUpdateDuration(n);
              }}
              aria-label="Duration in minutes"
              className="w-14 h-8 bg-card border border-hair rounded-xs px-1.5 text-[13px] font-mono font-semibold text-center outline-none focus:border-red"
            />
            <span className="text-[11px] text-ink-3">min</span>
            <button
              type="button"
              onClick={onToggleLane}
              className="ml-1 w-8 h-8 inline-flex items-center justify-center text-ink-3 hover:text-ink hover:bg-card rounded-sm"
              title={block.lane === "main" ? "Make this a parallel block" : "Move back to main timeline"}
              aria-label={block.lane === "main" ? "Mark parallel" : "Mark main"}
            >
              <span className="text-[12px] font-bold leading-none">⇉</span>
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="w-8 h-8 inline-flex items-center justify-center text-ink-3 hover:text-red hover:bg-card rounded-sm"
              title="Remove block"
              aria-label="Remove block"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {block.focusText && (
          <div className="text-[11.5px] italic text-ink-3 mt-1">{block.focusText}</div>
        )}
        {(block.category === "hit" || block.category === "pitch") && (
          <Link
            href="/app/practice/live-abs"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-red hover:text-red/80"
          >
            <Zap className="w-3 h-3" />
            Track these {block.category === "hit" ? "hitters" : "pitchers"} live →
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Right column (AI + Field runner) ────────────────────────

function RightColumn({
  fieldConstraint,
  onFieldConstraintChange,
  blocks,
  onGenerateAI,
  aiLoading,
}: {
  fieldConstraint: FieldConstraint;
  onFieldConstraintChange: (c: FieldConstraint) => void;
  blocks: UIBlock[];
  onGenerateAI: (focus?: string) => void;
  aiLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 self-start lg:sticky lg:top-[72px]">
      <AICard
        fieldConstraint={fieldConstraint}
        onFieldConstraintChange={onFieldConstraintChange}
        onGenerate={onGenerateAI}
        loading={aiLoading}
      />
      <FieldRunnerCard nextBlock={blocks[0]} />
    </div>
  );
}

function AICard({
  fieldConstraint,
  onFieldConstraintChange,
  onGenerate,
  loading,
}: {
  fieldConstraint: FieldConstraint;
  onFieldConstraintChange: (c: FieldConstraint) => void;
  onGenerate: (focus?: string) => void;
  loading: boolean;
}) {
  const constraint = FIELD_CONSTRAINTS.find((f) => f.value === fieldConstraint)!;
  const [focus, setFocus] = useState("");

  return (
    <div className="relative overflow-hidden bg-ink text-white rounded-lg p-5">
      <div
        aria-hidden
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(200,58,58,.25), transparent 70%)" }}
      />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 text-[10px] text-red font-bold uppercase tracking-[0.12em]">
          <Sparkles className="w-3 h-3" />
          AI Assistant Coach
        </div>
        <h4 className="mt-1.5 font-display text-[16px] font-semibold tracking-tight leading-snug">
          Draft a practice for me.
        </h4>

        <div className="mt-3">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/60 mb-1.5">
            Where am I practicing?
          </div>
          <select
            value={fieldConstraint}
            onChange={(e) => onFieldConstraintChange(e.target.value as FieldConstraint)}
            disabled={loading}
            className="w-full bg-white/5 border border-white/10 rounded-sm px-2.5 py-1.5 text-[12px] font-semibold text-white outline-none focus:border-red [&>option]:bg-ink disabled:opacity-50"
          >
            {FIELD_CONSTRAINTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <div className="mt-1.5 text-[10.5px] text-white/55 leading-snug flex items-start gap-1.5">
            <span className="text-red mt-0.5">{constraint.icon}</span>
            <span>{constraint.sub}</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/60 mb-1.5">
            Tonight&apos;s focus (optional)
          </div>
          <input
            type="text"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            disabled={loading}
            placeholder="e.g. two-strike approach, bunt defense"
            className="w-full bg-white/5 border border-white/10 rounded-sm px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-red disabled:opacity-50 placeholder:text-white/30"
          />
        </div>

        <button
          type="button"
          onClick={() => onGenerate(focus)}
          disabled={loading}
          className="mt-3 w-full min-h-[44px] px-3 py-2.5 bg-red hover:bg-red/90 rounded-sm text-[12.5px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-90 relative overflow-hidden"
        >
          {loading ? (
            <>
              {/* Indeterminate shimmer behind the label so coaches see
                  a clear "still working" signal during the 3-8s wait. */}
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[loading-bar_1.4s_ease-in-out_infinite]"
              />
              <Loader2 className="w-3.5 h-3.5 animate-spin relative" />
              <span className="relative">Drafting plan…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Generate {constraint.label.toLowerCase()} plan
            </>
          )}
        </button>
        <div className="mt-2 text-[10px] text-white/45 leading-snug">
          {loading
            ? "Usually takes 3–8 seconds. You'll review the draft before anything saves."
            : "You'll review the proposal and choose Append or Replace before anything saves."}
        </div>
      </div>
    </div>
  );
}

function FieldRunnerCard({ nextBlock }: { nextBlock: UIBlock | undefined }) {
  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden">
      <div className="px-[18px] py-3.5 border-b border-hair-2">
        <h3 className="font-display text-[14px] font-semibold tracking-tight">
          Field runner
        </h3>
        <p className="text-[11.5px] text-ink-3 mt-0.5">
          Start practice on your phone at the field.
        </p>
      </div>
      <div className="p-4">
        <div className="bg-ink text-white rounded-md p-4">
          <div className="text-[9.5px] font-bold text-white/50 uppercase tracking-[0.08em]">
            Up next
          </div>
          <div className="font-display text-[15px] font-semibold mt-0.5">
            {nextBlock?.drillName ?? "Empty plan"}
          </div>
          <div className="font-mono text-[11px] text-white/65 mt-2 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            {nextBlock ? `${nextBlock.durationMin} min` : "—"}
          </div>
          <button
            onClick={() => comingSoon("Field runner mode", "Mobile run-the-practice UI ships next sprint.")}
            disabled={!nextBlock}
            className="mt-4 w-full py-2.5 bg-red hover:bg-red/90 rounded-sm text-[11.5px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            Start practice
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modals ───────────────────────────────────────────────────

function CreatePlanModal({
  open,
  onOpenChange,
  defaultDate,
  programLevels,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDate: string;
  programLevels: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [teamLevel, setTeamLevel] = useState<string>(programLevels[0] ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when reopening
  useEffect(() => {
    if (open) {
      setName("");
      setDate(defaultDate);
      setTeamLevel(programLevels[0] ?? "");
      setError(null);
    }
  }, [open, defaultDate, programLevels]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await createPlanAction({
      planDate: date,
      name: name.trim() || undefined,
      teamLevel: teamLevel || null,
    });
    setLoading(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    onOpenChange(false);
    if (r.planId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("plan", r.planId);
      router.push(`/app/practice?${params.toString()}`);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New practice plan"
      description="Plans save as you build. You can rename or delete later."
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="text-[12.5px] bg-red-soft text-red p-2.5 rounded-sm">
            {error}
          </div>
        )}
        <div>
          <label className="type-label mb-1.5 block">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] font-mono outline-none focus:border-red"
          />
        </div>
        <div>
          <label className="type-label mb-1.5 block">Plan name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Auto-named from date if blank"
            className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red"
            autoFocus
          />
        </div>
        {programLevels.length > 1 && (
          <div>
            <label className="type-label mb-1.5 block">Team</label>
            <select
              value={teamLevel}
              onChange={(e) => setTeamLevel(e.target.value)}
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red"
            >
              <option value="">All teams</option>
              {programLevels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}
        <ModalFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-[38px] rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 h-[38px] rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {loading ? "Creating…" : "Create plan"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function CustomDrillModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(15);
  const [focus, setFocus] = useState("");
  const [category, setCategory] = useState<PlanCategory>("hit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setDuration(15);
      setFocus("");
      setCategory("hit");
      setError(null);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Drill name required.");
      return;
    }
    setLoading(true);
    const r = await addCustomDrillAction({
      name: name.trim(),
      defaultDuration: duration,
      focus: focus.trim() || null,
      category,
    });
    setLoading(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    onOpenChange(false);
    toast.success(`Added: ${name.trim()}`);
    router.refresh();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New custom drill"
      description="Adds to your library. Available across all practice plans."
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="text-[12.5px] bg-red-soft text-red p-2.5 rounded-sm">
            {error}
          </div>
        )}
        <div>
          <label className="type-label mb-1.5 block">Drill name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Two-strike approach + back-side hitting"
            className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="type-label mb-1.5 block">Default duration</label>
            <input
              type="number"
              min={1}
              max={180}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value, 10) || 0))}
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] font-mono outline-none focus:border-red"
            />
          </div>
          <div>
            <label className="type-label mb-1.5 block">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PlanCategory)}
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] font-semibold outline-none focus:border-red"
            >
              {(Object.keys(CATEGORY_LABEL) as PlanCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="type-label mb-1.5 block">
            Focus (optional)
          </label>
          <textarea
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            rows={2}
            placeholder="What you're working on, reps, key cues…"
            className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red resize-none"
          />
        </div>
        <ModalFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-[38px] rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 h-[38px] rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold disabled:opacity-60"
          >
            {loading ? "Saving…" : "Add drill"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// ── AI proposal modal ──────────────────────────────────────

/**
 * Renders the AI Assistant Coach's drafted plan and lets the coach pick
 * Append (default — keeps existing blocks, adds these after) or Replace
 * (deletes existing blocks first). Nothing is written until the coach
 * clicks one of those.
 */
function AIProposalModal({
  proposal,
  applying,
  existingBlockCount,
  onClose,
  onApply,
}: {
  proposal: { summary: string | null; blocks: AIPlanProposalBlock[] } | null;
  applying: boolean;
  existingBlockCount: number;
  onClose: () => void;
  onApply: (mode: ApplyAIPracticePlanMode) => void;
}) {
  const open = proposal !== null;
  const blocks = proposal?.blocks ?? [];
  const hasExistingBlocks = existingBlockCount > 0;
  const totalMain = blocks
    .filter((b) => b.lane === "main")
    .reduce((s, b) => s + b.durationMin, 0);

  // Per-category minute breakdown (parallel-aware: secondary lane still
  // counts toward category-time even though it doesn't extend wall clock)
  const byCategory = blocks.reduce(
    (acc, b) => {
      acc[b.category] = (acc[b.category] ?? 0) + b.durationMin;
      return acc;
    },
    {} as Record<PlanCategory, number>,
  );
  const categoriesShown = (Object.keys(byCategory) as PlanCategory[]).filter(
    (c) => byCategory[c] > 0,
  );

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o && !applying) onClose();
      }}
      title="AI Assistant Coach proposal"
      description={
        hasExistingBlocks
          ? `Your plan has ${existingBlockCount} block${existingBlockCount === 1 ? "" : "s"} already. Choose how to add this draft.`
          : "Review the draft, then add it to your plan."
      }
      size="lg"
    >
      {proposal && (
        <div className="space-y-4">
          {proposal.summary && (
            <div className="bg-paper border-l-[3px] border-red rounded-sm px-3.5 py-2.5">
              <div className="type-label !text-red mb-1">TL;DR</div>
              <div className="text-[13px] leading-relaxed">{proposal.summary}</div>
            </div>
          )}

          {/* Top-line counts */}
          <div className="flex items-center gap-3 text-[11.5px] text-ink-3 flex-wrap">
            <span>
              <b className="text-ink font-mono">{blocks.length}</b> blocks
            </span>
            <span>·</span>
            <span>
              <b className="text-ink font-mono">{totalMain}</b> min main-field time
            </span>
            {categoriesShown.length > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  {categoriesShown.map((c) => (
                    <span
                      key={c}
                      className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-paper border border-hair text-[10.5px] font-mono",
                      )}
                      title={`${CATEGORY_LABEL[c]}: ${byCategory[c]}m`}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", CATEGORY_COLOR[c].bg)} />
                      <span className="text-ink-2">{byCategory[c]}m</span>
                    </span>
                  ))}
                </span>
              </>
            )}
          </div>

          <div className="border border-hair rounded-md overflow-hidden">
            {blocks.map((b, i) => {
              const c = CATEGORY_COLOR[b.category];
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 px-3.5 py-2.5 border-l-[3px]",
                    c.border,
                    i > 0 && "border-t border-t-hair-2",
                    b.lane === "secondary" && "bg-amber-soft/15",
                  )}
                >
                  <span className="font-mono text-[11px] text-ink-3 w-5 text-right shrink-0 pt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("type-label", c.text)}>
                        {CATEGORY_LABEL[b.category]}
                      </span>
                      {b.lane === "secondary" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-amber text-white rounded-xs text-[9px] font-bold uppercase tracking-[0.06em]">
                          ⇉ Parallel
                        </span>
                      )}
                      <span className="font-display text-[13.5px] font-semibold tracking-tight">
                        {b.drillName}
                      </span>
                    </div>
                    {b.focusText && (
                      <div className="text-[11.5px] italic text-ink-3 mt-0.5">
                        {b.focusText}
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-[12px] text-ink-2 font-semibold shrink-0">
                    {b.durationMin}m
                  </span>
                </div>
              );
            })}
          </div>

          <ModalFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="min-h-[40px] px-4 rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink disabled:opacity-50"
            >
              Cancel
            </button>
            {hasExistingBlocks && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `This will delete your ${existingBlockCount} existing block${existingBlockCount === 1 ? "" : "s"} and replace with the AI's ${blocks.length}. Continue?`,
                    )
                  ) {
                    onApply("replace");
                  }
                }}
                disabled={applying}
                className="min-h-[40px] px-4 rounded-sm bg-paper border border-hair hover:border-amber text-ink text-[13px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
                title={`Delete your ${existingBlockCount} block${existingBlockCount === 1 ? "" : "s"} and start fresh with the AI's ${blocks.length}`}
              >
                {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-amber" />}
                Replace ({blocks.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => onApply("append")}
              disabled={applying}
              autoFocus
              className="min-h-[40px] px-4 rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
              title={hasExistingBlocks ? `Keep your ${existingBlockCount}, add the AI's ${blocks.length} after` : "Add these blocks to the plan"}
            >
              {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {hasExistingBlocks
                ? `Append (${existingBlockCount}+${blocks.length})`
                : `Add ${blocks.length} blocks`}
            </button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  );
}

// ── AI feedback modal ──────────────────────────────────────

/**
 * Lightweight 👍/👎 prompt shown immediately after a successful AI apply.
 * Optional one-line note is fed back into future generations via the
 * recent-feedback prompt section. Coach can dismiss without rating —
 * no signal is recorded if so.
 */
function AIFeedbackModal({
  pending,
  onClose,
  onSubmit,
}: {
  pending: { generationId: string; insertedCount: number; mode: ApplyAIPracticePlanMode } | null;
  onClose: () => void;
  onSubmit: (rating: 1 | -1, note: string | null) => void;
}) {
  const [note, setNote] = useState("");
  const open = pending !== null;

  // Reset note when reopening for a new generation.
  useEffect(() => {
    if (open) setNote("");
  }, [open, pending?.generationId]);

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Was this plan helpful?"
      description={
        pending
          ? `You ${pending.mode === "replace" ? "replaced your plan with" : "added"} ${pending.insertedCount} AI block${pending.insertedCount === 1 ? "" : "s"}. A 5-second rating helps the assistant get better.`
          : ""
      }
      size="sm"
    >
      <div className="space-y-4">
        <div>
          <label className="type-label mb-1.5 block">
            Optional note — what worked or didn&apos;t
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. too much hitting, not enough defense"
            className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red resize-none"
          />
          <div className="text-[10.5px] text-ink-3 mt-1 text-right">
            {note.length}/500
          </div>
        </div>
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-[38px] rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onSubmit(-1, note)}
            className="px-4 h-[38px] rounded-sm bg-paper border border-hair hover:border-ink text-ink text-[13px] font-semibold inline-flex items-center gap-1.5"
            title="Not helpful"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            Not helpful
          </button>
          <button
            type="button"
            onClick={() => onSubmit(1, note)}
            className="px-4 h-[38px] rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold inline-flex items-center gap-1.5"
            title="Helpful"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            Helpful
          </button>
        </ModalFooter>
      </div>
    </Modal>
  );
}

// ── Helpers ────────────────────────────────────────────────

function offsetDate(yyyymmdd: string, days: number): string {
  const d = new Date(yyyymmdd + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
