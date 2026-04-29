"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Plus,
  X,
  GripVertical,
  Search,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import {
  createTryoutAction,
  type TryoutMetricInput,
} from "@/app/app/tryouts/actions";

/**
 * CreateTryoutModal — full creation flow.
 *
 * Major rebuild based on coach feedback:
 *   - Dropped Varsity/JV target fields entirely (made-up forecasting numbers
 *     that nobody actually filled in honestly)
 *   - Coach picks metrics DURING creation, not after, with:
 *       • One-click presets ("Standard HS · 5 metrics", "Pitcher-focused", etc.)
 *       • Searchable library of common HS/college baseball metrics
 *       • Inline custom metric builder (name + unit + scoring direction)
 *       • Reorder + edit + remove on the selected list
 *   - Explicit messaging that metrics sync to player profiles via the
 *     player_best_measurables view (it always did, but coaches didn't know)
 */

// ── Metric library ─────────────────────────────────────────────

interface MetricPreset {
  shortCode: string;
  name: string;
  unit: string | null;
  scoreType: "lower_better" | "higher_better" | "rating";
  category: "speed" | "power" | "throwing" | "defense" | "hitting" | "pitching" | "athletic";
  description?: string;
}

const METRIC_LIBRARY: MetricPreset[] = [
  // Speed
  { shortCode: "60yd", name: "60-yard dash", unit: "s", scoreType: "lower_better", category: "speed", description: "The recruiting standard." },
  { shortCode: "30yd", name: "30-yard dash", unit: "s", scoreType: "lower_better", category: "speed" },
  { shortCode: "H-1B", name: "Home to first", unit: "s", scoreType: "lower_better", category: "speed", description: "RH from home plate to 1B" },
  { shortCode: "10yd", name: "10-yard split", unit: "s", scoreType: "lower_better", category: "speed", description: "Acceleration / first-step quickness" },

  // Power / hitting
  { shortCode: "EV", name: "Exit velocity", unit: "mph", scoreType: "higher_better", category: "power", description: "Off the tee or front toss" },
  { shortCode: "BatSpd", name: "Bat speed", unit: "mph", scoreType: "higher_better", category: "power" },
  { shortCode: "MaxDist", name: "Max distance", unit: "ft", scoreType: "higher_better", category: "power", description: "Off the tee · longest in 3 swings" },
  { shortCode: "BP", name: "Batting practice grade", unit: null, scoreType: "rating", category: "hitting", description: "1–5 · approach, contact, bat path" },
  { shortCode: "HitMech", name: "Hitting mechanics", unit: null, scoreType: "rating", category: "hitting" },

  // Throwing / arm
  { shortCode: "PVelo", name: "Pitching velocity", unit: "mph", scoreType: "higher_better", category: "pitching", description: "FB max from bullpen" },
  { shortCode: "InfVelo", name: "Infield velocity", unit: "mph", scoreType: "higher_better", category: "throwing", description: "Across the diamond throws" },
  { shortCode: "OFVelo", name: "Outfield velocity", unit: "mph", scoreType: "higher_better", category: "throwing", description: "Long throw from OF" },
  { shortCode: "Pop", name: "Pop time (catcher)", unit: "s", scoreType: "lower_better", category: "throwing", description: "Glove pop → 2B contact" },
  { shortCode: "LongToss", name: "Long toss distance", unit: "ft", scoreType: "higher_better", category: "throwing" },

  // Defense
  { shortCode: "IF", name: "Infield grade", unit: null, scoreType: "rating", category: "defense", description: "1–5 · hands, footwork, transfers" },
  { shortCode: "OF", name: "Outfield grade", unit: null, scoreType: "rating", category: "defense", description: "1–5 · routes, reads, throws" },
  { shortCode: "C", name: "Catcher grade", unit: null, scoreType: "rating", category: "defense", description: "1–5 · receiving, blocking, throws" },
  { shortCode: "1B", name: "1B fielding", unit: null, scoreType: "rating", category: "defense" },

  // Pitching
  { shortCode: "Bullpen", name: "Bullpen grade", unit: null, scoreType: "rating", category: "pitching", description: "1–5 · command, mix, presence" },
  { shortCode: "Strike%", name: "Strike percentage", unit: "%", scoreType: "higher_better", category: "pitching" },
  { shortCode: "Spin", name: "Spin rate", unit: "rpm", scoreType: "higher_better", category: "pitching", description: "Rapsodo / Trackman" },

  // Athletic
  { shortCode: "Vert", name: "Vertical jump", unit: "in", scoreType: "higher_better", category: "athletic" },
  { shortCode: "Broad", name: "Broad jump", unit: "in", scoreType: "higher_better", category: "athletic" },
];

