"use client";

import { useState } from "react";
import {
  Search,
  Bell,
  MoreHorizontal,
  Play,
  Clock,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { comingSoon } from "@/lib/coming-soon";

/**
 * /app/practice — Practice planner.
 * Pixel target: handoff/designs/06_Practice_Planner.html.
 * Spec: handoff/SCREENS.md §6.
 *
 * 3-column layout: drill library · current plan · AI + field runner.
 * Drag-and-drop is visually indicated but not wired (future sprint).
 */
export default function PracticePlannerPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Lincoln HS" },
          { label: "Practice" },
          { label: "Wed · Apr 22" },
        ]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" />, onClick: () => comingSoon("Notifications") },
          { kind: "ghost", label: "Duplicate", onClick: () => comingSoon("Duplicate plan", "Clone to a new date next.") },
          { kind: "ghost", label: "Templates", onClick: () => comingSoon("Templates", "Save/load reusable plans next.") },
          { kind: "primary", label: "Publish to team", onClick: () => toast.success("Plan published", { description: "22 players + 4 coaches notified." }) },
        ]}
      />
      <div className="flex-1 overflow-auto px-8 pt-6 pb-12">
        <div className="max-w-layout-app mx-auto">
          <PageHeader />
          <div className="grid grid-cols-[260px_1fr_320px] gap-5 mt-6">
            <DrillLibrary />
            <PlanColumn />
            <RightColumn />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page header ──────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
          Practice planner
        </h1>
        <div className="text-[13.5px] text-ink-3 mt-1">
          Build today&apos;s practice. Drag drills from the library, rearrange blocks,
          assign groups.
        </div>
        <div className="flex gap-3 items-center mt-2 text-[12.5px] text-ink-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-card border border-hair font-mono text-[11px] font-semibold text-ink-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber" /> DRAFT
          </span>
          <span>Last edited 12m ago · Coach Ruiz</span>
          <span className="text-ink-4">·</span>
          <span>2 coaches viewing</span>
        </div>
      </div>
      <div className="flex gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => comingSoon("Previous practice", "Navigate between past plans — next sprint.")}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous: Apr 19
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => comingSoon("Next practice", "Navigate between future plans — next sprint.")}
        >
          Next: Apr 24
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Drill library ────────────────────────────────────────────

interface Drill {
  name: string;
  duration: string;
  focus: string;
  cat: "hit" | "fld" | "thr" | "run" | "cond" | "game";
}

const CAT_COLORS: Record<Drill["cat"], string> = {
  hit: "bg-red",
  fld: "bg-grass",
  thr: "bg-sky",
  run: "bg-amber",
  cond: "bg-dirt",
  game: "bg-ink",
};

const LIBRARY: { heading: string; count: number; drills: Drill[] }[] = [
  {
    heading: "Hitting",
    count: 42,
    drills: [
      { name: "Tee work — inside/outside", duration: "15m", focus: "3 stations · 30 reps/ea", cat: "hit" },
      { name: "Front toss — two strikes", duration: "20m", focus: "Focus: shorten up, battle", cat: "hit" },
      { name: "Machine BP — offspeed", duration: "25m", focus: "Cage 2 · 60 mph · slider", cat: "hit" },
    ],
  },
  {
    heading: "Fielding",
    count: 58,
    drills: [
      { name: "Infield groundballs", duration: "20m", focus: "Short hop, backhand, slow roller", cat: "fld" },
      { name: "Double play turn — 6 to 4", duration: "15m", focus: "Footwork + exchange", cat: "fld" },
      { name: "Outfield crossover + read", duration: "15m", focus: "Fly ball reads, tracking", cat: "fld" },
    ],
  },
  {
    heading: "Throwing / pitching",
    count: 34,
    drills: [
      { name: "Long toss progression", duration: "12m", focus: "45 → 90 → 120 ft", cat: "thr" },
      { name: "Bullpen — 25 pitch", duration: "15m", focus: "Peña, Riggs, Washington", cat: "thr" },
    ],
  },
  {
    heading: "Base running",
    count: 18,
    drills: [
      { name: "Secondary leads + read", duration: "10m", focus: "1st → 2nd on contact", cat: "run" },
    ],
  },
  {
    heading: "Conditioning",
    count: 12,
    drills: [
      { name: "Pole to pole x 4", duration: "8m", focus: "50% · 75% · 90% · 100%", cat: "cond" },
    ],
  },
];

