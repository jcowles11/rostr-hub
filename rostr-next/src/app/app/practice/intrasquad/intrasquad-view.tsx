"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Swords,
  Shuffle,
  Printer,
  Plus,
  X,
  Users,
  Clock,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { cn } from "@/lib/utils";
import type { MockPlayer } from "@/lib/mock-data";

/**
 * IntrasquadView — full builder UI for an intrasquad scrimmage.
 *
 * What coaches need from this screen:
 *   - Split the available roster into two squads (Blues vs Whites)
 *   - Assign a pitching rotation across the planned innings
 *   - Set base rules (count starts, ghost runners, max batters/inning,
 *     foul-strike rule, mercy)
 *   - See an at-a-glance plan they can take to the field (print)
 *
 * Operates entirely on local React state — the persistence story for
 * saved scrimmage plans is intentionally deferred (see DECISIONS).
 * For the demo + first real use, coaches build the plan, print it,
 * run the scrimmage. Score-keeping flows into existing /practice/live-abs
 * once a coach is ready.
 */

export interface IntrasquadPlayer {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  positions: string[];
  classYearShort: string;
  ba?: string;
  era?: string;
  availabilityStatus: "ok" | "questionable" | "out";
}

interface BaseRules {
  countStart: "0-0" | "1-1" | "1-0" | "0-1";
  ghostRunnersAfterInning: number; // 0 = off
  maxBattersPerInning: number; // 0 = until 3 outs
  foulIsStrikeWith2: boolean;
  mercyAfterRunsInInning: number; // 0 = off
  innings: number;
}

interface PitcherSlot {
  pitcherId: string | null;
  startInning: number;
  endInning: number;
}

const DEFAULT_RULES: BaseRules = {
  countStart: "1-1",
  ghostRunnersAfterInning: 3,
  maxBattersPerInning: 6,
  foulIsStrikeWith2: false,
  mercyAfterRunsInInning: 5,
  innings: 5,
};