const CATEGORY_LABEL: Record<MetricPreset["category"], string> = {
  speed: "Speed",
  power: "Power",
  hitting: "Hitting",
  throwing: "Throwing",
  defense: "Defense",
  pitching: "Pitching",
  athletic: "Athleticism",
};

// ── Presets (one-click metric bundles) ─────────────────────────

const PRESETS: Array<{
  key: string;
  label: string;
  description: string;
  shortCodes: string[];
}> = [
  {
    key: "standard",
    label: "Standard HS",
    description: "60yd · EV · Pitch velo · Fielding · BP",
    shortCodes: ["60yd", "EV", "PVelo", "IF", "BP"],
  },
  {
    key: "showcase",
    label: "Showcase / recruiting",
    description: "Adds H-1B, OF velo, Pop time",
    shortCodes: ["60yd", "H-1B", "EV", "MaxDist", "PVelo", "OFVelo", "Pop", "BP"],
  },
  {
    key: "pitchers",
    label: "Pitcher-focused",
    description: "Velo + spin + bullpen + pickoffs",
    shortCodes: ["PVelo", "Strike%", "Spin", "Bullpen"],
  },
  {
    key: "skills",
    label: "Position skills only",
    description: "All defensive grades, no measurables",
    shortCodes: ["IF", "OF", "C", "1B", "BP"],
  },
  {
    key: "blank",
    label: "Start blank",
    description: "Build from scratch",
    shortCodes: [],
  },
];

// ── Modal ──────────────────────────────────────────────────────

