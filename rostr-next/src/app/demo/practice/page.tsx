import { PracticeEditor } from "@/app/app/practice/editor";
import type {
  PracticeDrill,
  PracticePlan,
  PracticePlanWithBlocks,
  PlanCategory,
  PlanLane,
} from "@/lib/services/practice-plans";
import { MOCK_TEAM } from "@/lib/mock-data";

/**
 * /demo/practice — interactive Practice planner with mock plan + library.
 *
 * Renders the same PracticeEditor used in /app/practice. Adding
 * blocks, generating AI plans, etc. all work as far as the UI flow
 * goes; the underlying server actions toast errors because there's no
 * coach context (intentional friction toward signup).
 */
export const metadata = {
  title: "Practice planner · Demo · Rostr",
  robots: { index: false, follow: false },
};

// PracticeEditor uses useSearchParams() at the client; mark this route
// dynamic so Next.js doesn't try to prerender it (which would CSR-bail).
export const dynamic = "force-dynamic";

const DEMO_PROGRAM_ID = "demo-program";
const DEMO_TODAY = new Date().toISOString().slice(0, 10);

const DEMO_DRILLS: PracticeDrill[] = [
  // Hitting
  { id: "d1",  programId: DEMO_PROGRAM_ID, name: "Tee work — inside/outside",     defaultDuration: 15, focus: "3 stations · 30 reps each",      category: "hit" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  { id: "d2",  programId: DEMO_PROGRAM_ID, name: "Front toss — two strikes",      defaultDuration: 20, focus: "Shorten up, battle approach",   category: "hit" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  { id: "d3",  programId: DEMO_PROGRAM_ID, name: "Live BP — game speed",          defaultDuration: 30, focus: "Coach throws, full count",      category: "hit" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  // Defense
  { id: "d4",  programId: DEMO_PROGRAM_ID, name: "Infield groundballs",           defaultDuration: 20, focus: "Short hop, backhand",           category: "def" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  { id: "d5",  programId: DEMO_PROGRAM_ID, name: "Double play turn — 6 to 4",     defaultDuration: 15, focus: "Footwork + exchange",           category: "def" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  { id: "d6",  programId: DEMO_PROGRAM_ID, name: "Outfield crossover + read",     defaultDuration: 15, focus: "Fly ball reads, tracking",      category: "def" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  { id: "d7",  programId: DEMO_PROGRAM_ID, name: "Cutoffs + relays",              defaultDuration: 18, focus: "Outfield → cutoff → tag",       category: "def" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  // Pitching
  { id: "d8",  programId: DEMO_PROGRAM_ID, name: "Bullpen — 25 pitch",            defaultDuration: 15, focus: "FB/CH/SL mix",                  category: "pitch" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  { id: "d9",  programId: DEMO_PROGRAM_ID, name: "PFP — pitcher fielding",        defaultDuration: 15, focus: "Comebackers, covers, bunts",    category: "pitch" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  // Baserunning
  { id: "d10", programId: DEMO_PROGRAM_ID, name: "Stealing 2nd — jump work",      defaultDuration: 15, focus: "Lead, primary, secondary, dive", category: "bases" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  // Conditioning
  { id: "d11", programId: DEMO_PROGRAM_ID, name: "Pole to pole x 4",              defaultDuration: 8,  focus: "50/75/90/100% intent",          category: "cond" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  // Warm + cool
  { id: "d12", programId: DEMO_PROGRAM_ID, name: "Dynamic warm + bands",          defaultDuration: 15, focus: "J-bands, hip openers",          category: "warm" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  { id: "d13", programId: DEMO_PROGRAM_ID, name: "Long toss progression",         defaultDuration: 12, focus: "45 → 90 → 120 ft buildup",       category: "warm" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
  { id: "d14", programId: DEMO_PROGRAM_ID, name: "Team stretch + huddle",         defaultDuration: 8,  focus: "Static stretch, message",       category: "cool" as PlanCategory, source: "library", createdBy: null, createdAt: "" },
];

const DEMO_PLAN: PracticePlanWithBlocks = {
  id: "demo-plan-today",
  programId: DEMO_PROGRAM_ID,
  planDate: DEMO_TODAY,
  name: "Today's practice — situational hitting",
  status: "draft",
  fieldConstraint: "full_field",
  aiBriefText: null,
  teamLevel: "Varsity",
  createdBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  blocks: [
    { id: "b1", planId: "demo-plan-today", sequence: 1, lane: "main" as PlanLane,      category: "warm" as PlanCategory,  drillName: "Dynamic warm + bands",      focusText: "J-bands, hip openers",                durationMin: 15, drillId: "d12" },
    { id: "b2", planId: "demo-plan-today", sequence: 2, lane: "main" as PlanLane,      category: "hit" as PlanCategory,   drillName: "Tee work — inside/outside", focusText: "3 stations · 30 reps each",          durationMin: 15, drillId: "d1"  },
    { id: "b3", planId: "demo-plan-today", sequence: 3, lane: "main" as PlanLane,      category: "hit" as PlanCategory,   drillName: "Front toss — two strikes",  focusText: "Shorten up, battle approach",        durationMin: 20, drillId: "d2"  },
    { id: "b4", planId: "demo-plan-today", sequence: 4, lane: "secondary" as PlanLane, category: "pitch" as PlanCategory, drillName: "Bullpen — 25 pitch",        focusText: "FB/CH/SL mix",                       durationMin: 20, drillId: "d8"  },
    { id: "b5", planId: "demo-plan-today", sequence: 5, lane: "main" as PlanLane,      category: "def" as PlanCategory,   drillName: "Infield groundballs",       focusText: "Short hop, backhand",                durationMin: 20, drillId: "d4"  },
    { id: "b6", planId: "demo-plan-today", sequence: 6, lane: "main" as PlanLane,      category: "cool" as PlanCategory,  drillName: "Team stretch + huddle",     focusText: "Message of the day",                  durationMin: 8,  drillId: "d14" },
  ],
};

const DEMO_RECENT_PLANS: PracticePlan[] = [
  { ...DEMO_PLAN, blocks: undefined as unknown as never } as PracticePlan,
];

export default function DemoPracticePage() {
  return (
    <PracticeEditor
      programId={DEMO_PROGRAM_ID}
      programName={MOCK_TEAM.name}
      programLevels={["Varsity"]}
      today={DEMO_TODAY}
      activePlan={DEMO_PLAN}
      recentPlans={DEMO_RECENT_PLANS}
      drillLibrary={DEMO_DRILLS}
    />
  );
}