export function IntrasquadView({
  roster,
  programName,
  basePathPrefix,
}: {
  roster: IntrasquadPlayer[];
  programName: string;
  /** "/app" or "/demo" — used for breadcrumb / back-link. */
  basePathPrefix: "/app" | "/demo";
}) {
  const pathname = usePathname();
  const isDemo = pathname?.startsWith("/demo") ?? false;

  // Filter out players who are out — they can't scrimmage today.
  const available = useMemo(
    () => roster.filter((p) => p.availabilityStatus !== "out"),
    [roster],
  );

  const pitchers = useMemo(
    () => available.filter((p) => p.positions.includes("P")),
    [available],
  );

  const [squadA, setSquadA] = useState<string[]>(() => splitBalanced(available).a);
  const [squadB, setSquadB] = useState<string[]>(() => splitBalanced(available).b);
  const [unassigned, setUnassigned] = useState<string[]>(() => splitBalanced(available).bench);
  const [rules, setRules] = useState<BaseRules>(DEFAULT_RULES);
  const [pitcherSlots, setPitcherSlots] = useState<PitcherSlot[]>(() =>
    defaultPitcherRotation(pitchers, DEFAULT_RULES.innings),
  );

  // Keep pitcher slots in sync with innings count when it changes.
  function updateInnings(n: number) {
    setRules((r) => ({ ...r, innings: n }));
    setPitcherSlots((slots) => trimRotationToInnings(slots, n));
  }

  const playerById = useMemo(() => {
    const m = new Map<string, IntrasquadPlayer>();
    for (const p of available) m.set(p.id, p);
    return m;
  }, [available]);

  function reroll() {
    const split = splitBalanced(available);
    setSquadA(split.a);
    setSquadB(split.b);
    setUnassigned(split.bench);
    setPitcherSlots(defaultPitcherRotation(pitchers, rules.innings));
  }

  function moveTo(playerId: string, target: "A" | "B" | "bench") {
    const removeFromAll = (xs: string[]) => xs.filter((id) => id !== playerId);
    setSquadA((xs) => (target === "A" ? [...removeFromAll(xs), playerId] : removeFromAll(xs)));
    setSquadB((xs) => (target === "B" ? [...removeFromAll(xs), playerId] : removeFromAll(xs)));
    setUnassigned((xs) =>
      target === "bench" ? [...removeFromAll(xs), playerId] : removeFromAll(xs),
    );
  }

  // Estimated duration: avg ~7 min per inning at HS pace + 2 min between
  // innings + 5 min warm-up, capped by max-batters-per-inning shortcut.
  const estimatedMin =
    5 + rules.innings * (rules.maxBattersPerInning > 0 ? 6 : 7) + (rules.innings - 1) * 2;

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: programName },
          { label: "Practice", href: `${basePathPrefix}/practice` },
          { label: "Intrasquad" },
        ]}
        actions={[
          {
            kind: "ghost",
            label: "Reset",
            icon: <RotateCcw className="w-[15px] h-[15px]" />,
            onClick: reroll,
          },
          {
            kind: "primary",
            label: "Print plan",
            icon: <Printer className="w-[15px] h-[15px]" />,
            onClick: () => window.print(),
          },
        ]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          {/* Header */}
          <div className="flex items-start gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-md bg-red-soft text-red flex items-center justify-center shrink-0">
              <Swords className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-[28px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
                Intrasquad scrimmage
              </h1>
              <p className="text-[13.5px] text-ink-3 mt-0.5">
                Split the squad, set the rules, take it to the field.{" "}
                {isDemo && (
                  <span className="text-amber font-semibold">
                    · demo: changes don&apos;t save
                  </span>
                )}
              </p>
            </div>
            <Link
              href={`${basePathPrefix}/practice`}
              className="px-3 py-2 text-[12.5px] text-ink-3 hover:text-ink rounded-sm inline-flex items-center gap-1.5 print:hidden"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to plan
            </Link>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-7">
            <SummaryTile label="Innings" value={String(rules.innings)} />
            <SummaryTile label="Squads" value={`${squadA.length} v ${squadB.length}`} />
            <SummaryTile label="Pitchers" value={String(pitcherSlots.filter((s) => s.pitcherId).length)} />
            <SummaryTile label="~ Duration" value={`${estimatedMin}m`} />
          </div>

          {/* Squad builder */}
          <div className="mt-7 grid grid-cols-1 lg:grid-cols-3 gap-3">
            <SquadColumn
              title="Squad A · Blues"
              tone="sky"
              playerIds={squadA}
              playerById={playerById}
              onMove={moveTo}
              squad="A"
            />
            <SquadColumn
              title="Squad B · Whites"
              tone="grass"
              playerIds={squadB}
              playerById={playerById}
              onMove={moveTo}
              squad="B"
            />
            <SquadColumn
              title="Bench"
              tone="muted"
              playerIds={unassigned}
              playerById={playerById}
              onMove={moveTo}
              squad="bench"
            />
          </div>

          {/* Pitching rotation */}
          <div className="mt-8 bg-card border border-hair rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-hair-2 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-ink-3" />
              <h3 className="font-display text-[15px] font-semibold tracking-tight">
                Pitching rotation
              </h3>
              <span className="text-[11.5px] text-ink-3 ml-2">
                Roll innings across {pitchers.length} available pitcher
                {pitchers.length === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => setPitcherSlots(defaultPitcherRotation(pitchers, rules.innings))}
                className="ml-auto px-2.5 py-1 text-[11.5px] font-semibold text-ink-3 hover:text-ink rounded-sm inline-flex items-center gap-1"
              >
                <Shuffle className="w-3 h-3" /> Auto-fill
              </button>
            </div>
            <div className="divide-y divide-hair-2">
              {pitcherSlots.map((slot, idx) => (
                <PitcherSlotRow
                  key={idx}
                  slot={slot}
                  innings={rules.innings}
                  pitchers={pitchers}
                  used={pitcherSlots.map((s) => s.pitcherId).filter((x): x is string => x !== null && x !== slot.pitcherId)}
                  onChange={(next) =>
                    setPitcherSlots((slots) => slots.map((s, i) => (i === idx ? next : s)))
                  }
                  onRemove={() => setPitcherSlots((slots) => slots.filter((_, i) => i !== idx))}
                />
              ))}
              {pitcherSlots.length < pitchers.length && pitcherSlots.length < rules.innings && (
                <button
                  onClick={() =>
                    setPitcherSlots((slots) => [
                      ...slots,
                      {
                        pitcherId: null,
                        startInning: Math.min(rules.innings, (slots[slots.length - 1]?.endInning ?? 0) + 1),
                        endInning: Math.min(rules.innings, (slots[slots.length - 1]?.endInning ?? 0) + 2),
                      },
                    ])
                  }
                  className="w-full px-4 py-3 text-left text-[12.5px] font-semibold text-ink-3 hover:bg-paper hover:text-ink inline-flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Add pitcher slot
                </button>
              )}
            </div>
          </div>

          {/* Base rules */}
          <div className="mt-8 bg-card border border-hair rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-hair-2">
              <h3 className="font-display text-[15px] font-semibold tracking-tight">
                Base rules
              </h3>
              <span className="text-[11.5px] text-ink-3 ml-2">
                Tighten things up so you actually finish in time
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <RuleSelect
                label="Count starts"
                value={rules.countStart}
                onChange={(v) => setRules((r) => ({ ...r, countStart: v as BaseRules["countStart"] }))}
                options={[
                  { value: "0-0", label: "0-0 (full count)" },
                  { value: "1-0", label: "1-0 (hitter ahead)" },
                  { value: "0-1", label: "0-1 (pitcher ahead)" },
                  { value: "1-1", label: "1-1 (saves time)" },
                ]}
              />
              <RuleSelect
                label="Innings"
                value={String(rules.innings)}
                onChange={(v) => updateInnings(parseInt(v, 10))}
                options={[3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: `${n} innings` }))}
              />
              <RuleSelect
                label="Max batters per inning"
                value={String(rules.maxBattersPerInning)}
                onChange={(v) => setRules((r) => ({ ...r, maxBattersPerInning: parseInt(v, 10) }))}
                options={[
                  { value: "0", label: "Until 3 outs" },
                  { value: "5", label: "5 batters" },
                  { value: "6", label: "6 batters" },
                  { value: "7", label: "7 batters" },
                  { value: "9", label: "Whole order (9)" },
                ]}
              />
              <RuleSelect
                label="Ghost runners start at inning"
                value={String(rules.ghostRunnersAfterInning)}
                onChange={(v) =>
                  setRules((r) => ({ ...r, ghostRunnersAfterInning: parseInt(v, 10) }))
                }
                options={[
                  { value: "0", label: "Off" },
                  { value: "3", label: "Inning 3+" },
                  { value: "4", label: "Inning 4+" },
                  { value: "5", label: "Inning 5+" },
                ]}
              />
              <RuleSelect
                label="Mercy if inning hits"
                value={String(rules.mercyAfterRunsInInning)}
                onChange={(v) =>
                  setRules((r) => ({ ...r, mercyAfterRunsInInning: parseInt(v, 10) }))
                }
                options={[
                  { value: "0", label: "No mercy" },
                  { value: "5", label: "5 runs" },
                  { value: "7", label: "7 runs" },
                  { value: "10", label: "10 runs" },
                ]}
              />
              <ToggleRule
                label="Foul ball is a strike with 2 strikes"
                value={rules.foulIsStrikeWith2}
                onChange={(v) => setRules((r) => ({ ...r, foulIsStrikeWith2: v }))}
              />
            </div>
          </div>

          {/* Game plan card — always visible at the bottom + print target */}
          <div className="mt-8 bg-card border-2 border-red rounded-lg p-5 print:border-black">
            <div className="flex items-center gap-2 mb-3">
              <Swords className="w-4 h-4 text-red" />
              <h3 className="font-display text-[16px] font-semibold tracking-tight">
                Game plan · take this to the field
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
              <div>
                <div className="type-label mb-2">Squad A · Blues ({squadA.length})</div>
                <ol className="space-y-1 list-decimal list-inside font-mono text-[12.5px]">
                  {squadA.map((id) => {
                    const p = playerById.get(id);
                    return p ? (
                      <li key={id}>
                        #{p.jerseyNumber} {p.firstName} {p.lastName}{" "}
                        <span className="text-ink-3">({p.positions[0] ?? "—"})</span>
                      </li>
                    ) : null;
                  })}
                </ol>
              </div>
              <div>
                <div className="type-label mb-2">Squad B · Whites ({squadB.length})</div>
                <ol className="space-y-1 list-decimal list-inside font-mono text-[12.5px]">
                  {squadB.map((id) => {
                    const p = playerById.get(id);
                    return p ? (
                      <li key={id}>
                        #{p.jerseyNumber} {p.firstName} {p.lastName}{" "}
                        <span className="text-ink-3">({p.positions[0] ?? "—"})</span>
                      </li>
                    ) : null;
                  })}
                </ol>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-hair-2 text-[12.5px]">
              <div className="type-label mb-2">Pitching</div>
              <div className="font-mono space-y-0.5">
                {pitcherSlots.filter((s) => s.pitcherId).map((slot, i) => {
                  const p = playerById.get(slot.pitcherId!);
                  if (!p) return null;
                  return (
                    <div key={i}>
                      Innings {slot.startInning}
                      {slot.endInning > slot.startInning ? `–${slot.endInning}` : ""}: #{p.jerseyNumber}{" "}
                      {p.firstName} {p.lastName}
                    </div>
                  );
                })}
                {pitcherSlots.filter((s) => s.pitcherId).length === 0 && (
                  <div className="text-ink-3 italic">No pitchers assigned yet.</div>
                )}
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-hair-2 text-[12.5px]">
              <div className="type-label mb-2">Rules</div>
              <ul className="font-mono space-y-0.5">
                <li>• Count starts {rules.countStart}</li>
                <li>• {rules.innings} innings · ~{estimatedMin} min total</li>
                {rules.maxBattersPerInning > 0 && (
                  <li>• Max {rules.maxBattersPerInning} batters per inning (or 3 outs)</li>
                )}
                {rules.ghostRunnersAfterInning > 0 && (
                  <li>• Ghost runners on 2nd starting inning {rules.ghostRunnersAfterInning}</li>
                )}
                {rules.mercyAfterRunsInInning > 0 && (
                  <li>• Mercy: cap inning at {rules.mercyAfterRunsInInning} runs</li>
                )}
                {rules.foulIsStrikeWith2 && <li>• Foul with 2 strikes = K</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-hair rounded-lg p-3">
      <div className="type-label">{label}</div>
      <div className="font-mono text-[20px] font-semibold tracking-tight mt-1 leading-none">
        {value}
      </div>
    </div>
  );
}