export function CreateTryoutModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (tryoutId: string) => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [metrics, setMetrics] = useState<TryoutMetricInput[]>(() =>
    presetToMetrics("standard"),
  );
  const [activePreset, setActivePreset] = useState<string>("standard");
  const [search, setSearch] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedCodes = useMemo(
    () => new Set(metrics.map((m) => m.shortCode.toLowerCase())),
    [metrics],
  );

  const libraryFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return METRIC_LIBRARY.filter((m) => {
      if (selectedCodes.has(m.shortCode.toLowerCase())) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.shortCode.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q) ||
        CATEGORY_LABEL[m.category].toLowerCase().includes(q)
      );
    });
  }, [search, selectedCodes]);

  const groupedLibrary = useMemo(() => {
    const groups: Record<string, MetricPreset[]> = {};
    for (const m of libraryFiltered) {
      (groups[m.category] ??= []).push(m);
    }
    return groups;
  }, [libraryFiltered]);

  const reset = () => {
    setName("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setNotes("");
    setMetrics(presetToMetrics("standard"));
    setActivePreset("standard");
    setSearch("");
    setShowCustom(false);
    setError(null);
  };

  const applyPreset = (key: string) => {
    setActivePreset(key);
    setMetrics(presetToMetrics(key));
  };

  const addFromLibrary = (m: MetricPreset) => {
    setActivePreset("");
    setMetrics((prev) => [
      ...prev,
      {
        name: m.name,
        shortCode: m.shortCode,
        unit: m.unit,
        scoreType: m.scoreType,
      },
    ]);
  };

  const addCustom = (m: TryoutMetricInput) => {
    setActivePreset("");
    setMetrics((prev) => [...prev, m]);
    setShowCustom(false);
  };

  const removeMetric = (i: number) => {
    setActivePreset("");
    setMetrics((prev) => prev.filter((_, idx) => idx !== i));
  };

  const moveMetric = (i: number, dir: -1 | 1) => {
    setActivePreset("");
    setMetrics((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const updateMetric = (i: number, patch: Partial<TryoutMetricInput>) => {
    setActivePreset("");
    setMetrics((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give your tryout a name.");
    if (!startDate) return setError("Start date is required.");
    if (metrics.length === 0) {
      return setError("Add at least one metric to evaluate. Pick a preset or build custom.");
    }
    // Sanity-check shortCodes are unique
    const codes = metrics.map((m) => m.shortCode.toLowerCase());
    if (new Set(codes).size !== codes.length) {
      return setError("Two metrics share the same short code. Each must be unique.");
    }

    setLoading(true);
    const r = await createTryoutAction({
      name,
      startDate,
      endDate: endDate || undefined,
      notes,
      metrics,
    });
    setLoading(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success("Tryout created", {
      description: `${metrics.length} metric${metrics.length === 1 ? "" : "s"} ready to score.`,
    });
    reset();
    if (r.tryoutId) onCreated?.(r.tryoutId);
    else onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      title="New tryout"
      description="Set the date, pick exactly the metrics you want to test, and you're ready to score."
      size="lg"
    >
      <form onSubmit={submit} className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Basics */}
        <div className="space-y-3">
          <Field label="Tryout name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring tryout 2026 · Day 1"
              className="w-full bg-card border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red focus:ring-2 focus:ring-red-soft"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-card border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red"
              />
            </Field>
            <Field label="End date" hint="If multi-day. Leave blank for a single session.">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-card border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red"
              />
            </Field>
          </div>
        </div>

        {/* Presets */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-2">
            Quick start
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={cn(
                  "px-3 py-2 rounded-sm border text-left transition-all",
                  activePreset === p.key
                    ? "border-red bg-red-soft shadow-[0_0_0_3px_var(--red-soft)]"
                    : "border-hair bg-card hover:border-ink-3",
                )}
              >
                <div className="text-[12.5px] font-semibold">{p.label}</div>
                <div className="text-[10.5px] text-ink-3 mt-0.5">{p.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected metrics */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
              Metrics for this tryout
            </div>
            <span className="font-mono text-[10.5px] text-ink-3">
              {metrics.length} selected
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-grass font-semibold">
              <Sparkles className="w-3 h-3" />
              Best values sync to player profiles
            </span>
          </div>
          {metrics.length === 0 ? (
            <div className="p-4 bg-paper border border-dashed border-hair rounded-sm text-[12.5px] text-ink-3 text-center">
              No metrics yet. Pick a preset above, or add from the library below.
            </div>
          ) : (
            <div className="space-y-1.5">
              {metrics.map((m, i) => (
                <SelectedMetricRow
                  key={`${m.shortCode}-${i}`}
                  metric={m}
                  isFirst={i === 0}
                  isLast={i === metrics.length - 1}
                  onRemove={() => removeMetric(i)}
                  onMoveUp={() => moveMetric(i, -1)}
                  onMoveDown={() => moveMetric(i, 1)}
                  onUpdate={(patch) => updateMetric(i, patch)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add more — library + custom */}
        <div className="bg-paper rounded-md p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 flex-1">
              Add metrics
            </div>
            <button
              type="button"
              onClick={() => setShowCustom((v) => !v)}
              className={cn(
                "text-[11.5px] font-semibold px-2 py-1 rounded-xs",
                showCustom
                  ? "bg-ink text-white"
                  : "bg-card border border-hair text-ink-2 hover:border-ink",
              )}
            >
              {showCustom ? "Cancel custom" : "+ Custom metric"}
            </button>
          </div>

          {showCustom && (
            <CustomMetricBuilder
              onAdd={addCustom}
              onCancel={() => setShowCustom(false)}
            />
          )}

          <div className="relative mt-1 mb-2">
            <Search className="w-3.5 h-3.5 text-ink-3 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search metrics — speed, velo, fielding…"
              className="w-full bg-card border border-hair rounded-sm pl-8 pr-3 py-1.5 text-[12.5px] outline-none focus:border-red"
            />
          </div>

          <div className="max-h-[280px] overflow-auto pr-1 -mr-1">
            {Object.keys(groupedLibrary).length === 0 ? (
              <div className="px-3 py-6 text-[12px] text-ink-3 text-center">
                {selectedCodes.size === METRIC_LIBRARY.length
                  ? "Every preset metric is already on the list. Add a custom one above."
                  : "No matches. Try a different word, or add a custom metric."}
              </div>
            ) : (
              Object.entries(groupedLibrary).map(([cat, list]) => (
                <div key={cat} className="mb-2">
                  <div className="px-1 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
                    {CATEGORY_LABEL[cat as MetricPreset["category"]]}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {list.map((m) => (
                      <button
                        key={m.shortCode}
                        type="button"
                        onClick={() => addFromLibrary(m)}
                        className="text-left px-2.5 py-1.5 rounded-sm bg-card border border-hair hover:border-red hover:bg-red-soft/30 transition-colors group"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-semibold flex-1">{m.name}</span>
                          <span className="font-mono text-[10px] text-ink-3 font-semibold">
                            {m.unit ?? "1–5"}
                          </span>
                          <Plus className="w-3 h-3 text-ink-3 group-hover:text-red" />
                        </div>
                        {m.description && (
                          <div className="text-[10.5px] text-ink-3 mt-0.5 leading-tight">
                            {m.description}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notes */}
        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What you're evaluating for, tryout format, weather plan…"
            rows={2}
            className="w-full bg-card border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red focus:ring-2 focus:ring-red-soft resize-none"
          />
        </Field>

        {/* Sync explainer */}
        <div className="flex items-start gap-2.5 p-3 bg-grass-dim/30 border border-grass/20 rounded-sm">
          <CheckCircle2 className="w-4 h-4 text-grass shrink-0 mt-0.5" />
          <div className="text-[12px] leading-relaxed">
            <b className="font-semibold">These metrics sync to player profiles.</b>{" "}
            Each player&apos;s best value across all tryouts shows up on their
            public profile and in the recruiter search filters automatically.
          </div>
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={loading}>
            {loading
              ? "Creating…"
              : `Create tryout · ${metrics.length} metric${metrics.length === 1 ? "" : "s"}`}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// ── Helpers ────────────────────────────────────────────────

function presetToMetrics(key: string): TryoutMetricInput[] {
  const preset = PRESETS.find((p) => p.key === key);
  if (!preset) return [];
  return preset.shortCodes
    .map((code) => METRIC_LIBRARY.find((m) => m.shortCode === code))
    .filter((m): m is MetricPreset => Boolean(m))
    .map((m) => ({
      name: m.name,
      shortCode: m.shortCode,
      unit: m.unit,
      scoreType: m.scoreType,
    }));
}

function SelectedMetricRow({
  metric,
  isFirst,
  isLast,
  onRemove,
  onMoveUp,
  onMoveDown,
  onUpdate,
}: {
  metric: TryoutMetricInput;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: (p: Partial<TryoutMetricInput>) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="bg-card border border-hair rounded-sm">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div className="flex flex-col items-center gap-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="text-ink-3 hover:text-ink disabled:opacity-30 px-0.5"
            aria-label="Move up"
          >
            <span className="text-[10px]">▲</span>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="text-ink-3 hover:text-ink disabled:opacity-30 px-0.5"
            aria-label="Move down"
          >
            <span className="text-[10px]">▼</span>
          </button>
        </div>
        <GripVertical className="w-3.5 h-3.5 text-ink-3 hidden sm:block" />
        <span className="font-mono text-[10.5px] text-ink-3 font-semibold w-12 truncate">
          {metric.shortCode}
        </span>
        <span className="text-[13px] font-semibold flex-1 truncate">
          {metric.name}
        </span>
        <span className="hidden sm:inline-flex font-mono text-[10.5px] text-ink-3 px-1.5 py-0.5 bg-paper rounded-xs">
          {scoreTypeLabel(metric.scoreType, metric.unit)}
        </span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-[10.5px] text-ink-3 hover:text-ink font-semibold px-1.5"
        >
          {editing ? "Done" : "Edit"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-ink-3 hover:text-red"
          aria-label="Remove"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {editing && (
        <div className="border-t border-hair-2 p-2.5 grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1">
              Display name
            </div>
            <input
              value={metric.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="w-full bg-paper border border-hair rounded-xs px-2 py-1 text-[12px] outline-none focus:border-red"
            />
          </div>
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1">
              Short code
            </div>
            <input
              value={metric.shortCode}
              onChange={(e) => onUpdate({ shortCode: e.target.value })}
              className="w-full bg-paper border border-hair rounded-xs px-2 py-1 text-[12px] font-mono outline-none focus:border-red"
            />
          </div>
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1">
              Unit
            </div>
            <input
              value={metric.unit ?? ""}
              onChange={(e) => onUpdate({ unit: e.target.value || null })}
              placeholder="mph, s, ft, %, blank for rating"
              className="w-full bg-paper border border-hair rounded-xs px-2 py-1 text-[12px] font-mono outline-none focus:border-red"
            />
          </div>
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1">
              Better is
            </div>
            <select
              value={metric.scoreType}
              onChange={(e) => onUpdate({ scoreType: e.target.value as TryoutMetricInput["scoreType"] })}
              className="w-full bg-paper border border-hair rounded-xs px-2 py-1 text-[12px] font-semibold outline-none focus:border-red"
            >
              <option value="higher_better">Higher (mph, ft, in)</option>
              <option value="lower_better">Lower (s · time)</option>
              <option value="rating">1–5 rating</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomMetricBuilder({
  onAdd,
  onCancel,
}: {
  onAdd: (m: TryoutMetricInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [unit, setUnit] = useState("");
  const [scoreType, setScoreType] = useState<TryoutMetricInput["scoreType"]>("higher_better");

  const submit = () => {
    if (!name.trim() || !shortCode.trim()) return;
    onAdd({
      name: name.trim(),
      shortCode: shortCode.trim(),
      unit: unit.trim() || null,
      scoreType,
    });
    setName("");
    setShortCode("");
    setUnit("");
    setScoreType("higher_better");
  };

  return (
    <div className="mb-3 p-2.5 bg-card border border-red/30 rounded-sm">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-red mb-2">
        New custom metric
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name"
          className="bg-paper border border-hair rounded-xs px-2 py-1.5 text-[12.5px] outline-none focus:border-red"
        />
        <input
          value={shortCode}
          onChange={(e) => setShortCode(e.target.value)}
          placeholder="Short code"
          className="bg-paper border border-hair rounded-xs px-2 py-1.5 text-[12.5px] font-mono outline-none focus:border-red"
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unit (mph, s…)"
          className="bg-paper border border-hair rounded-xs px-2 py-1.5 text-[12.5px] font-mono outline-none focus:border-red"
        />
        <select
          value={scoreType}
          onChange={(e) => setScoreType(e.target.value as TryoutMetricInput["scoreType"])}
          className="bg-paper border border-hair rounded-xs px-2 py-1.5 text-[12.5px] font-semibold outline-none focus:border-red"
        >
          <option value="higher_better">Higher is better</option>
          <option value="lower_better">Lower is better</option>
          <option value="rating">1–5 rating</option>
        </select>
      </div>
      <div className="flex gap-2 justify-end mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-[11.5px] text-ink-3 hover:text-ink font-semibold px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || !shortCode.trim()}
          className="text-[11.5px] bg-red text-white font-semibold px-3 py-1 rounded-xs disabled:opacity-50"
        >
          Add metric
        </button>
      </div>
    </div>
  );
}

function scoreTypeLabel(t: TryoutMetricInput["scoreType"], unit: string | null): string {
  if (t === "rating") return "1–5";
  if (t === "lower_better") return `↓ ${unit ?? ""}`.trim();
  return `↑ ${unit ?? ""}`.trim();
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1.5">
        {label}
      </div>
      {children}
      {hint && <div className="text-[11px] text-ink-3 mt-1">{hint}</div>}
    </div>
  );
}