function DrillLibrary() {
  const [activeCat, setActiveCat] = useState<"All" | "Hitting" | "Fielding" | "Throwing" | "Base run">("All");
  return (
    <div className="bg-card border border-hair rounded-lg self-start sticky top-[72px]">
      <div className="px-[18px] py-3.5 border-b border-hair-2 flex items-center gap-2.5">
        <h3 className="font-display text-[14px] font-semibold tracking-tight">Drill library</h3>
        <span className="ml-auto font-mono text-[10.5px] text-ink-3 font-semibold">214 DRILLS</span>
      </div>
      <div className="px-4 pt-3 pb-2">
        <Input
          placeholder="Search drills, focus…"
          icon={<Search className="w-3.5 h-3.5" />}
        />
      </div>
      <div className="flex gap-1 px-3.5 pb-2.5 flex-wrap">
        {(["All", "Hitting", "Fielding", "Throwing", "Base run"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setActiveCat(c)}
            className={cn(
              "px-2 py-1 rounded-full text-[10.5px] font-semibold transition-colors",
              activeCat === c ? "bg-ink text-white" : "bg-paper text-ink-2 hover:text-ink",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="pb-3 max-h-[calc(100vh-220px)] overflow-auto">
        {LIBRARY.map((section) => (
          <div key={section.heading}>
            <div className="px-3.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-3">
              {section.heading} · {section.count}
            </div>
            {section.drills.map((d) => (
              <div
                key={d.name}
                className="mx-2 mb-1 px-2.5 py-2 rounded-sm cursor-grab border border-transparent hover:bg-paper hover:border-hair transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", CAT_COLORS[d.cat])} />
                  <span className="text-[12.5px] font-semibold flex-1 leading-tight">{d.name}</span>
                  <span className="font-mono text-[10.5px] text-ink-3 font-semibold">{d.duration}</span>
                </div>
                <div className="text-[10.5px] text-ink-3 mt-0.5 ml-[13px] leading-tight">{d.focus}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Plan column ──────────────────────────────────────────────

interface Block {
  start: string;
  duration: string;
  cat: string;
  name: string;
  focus: string;
  meta?: { label: string; value?: string; avatars?: { initials: string; color: "red" | "sky" | "grass" | "dirt" | "gold" | "amber" | "ink" | "ink2" }[] }[];
  color: "warm" | "throw" | "fld" | "hit" | "game" | "cool";
}

const BLOCKS: Block[] = [
  {
    start: "3:30", duration: "15 min", cat: "WARM-UP",
    name: "Dynamic warm + band work",
    focus: "J-bands, hip openers, leg swings. Then 3 laps at 60%.",
    color: "warm",
    meta: [
      { label: "Group", value: "Whole team" },
      { label: "Field", value: "Main" },
      { label: "Lead", value: "Coach Park" },
    ],
  },
  {
    start: "3:45", duration: "12 min", cat: "THROWING",
    name: "Long toss progression — 45/90/120 ft",
    focus: "Crisp rotations. Build intent. Short arm slot on low tosses.",
    color: "throw",
    meta: [
      { label: "Group", value: "Whole team, partners" },
      { label: "Reps", value: "~35 throws each" },
    ],
  },
  {
    start: "3:57", duration: "20 min", cat: "FIELDING · SPLIT",
    name: "Infield groundballs / Outfield crossover + read",
    focus: "Focus on the short hop + backhand for IF. Fly ball tracking for OF.",
    color: "fld",
    meta: [
      { label: "Group A (IF)", avatars: [{ initials: "JK", color: "sky" }, { initials: "DB", color: "grass" }, { initials: "SH", color: "ink2" }, { initials: "EL", color: "red" }] },
      { label: "Group B (OF)", avatars: [{ initials: "MJ", color: "ink" }, { initials: "NP", color: "red" }, { initials: "JB", color: "gold" }] },
      { label: "Lead", value: "Ruiz + Park" },
    ],
  },
  {
    start: "4:17", duration: "28 min", cat: "HITTING · 3 STATIONS ROTATING",
    name: "Tee inside/out → Front toss 2K → Machine BP",
    focus: "Each group 9 min per station. Reinforce 2-strike approach — shorten up.",
    color: "hit",
    meta: [
      { label: "Station 1 tee", value: "Main cage" },
      { label: "Station 2 front toss", value: "Cage 2" },
      { label: "Station 3 machine", value: "60mph slider" },
    ],
  },
  {
    start: "4:45", duration: "15 min", cat: "BULLPEN (PARALLEL)",
    name: "25-pitch bullpen — Peña, Riggs, Washington",
    focus: "Mix FB/CH/SL 60/25/15. Log pitch count in Rostr.",
    color: "throw",
    meta: [
      { label: "Pitchers", avatars: [{ initials: "CP", color: "sky" }, { initials: "AR", color: "dirt" }, { initials: "MW", color: "grass" }] },
      { label: "Catcher", value: "Mbeki" },
      { label: "Lead", value: "Coach Vega" },
    ],
  },
  {
    start: "5:00", duration: "22 min", cat: "SITUATIONAL",
    name: "Live defense — 1st & 3rd, runner at 2nd",
    focus: "Working the problem we saw vs. Westside — cutoffs + relay reads.",
    color: "game",
    meta: [
      { label: "Group", value: "Whole team · 3 innings" },
      { label: "Scoreboard", value: "OFF (teaching)" },
      { label: "Lead", value: "Coach Ruiz" },
    ],
  },
  {
    start: "5:22", duration: "8 min", cat: "COOL-DOWN",
    name: "Pole to pole x4 + stretch",
    focus: "50 / 75 / 90 / 100% intent. Team huddle to close.",
    color: "cool",
  },
];

const BLOCK_COLORS: Record<Block["color"], { bg: string; border: string }> = {
  warm: { bg: "bg-paper", border: "border-l-amber" },
  throw: { bg: "bg-paper", border: "border-l-sky" },
  fld: { bg: "bg-paper", border: "border-l-grass" },
  hit: { bg: "bg-paper", border: "border-l-red" },
  game: { bg: "bg-paper", border: "border-l-ink" },
  cool: { bg: "bg-paper", border: "border-l-dirt" },
};

function PlanColumn() {
  return (
    <div className="flex flex-col gap-5">
      <div className="bg-card border border-hair rounded-lg">
        <div className="p-5 border-b border-hair-2 flex items-start gap-3">
          <div className="flex-1">
            <div className="font-display text-[20px] font-semibold tracking-[-0.02em]">
              Wed · Apr 22 · Full practice
            </div>
            <div className="font-mono text-[12.5px] text-ink-3 mt-0.5">
              3:30 PM – 5:30 PM · Main field + Cage 2 · 22 players
            </div>
            <div className="flex gap-1.5 mt-1.5">
              <span className="px-1.5 py-0.5 bg-ink text-white rounded-xs text-[10px] font-bold tracking-[0.04em]">
                ● AI DRAFTED
              </span>
              <span className="px-1.5 py-0.5 bg-grass-dim text-grass rounded-xs text-[10px] font-bold tracking-[0.04em]">
                READY TO PUBLISH
              </span>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => comingSoon("Preview", "Print-friendly + player-share preview — next sprint.")}
            >
              Preview
            </Button>
            <Button
              variant="red"
              size="sm"
              onClick={() => toast.success("Plan saved", { description: "Draft saved. Hit Publish to notify the team." })}
            >
              Save plan
            </Button>
          </div>
        </div>

        <PlanTotals />
        <Timeline />

        <div className="p-5 flex flex-col gap-2.5">
          {BLOCKS.map((b, i) => (
            <BlockRow key={i} block={b} />
          ))}
          <button className="mt-1 py-3 border-2 border-dashed border-hair rounded-md text-[12.5px] font-medium text-ink-3 hover:border-ink hover:text-ink transition-colors">
            + Drop a drill here, or type a block
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanTotals() {
  const totals = [
    { l: "Total time", v: "2:00", sub: "hrs" },
    { l: "Swings", v: "~450" },
    { l: "Ground balls", v: "~180" },
    { l: "Throws logged", v: "~220" },
  ];
  return (
    <div className="grid grid-cols-4 border-b border-hair-2">
      {totals.map((t, i) => (
        <div
          key={i}
          className={cn("p-4", i < totals.length - 1 && "border-r border-hair-2")}
        >
          <div className="type-label">{t.l}</div>
          <div className="font-mono text-[20px] font-semibold tracking-[-0.02em] mt-1">
            {t.v}
            {t.sub && <span className="text-[12px] text-ink-3 ml-1 font-normal">{t.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Timeline() {
  const segs = [
    { l: "Warm", bg: "bg-dirt", width: "12%" },
    { l: "Throw", bg: "bg-sky", width: "10%" },
    { l: "Fielding", bg: "bg-grass", width: "17%" },
    { l: "Hitting", bg: "bg-red", width: "23%" },
    { l: "Bullpen", bg: "bg-sky", width: "13%" },
    { l: "Situational", bg: "bg-ink", width: "18%" },
    { l: "Cool", bg: "bg-dirt", width: "7%" },
  ];
  return (
    <div className="p-5 border-b border-hair-2">
      <div className="flex justify-between text-[10px] font-mono text-ink-3 font-semibold mb-1.5 pl-16">
        <span>3:30</span>
        <span>4:00</span>
        <span>4:30</span>
        <span>5:00</span>
        <span>5:30</span>
      </div>
      <div className="flex ml-16 h-11 rounded-md overflow-hidden">
        {segs.map((s) => (
          <div
            key={s.l + s.width}
            className={cn("flex items-center justify-center text-white text-[9.5px] font-semibold", s.bg)}
            style={{ width: s.width }}
          >
            {s.l}
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockRow({ block }: { block: Block }) {
  const c = BLOCK_COLORS[block.color];
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-14 text-center pt-2">
        <div className="font-mono text-[14px] font-bold">{block.start}</div>
        <div className="font-mono text-[10.5px] text-ink-3">{block.duration}</div>
      </div>
      <div
        className={cn(
          "flex-1 rounded-md p-3.5 border-l-[3px] border",
          c.bg,
          c.border,
          "border-hair",
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="type-label">{block.cat}</span>
          <span className="font-display text-[15px] font-semibold tracking-tight flex-1">
            {block.name}
          </span>
          <button className="text-ink-3 hover:text-ink p-0.5">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[11px] italic text-ink-3 mt-1">{block.focus}</div>
        {block.meta && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-[11px]">
            {block.meta.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-ink-3">
                {m.label}:{" "}
                {m.value && <b className="text-ink font-semibold">{m.value}</b>}
                {m.avatars && (
                  <span className="flex -space-x-1.5">
                    {m.avatars.map((a, j) => (
                      <span
                        key={j}
                        className="ring-2 ring-paper rounded-full"
                      >
                        <Avatar size="sm" color={a.color} initials={a.initials} />
                      </span>
                    ))}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Right column (AI + Field runner) ────────────────────────

function RightColumn() {
  return (
    <div className="flex flex-col gap-5 self-start sticky top-[72px]">
      <AICard />
      <FieldRunnerCard />
    </div>
  );
}

function AICard() {
  return (
    <div className="relative overflow-hidden bg-ink text-white rounded-lg p-5">
      <div
        aria-hidden
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(200,58,58,.25), transparent 70%)",
        }}
      />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 text-[10px] text-red font-bold uppercase tracking-[0.12em]">
          <Zap className="w-3 h-3" />
          AI co-coach
        </div>
        <h4 className="mt-1.5 font-display text-[16px] font-semibold tracking-tight leading-snug">
          Draft a practice for me.
        </h4>
        <div className="mt-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-md text-[12px] leading-relaxed">
          Generated this plan from:{" "}
          <b className="font-semibold">
            &ldquo;We lost 4-2 to Westside. Struggled with cutoffs. Peña and Riggs need
            bullpen.&rdquo;
          </b>
        </div>
        <div className="mt-2.5 space-y-1.5">
          {[
            "→ Add more 2-strike situational hitting?",
            "→ Cut cool-down to 5m, add run-down block?",
            "→ Shift to Tue–Thu split practice?",
          ].map((p) => (
            <button
              key={p}
              onClick={() => comingSoon("AI suggestion applied", "Live AI practice editing wires to Claude in next sprint.")}
              className="w-full text-left px-2.5 py-2 bg-white/5 hover:bg-white/10 rounded-sm text-[12px] transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FieldRunnerCard() {
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
            Dynamic warm + band work
          </div>
          <div className="font-mono text-[11px] text-white/65 mt-2 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            3:30 · 15 min
          </div>
          <div className="mt-4 flex gap-1.5">
            <button
              onClick={() => comingSoon("Add note", "Voice + text notes attached to player / block — next sprint.")}
              className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 rounded-sm text-[11.5px] font-bold"
            >
              + Note
            </button>
            <button
              onClick={() => toast.success("Practice started", { description: "Field-runner mode launched. Your phone takes over." })}
              className="flex-[2] py-2.5 bg-red hover:bg-red/90 rounded-sm text-[11.5px] font-bold inline-flex items-center justify-center gap-1.5"
            >
              <Play className="w-3 h-3" />
              Start practice
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="text-[10px] font-bold text-ink-3 uppercase tracking-[0.08em]">
            Then
          </div>
          {BLOCKS.slice(1, 4).map((b, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2.5 py-2 bg-paper rounded-sm"
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  BLOCK_COLORS[b.color].border.replace("border-l-", "bg-"),
                )}
              />
              <span className="text-[12px] font-semibold flex-1 truncate">{b.cat}</span>
              <span className="font-mono text-[10.5px] text-ink-3 font-semibold">
                {b.start}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