function SquadColumn({
  title,
  tone,
  playerIds,
  playerById,
  onMove,
  squad,
}: {
  title: string;
  tone: "sky" | "grass" | "muted";
  playerIds: string[];
  playerById: Map<string, IntrasquadPlayer>;
  onMove: (playerId: string, to: "A" | "B" | "bench") => void;
  squad: "A" | "B" | "bench";
}) {
  const toneClasses = {
    sky: "bg-sky-soft text-sky",
    grass: "bg-grass-dim text-grass",
    muted: "bg-paper-deep text-ink-3",
  }[tone];

  return (
    <div className="bg-card border border-hair rounded-lg overflow-hidden flex flex-col">
      <div className={cn("px-4 py-3 border-b border-hair-2 flex items-center gap-2", toneClasses)}>
        <Users className="w-3.5 h-3.5" />
        <h3 className="font-display text-[14px] font-semibold tracking-tight">{title}</h3>
        <span className="ml-auto font-mono text-[11px] font-semibold">{playerIds.length}</span>
      </div>
      <div className="divide-y divide-hair-2 flex-1 min-h-[200px]">
        {playerIds.map((id) => {
          const p = playerById.get(id);
          if (!p) return null;
          return (
            <div
              key={id}
              className="px-3 py-2 flex items-center gap-2 text-[13px] hover:bg-paper transition-colors"
            >
              <span className="font-mono text-[10.5px] text-ink-3 w-7 shrink-0">
                #{p.jerseyNumber}
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate font-semibold">
                  {p.firstName} {p.lastName}
                </div>
                <div className="text-[10.5px] text-ink-3 font-mono">
                  {p.positions.join("/")} · {p.classYearShort}
                  {p.availabilityStatus === "questionable" && " · Q"}
                </div>
              </div>
              <div className="flex gap-0.5 shrink-0">
                {squad !== "A" && (
                  <button
                    onClick={() => onMove(id, "A")}
                    className="px-1.5 py-1 text-[10px] font-bold text-sky hover:bg-sky-soft rounded-xs"
                    title="Move to Squad A"
                  >
                    A
                  </button>
                )}
                {squad !== "B" && (
                  <button
                    onClick={() => onMove(id, "B")}
                    className="px-1.5 py-1 text-[10px] font-bold text-grass hover:bg-grass-dim rounded-xs"
                    title="Move to Squad B"
                  >
                    B
                  </button>
                )}
                {squad !== "bench" && (
                  <button
                    onClick={() => onMove(id, "bench")}
                    className="px-1 py-1 text-ink-3 hover:text-ink hover:bg-paper rounded-xs"
                    title="Move to bench"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {playerIds.length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-ink-3 italic">
            {squad === "bench" ? "Everyone's playing." : "Add players from another column."}
          </div>
        )}
      </div>
    </div>
  );
}

function PitcherSlotRow({
  slot,
  innings,
  pitchers,
  used,
  onChange,
  onRemove,
}: {
  slot: PitcherSlot;
  innings: number;
  pitchers: IntrasquadPlayer[];
  used: string[];
  onChange: (next: PitcherSlot) => void;
  onRemove: () => void;
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <select
        value={slot.pitcherId ?? ""}
        onChange={(e) => onChange({ ...slot, pitcherId: e.target.value || null })}
        className="bg-paper border border-hair rounded-sm px-2.5 py-1.5 text-[13px] flex-1 min-w-[160px] focus:outline-none focus:border-red"
      >
        <option value="">— pick a pitcher —</option>
        {pitchers.map((p) => (
          <option key={p.id} value={p.id} disabled={used.includes(p.id)}>
            #{p.jerseyNumber} {p.firstName} {p.lastName}{" "}
            {p.era ? ` · ${p.era} ERA` : ""}
            {used.includes(p.id) ? " (used)" : ""}
          </option>
        ))}
      </select>
      <span className="text-[12px] text-ink-3 shrink-0">Innings</span>
      <div className="inline-flex items-center gap-1 shrink-0">
        <NumberStepper
          value={slot.startInning}
          min={1}
          max={innings}
          onChange={(v) =>
            onChange({ ...slot, startInning: v, endInning: Math.max(slot.endInning, v) })
          }
        />
        <span className="text-ink-3">–</span>
        <NumberStepper
          value={slot.endInning}
          min={slot.startInning}
          max={innings}
          onChange={(v) => onChange({ ...slot, endInning: v })}
        />
      </div>
      <button
        onClick={onRemove}
        className="p-1 text-ink-3 hover:text-red shrink-0"
        title="Remove slot"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function NumberStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center bg-paper border border-hair rounded-sm">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="px-1.5 py-1 text-ink-3 hover:text-ink disabled:opacity-30"
        type="button"
      >
        <ChevronDown className="w-3 h-3" />
      </button>
      <span className="px-2 font-mono text-[13px] font-semibold min-w-[24px] text-center">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="px-1.5 py-1 text-ink-3 hover:text-ink disabled:opacity-30"
        type="button"
      >
        <ChevronUp className="w-3 h-3" />
      </button>
    </div>
  );
}

function RuleSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="type-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-paper border border-hair rounded-sm px-2.5 py-2 text-[13px] focus:outline-none focus:border-red"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRule({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer p-2 -m-2 rounded-sm hover:bg-paper">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          "w-9 h-5 rounded-full relative transition-colors shrink-0",
          value ? "bg-grass" : "bg-paper-deep border border-hair",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
            value ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
      <span className="text-[13px]">{label}</span>
    </label>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * splitBalanced — alternates available players by sorted BA / ERA so
 * Squad A and Squad B end up balanced rather than top-heavy. Pitchers
 * get distributed by ERA (not BA) to spread arm talent. Anyone left
 * over (odd count) goes to the bench.
 */
function splitBalanced(players: IntrasquadPlayer[]): {
  a: string[];
  b: string[];
  bench: string[];
} {
  const sorted = [...players].sort((a, b) => {
    // Pitchers ranked by ERA (lower is better → goes first); position
    // players ranked by BA (higher is better → goes first). Mixing
    // both into one rank by normalizing to a common "skill" value.
    const aSkill = a.ba ? parseFloat(a.ba) : a.era ? 1 - parseFloat(a.era) / 10 : 0.27;
    const bSkill = b.ba ? parseFloat(b.ba) : b.era ? 1 - parseFloat(b.era) / 10 : 0.27;
    return bSkill - aSkill;
  });
  const a: string[] = [];
  const b: string[] = [];
  sorted.forEach((p, i) => {
    if (i % 2 === 0) a.push(p.id);
    else b.push(p.id);
  });
  // Tight 15-player roster has minimal bench. We leave bench empty by
  // default and let the coach decide who sits.
  return { a, b, bench: [] };
}

function defaultPitcherRotation(
  pitchers: IntrasquadPlayer[],
  innings: number,
): PitcherSlot[] {
  if (pitchers.length === 0 || innings === 0) return [];
  // Spread pitchers across innings — each gets ⌈innings / pitchers⌉ frames.
  const sorted = [...pitchers].sort((a, b) => {
    const ae = a.era ? parseFloat(a.era) : 99;
    const be = b.era ? parseFloat(b.era) : 99;
    return ae - be; // best ERA goes first
  });
  const perPitcher = Math.max(1, Math.ceil(innings / sorted.length));
  const slots: PitcherSlot[] = [];
  let nextInning = 1;
  for (const p of sorted) {
    if (nextInning > innings) break;
    const start = nextInning;
    const end = Math.min(innings, nextInning + perPitcher - 1);
    slots.push({ pitcherId: p.id, startInning: start, endInning: end });
    nextInning = end + 1;
  }
  return slots;
}

function trimRotationToInnings(slots: PitcherSlot[], innings: number): PitcherSlot[] {
  return slots
    .filter((s) => s.startInning <= innings)
    .map((s) => ({ ...s, endInning: Math.min(s.endInning, innings) }));
}
