import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * AI Assistant Coach — server-side integration with Anthropic Claude.
 *
 * Design intent:
 * - All inference runs server-side. The API key never leaves the
 *   rostr-next server — client components call a server action, not
 *   the Anthropic API directly.
 * - Context is assembled from live program data (roster, next game,
 *   recent scores) so responses are rooted in the coach's actual
 *   situation, not generic baseball advice.
 * - Responses are short + actionable by default. The system prompt
 *   pins tone and length.
 * - If ANTHROPIC_API_KEY is unset, every caller gets a structured
 *   "not configured" response instead of a crash — the UI renders a
 *   friendly setup card.
 */

export interface AICoachContext {
  programName: string;
  coachName: string;
  todayISO: string;
  teams: string[];
  rosterSummary: {
    total: number;
    byLevel: Record<string, number>;
    availableToday: number;
    unavailableToday: number;
    questionableToday: number;
  };
  nextGame: {
    opponent: string;
    date: string;
    location: string | null;
    homeAway: string;
    teamLevel: string | null;
  } | null;
  topPerformers: Array<{
    name: string;
    level: string;
    stationShortCode: string;
    value: number;
    unit: string | null;
  }>;
  recentNotes: Array<{
    playerName: string;
    content: string;
    when: string;
  }>;
}

export type AICoachIntent =
  | "lineup_suggestion"
  | "generate_lineup" // uses tool use → returns structured lineup ready to apply
  | "practice_plan"
  | "tryout_analysis"
  | "pep_talk"
  | "custom";

export interface AICoachRequest {
  intent: AICoachIntent;
  customPrompt?: string;
}

export interface AICoachResponse {
  ok: boolean;
  error?: string;
  notConfigured?: boolean;
  message?: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  /** For generate_lineup intent: structured lineup ready to apply. */
  lineup?: {
    gameId: string;
    entries: Array<{
      battingOrder: number;
      playerId: string;
      playerName: string;
      position: string;
      reason: string;
    }>;
  };
}

// Cheapest current Claude model — Haiku handles tool-use well enough
// for structured outputs like lineups and practice plans (which is the
// only AI surface in the app). Roughly 1/10th the cost of Sonnet per
// generation; latency is also lower (~1.5-3s vs 3-8s). Bump to Sonnet
// later if quality becomes a complaint.
const MODEL = "claude-haiku-4-5";
const MAX_OUTPUT_TOKENS = 900;

function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Gathers the live program context for a coach. Pulls only what the
 * model needs to give good answers — not the entire DB.
 */
export async function gatherAICoachContext(
  programId: string,
  coachName: string,
  programName: string,
  programLevels: string[],
): Promise<AICoachContext> {
  const supabase = createSupabaseServerClient();
  const todayISO = new Date().toISOString().slice(0, 10);

  const [
    playersRes,
    assignmentsRes,
    nextGameRes,
    topScoresRes,
    recentNotesRes,
  ] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name, availability_status")
      .eq("program_id", programId),
    supabase
      .from("roster_assignments")
      .select("player_id, assignment")
      .eq("program_id", programId),
    supabase
      .from("games")
      .select("opponent, game_date, location, home_away, team_level")
      .eq("program_id", programId)
      .gte("game_date", todayISO)
      .order("game_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("player_best_measurables")
      .select("player_id, short_code, station_name, unit, best_value, score_type")
      .limit(50),
    supabase
      .from("player_notes")
      .select("content, created_at, players:player_id(first_name, last_name, program_id)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const players = playersRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const assignMap = new Map(assignments.map((a) => [a.player_id, a.assignment]));

  const byLevel: Record<string, number> = {};
  let availableToday = 0;
  let unavailableToday = 0;
  let questionableToday = 0;
  for (const p of players) {
    const lvl = assignMap.get(p.id) ?? "unassigned";
    byLevel[lvl] = (byLevel[lvl] ?? 0) + 1;
    if (p.availability_status === "ok") availableToday++;
    else if (p.availability_status === "out") unavailableToday++;
    else if (p.availability_status === "questionable") questionableToday++;
  }

  // Top performers: for each station short_code, pick the 1-2 highest
  // (or lowest for time-based) values across our players.
  const playerIdToName = new Map(
    players.map((p) => [p.id, `${p.first_name} ${p.last_name}`]),
  );
  const stationGroups = new Map<
    string,
    Array<{
      playerId: string;
      name: string;
      unit: string | null;
      value: number;
      scoreType: string;
    }>
  >();
  for (const s of topScoresRes.data ?? []) {
    const arr = stationGroups.get(s.short_code) ?? [];
    arr.push({
      playerId: s.player_id,
      name: s.station_name,
      unit: s.unit,
      value: Number(s.best_value),
      scoreType: s.score_type,
    });
    stationGroups.set(s.short_code, arr);
  }
  const topPerformers: AICoachContext["topPerformers"] = [];
  for (const [shortCode, arr] of Array.from(stationGroups.entries())) {
    const sorted = [...arr].sort((a, b) =>
      a.scoreType === "lower_better" ? a.value - b.value : b.value - a.value,
    );
    const top = sorted[0];
    if (!top) continue;
    const playerName = playerIdToName.get(top.playerId);
    if (!playerName) continue;
    const level = assignMap.get(top.playerId) ?? "unassigned";
    topPerformers.push({
      name: playerName,
      level,
      stationShortCode: shortCode,
      value: top.value,
      unit: top.unit,
    });
  }

  const recentNotes: AICoachContext["recentNotes"] = [];
  for (const n of recentNotesRes.data ?? []) {
    const player = Array.isArray(n.players) ? n.players[0] : n.players;
    if (!player || player.program_id !== programId) continue;
    recentNotes.push({
      playerName: `${player.first_name} ${player.last_name}`,
      content: (n.content ?? "").slice(0, 200),
      when: new Date(n.created_at).toLocaleDateString(),
    });
    if (recentNotes.length >= 5) break;
  }

  return {
    programName,
    coachName,
    todayISO,
    teams: programLevels,
    rosterSummary: {
      total: players.length,
      byLevel,
      availableToday,
      unavailableToday,
      questionableToday,
    },
    nextGame: nextGameRes.data
      ? {
          opponent: nextGameRes.data.opponent,
          date: nextGameRes.data.game_date,
          location: nextGameRes.data.location,
          homeAway: nextGameRes.data.home_away ?? "home",
          teamLevel: nextGameRes.data.team_level,
        }
      : null,
    topPerformers,
    recentNotes,
  };
}

/**
 * Builds the user message Claude receives for a given intent.
 */
function buildIntentPrompt(intent: AICoachIntent, custom?: string): string {
  switch (intent) {
    case "lineup_suggestion":
      return "Propose a starting batting order + defensive positions for the next game based on who's available and recent performance. Keep it to one lineup + a 1-2 sentence reason per choice.";
    case "generate_lineup":
      // Handled by generateLineup() via tool use — not routed through
      // askAICoach, but keep a fallback string so TS sees all cases.
      return "Draft a starting lineup using the propose_lineup tool.";
    case "practice_plan":
      return "Draft a 90-minute practice plan for this week. Focus on the weakest areas you can infer from the notes + tryout data. Give me 4-6 time blocks with an activity + goal.";
    case "tryout_analysis":
      return "Summarize the current tryout picture: top 3 standouts, 2-3 on the bubble, and what I should watch for in the next session.";
    case "pep_talk":
      return "Write a 4-sentence pre-game talk I can give the team. Tie it to our current stats or a recent note.";
    case "custom":
      return custom?.trim() || "What should I focus on today?";
  }
}

function buildSystemPrompt(ctx: AICoachContext): string {
  return [
    `You are Rostr's AI Assistant Coach — an assistant for ${ctx.coachName}, head of ${ctx.programName}.`,
    `Your job: practical, specific, short. Never generic "work hard and practice" advice.`,
    `Use the context below. If data is missing, acknowledge it briefly instead of inventing numbers.`,
    ``,
    `## Context (live program data, ${ctx.todayISO})`,
    `- Teams: ${ctx.teams.join(", ")}`,
    `- Roster: ${ctx.rosterSummary.total} players total. By level: ${Object.entries(
      ctx.rosterSummary.byLevel,
    )
      .map(([l, n]) => `${l}=${n}`)
      .join(", ")}.`,
    `- Availability today: ${ctx.rosterSummary.availableToday} available, ${ctx.rosterSummary.questionableToday} questionable, ${ctx.rosterSummary.unavailableToday} out.`,
    ctx.nextGame
      ? `- Next game: ${ctx.nextGame.homeAway === "home" ? "vs" : "@"} ${ctx.nextGame.opponent} on ${ctx.nextGame.date}${ctx.nextGame.location ? ` at ${ctx.nextGame.location}` : ""}${ctx.nextGame.teamLevel ? ` (${ctx.nextGame.teamLevel})` : ""}.`
      : "- No upcoming games scheduled.",
    ctx.topPerformers.length > 0
      ? `- Top tryout measurables: ${ctx.topPerformers
          .slice(0, 5)
          .map(
            (p) =>
              `${p.name} (${p.level}) ${p.stationShortCode} ${p.value}${p.unit ?? ""}`,
          )
          .join("; ")}.`
      : "- No tryout measurables captured yet.",
    ctx.recentNotes.length > 0
      ? `- Recent coach notes:\n${ctx.recentNotes
          .map((n) => `  - ${n.when} · ${n.playerName}: ${n.content}`)
          .join("\n")}`
      : "- No recent coach notes.",
    ``,
    `## Output format`,
    `- Markdown. Use headings (##) and short bullet lists.`,
    `- Open with a 1-sentence TL;DR.`,
    `- Cap response at ~${MAX_OUTPUT_TOKENS / 3} words.`,
  ].join("\n");
}

/**
 * askAICoach — one-shot, non-streaming call. Returns the full message
 * at once. A future upgrade will stream tokens to the UI.
 */
export async function askAICoach(
  ctx: AICoachContext,
  req: AICoachRequest,
): Promise<AICoachResponse> {
  if (!isConfigured()) {
    return {
      ok: false,
      notConfigured: true,
      error:
        "AI Assistant Coach isn't configured. Set ANTHROPIC_API_KEY in your environment to turn it on.",
    };
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const system = buildSystemPrompt(ctx);
  const userPrompt = buildIntentPrompt(req.intent, req.customPrompt);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const message = textBlock && "text" in textBlock ? textBlock.text : "";
    return {
      ok: true,
      message,
      model: response.model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: msg || "AI Assistant Coach failed to respond.",
    };
  }
}

/**
 * Extended context for lineup generation. Adds the next-game target
 * + eligible roster w/ player IDs so Claude can return a tool-call
 * with real IDs, not just names.
 */
export interface AILineupContext extends AICoachContext {
  nextGameId: string | null;
  nextGameLevel: string | null;
  eligibleRoster: Array<{
    id: string;
    name: string;
    jersey: number | null;
    positions: string[];
    bats: string | null;
    throws: string | null;
    ba: string | null;
  }>;
}

export async function gatherLineupContext(
  baseCtx: AICoachContext,
  programId: string,
): Promise<AILineupContext> {
  const supabase = createSupabaseServerClient();
  const todayISO = new Date().toISOString().slice(0, 10);

  // Find next game (any level)
  const { data: game } = await supabase
    .from("games")
    .select("id, team_level")
    .eq("program_id", programId)
    .gte("game_date", todayISO)
    .order("game_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!game) {
    return {
      ...baseCtx,
      nextGameId: null,
      nextGameLevel: null,
      eligibleRoster: [],
    };
  }

  // Eligible roster = players assigned to that team level who are
  // available (ok or questionable).
  const teamLevel = (game.team_level ?? "").toLowerCase();
  const { data: assignments } = await supabase
    .from("roster_assignments")
    .select("player_id, assignment")
    .eq("program_id", programId);
  const onLevel = new Set(
    (assignments ?? [])
      .filter((a) => a.assignment.toLowerCase() === teamLevel)
      .map((a) => a.player_id),
  );

  const { data: players } = await supabase
    .from("players")
    .select("id, first_name, last_name, player_number, positions, bats, throws, availability_status")
    .eq("program_id", programId);

  const eligible = (players ?? [])
    .filter((p) => onLevel.has(p.id))
    .filter((p) => p.availability_status !== "out")
    .map((p) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      jersey: p.player_number,
      positions: (p.positions ?? []) as string[],
      bats: p.bats,
      throws: p.throws,
      ba: null as string | null,
    }));

  return {
    ...baseCtx,
    nextGameId: game.id,
    nextGameLevel: game.team_level,
    eligibleRoster: eligible,
  };
}

/**
 * generateLineup — uses Claude tool use to get back a structured,
 * applicable lineup. If successful, the response includes a `lineup`
 * object the UI can apply in one click via setLineupAction.
 */
export async function generateLineup(
  ctx: AILineupContext,
): Promise<AICoachResponse> {
  if (!isConfigured()) {
    return {
      ok: false,
      notConfigured: true,
      error: "AI Assistant Coach isn't configured.",
    };
  }
  if (!ctx.nextGameId || ctx.eligibleRoster.length < 9) {
    return {
      ok: false,
      error:
        ctx.nextGameId == null
          ? "No upcoming games to build a lineup for."
          : `Need 9 available players, only ${ctx.eligibleRoster.length} on the roster level.`,
    };
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const system = [
    `You are Rostr's AI Assistant Coach. Build a 9-slot baseball lineup for ${ctx.coachName}'s next game.`,
    ``,
    `## Context`,
    `Next game: ${ctx.nextGame?.homeAway === "home" ? "vs" : "@"} ${ctx.nextGame?.opponent}, ${ctx.nextGame?.date}${ctx.nextGame?.teamLevel ? ` (${ctx.nextGame.teamLevel})` : ""}`,
    ``,
    `## Eligible roster`,
    ctx.eligibleRoster
      .map(
        (p) =>
          `- ${p.name} (id=${p.id}, #${p.jersey ?? "-"}, ${p.positions.join("/") || "?"}, bats=${p.bats ?? "?"}/throws=${p.throws ?? "?"})`,
      )
      .join("\n"),
    ``,
    `## Rules`,
    `- Exactly 9 batting slots (1-9).`,
    `- Positions: pick from P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH. No duplicates except DH replacing P in AL-style lineups.`,
    `- Use the propose_lineup tool to submit the final lineup. All player_ids MUST come from the eligible roster above.`,
    `- For each slot include a ONE-sentence reason tied to the player's data.`,
  ].join("\n");

  const tool = {
    name: "propose_lineup",
    description:
      "Submit a 9-slot starting lineup with player_id, batting order, position, and a short reason per slot.",
    input_schema: {
      type: "object" as const,
      properties: {
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              batting_order: { type: "integer", minimum: 1, maximum: 9 },
              player_id: { type: "string" },
              position: { type: "string" },
              reason: { type: "string" },
            },
            required: ["batting_order", "player_id", "position", "reason"],
          },
        },
        summary: { type: "string", description: "2-3 sentence overall strategy note." },
      },
      required: ["entries", "summary"],
    },
  };

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1800,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: "propose_lineup" },
      messages: [
        {
          role: "user",
          content:
            "Draft the starting lineup for the next game. Optimize for who's available and their typical positions.",
        },
      ],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return { ok: false, error: "AI didn't return a lineup." };
    }
    const input = toolBlock.input as {
      entries: Array<{
        batting_order: number;
        player_id: string;
        position: string;
        reason: string;
      }>;
      summary: string;
    };

    // Validate every player_id is actually in the eligible roster.
    const idToName = new Map(ctx.eligibleRoster.map((p) => [p.id, p.name]));
    const validEntries = input.entries.filter((e) => idToName.has(e.player_id));
    if (validEntries.length < 9) {
      return {
        ok: false,
        error: `AI returned ${validEntries.length} valid slots (needed 9). Retry.`,
      };
    }

    return {
      ok: true,
      message: input.summary,
      model: response.model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      lineup: {
        gameId: ctx.nextGameId,
        entries: validEntries.slice(0, 9).map((e) => ({
          battingOrder: e.batting_order,
          playerId: e.player_id,
          playerName: idToName.get(e.player_id) ?? "?",
          position: e.position,
          reason: e.reason,
        })),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Lineup generation failed." };
  }
}

// ── Practice plan generation (tool use → structured blocks) ──

/**
 * Categories the planner uses. Mirrors PlanCategory in
 * src/lib/services/practice-plans.ts. Kept as a literal here so
 * the AI service has zero runtime dependency on the planner module.
 */
export type AIPlanCategory =
  | "hit"
  | "def"
  | "bases"
  | "pitch"
  | "cond"
  | "warm"
  | "cool";

export type AIPlanLane = "main" | "secondary";

export type AIFieldConstraint =
  | "full_field"
  | "cages_only"
  | "generic_grass"
  | "indoor_gym"
  | "parking_lot";

/**
 * Render the coach's recent 👍/👎 feedback as a small prompt section.
 * Returns "" when there's no signal — the join in the prompt builder
 * tolerates empty strings (filtered out by `.filter(Boolean)`).
 *
 * Shape:
 *   ## What this coach has liked / disliked recently
 *   - 👍 N up-votes on past plans, 👎 M down-votes
 *   - Up-voted notes: ...
 *   - Down-voted notes: ...
 *   - Use MORE of: <reinforced categories>
 *   - Use LESS of: <underperforming categories>
 *
 * Bias is gentle — the model still has to satisfy hard constraints
 * (warm first/cool last, total minutes, etc.).
 */
function buildFeedbackPromptSection(
  trend:
    | {
        thumbsUp: number;
        thumbsDown: number;
        recentDownNotes: string[];
        recentUpNotes: string[];
        underperformingCategories: string[];
        reinforcedCategories: string[];
      }
    | undefined,
): string {
  if (!trend) return "";
  if (
    trend.thumbsUp === 0 &&
    trend.thumbsDown === 0 &&
    trend.recentDownNotes.length === 0 &&
    trend.recentUpNotes.length === 0
  ) {
    return "";
  }
  const parts: string[] = [];
  parts.push("## Coach feedback signal (from past AI plans)");
  parts.push(`- Recent ratings: 👍 ${trend.thumbsUp} · 👎 ${trend.thumbsDown}`);
  if (trend.reinforcedCategories.length > 0) {
    parts.push(
      `- Coach has up-voted plans containing: ${trend.reinforcedCategories.join(", ")}. Lean into these when relevant.`,
    );
  }
  if (trend.underperformingCategories.length > 0) {
    parts.push(
      `- Coach has down-voted plans containing: ${trend.underperformingCategories.join(", ")}. Use sparingly OR pair with stronger drill names + focus text.`,
    );
  }
  if (trend.recentUpNotes.length > 0) {
    parts.push(`- Liked feedback notes:\n${trend.recentUpNotes.map((n) => `  - "${n}"`).join("\n")}`);
  }
  if (trend.recentDownNotes.length > 0) {
    parts.push(
      `- Disliked feedback notes (avoid these patterns):\n${trend.recentDownNotes.map((n) => `  - "${n}"`).join("\n")}`,
    );
  }
  return parts.join("\n");
}

const FIELD_CONSTRAINT_HINTS: Record<AIFieldConstraint, string> = {
  full_field:
    "Full field — mound, infield, outfield, and cages all available. Live defense, full BP, real bullpens are all fair game.",
  cages_only:
    "Cages only — BP, tee work, machine reps. NO live defensive drills, NO mound work, NO baserunning over real bases.",
  generic_grass:
    "Open grass (e.g. soccer field, park) — no infield dirt, no mound, no cages. Lean on long toss, footwork, fungo defense, baserunning, conditioning.",
  indoor_gym:
    "Indoor / gym — conditioning, dry-line work, walk-throughs, agility, soft toss into nets only. NO live throwing across distances, NO BP, NO live defense.",
  parking_lot:
    "Parking lot — long toss, agility, speed work, conditioning ONLY. NO bats, NO live throws to bases.",
};

export interface AIPlanProposalBlock {
  category: AIPlanCategory;
  drillName: string;
  durationMin: number;
  focusText: string | null;
  lane: AIPlanLane;
}

export interface AIPlanProposal {
  ok: boolean;
  error?: string;
  notConfigured?: boolean;
  /** TL;DR + 1-2 sentence rationale shown above the block list. */
  summary?: string;
  blocks?: AIPlanProposalBlock[];
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
}

export interface AIPlanGenerateInput {
  fieldConstraint: AIFieldConstraint;
  /** Total minutes to fill. Defaults to 90 if missing. */
  availableMinutes: number;
  /** Optional team-level context (e.g. "Varsity"). */
  teamLevel?: string | null;
  /** Optional free-text emphasis the coach types in. */
  focus?: string | null;
  /**
   * The drill names already in the plan, if any. The model is told to
   * NOT propose duplicates of these (avoids "BP" twice when appending).
   */
  existingDrillNames?: string[];
  /**
   * Coach's drill library names. The model is told to PREFER these so
   * proposed blocks line up with drills the coach has on file. Falling
   * back to a free-form name is OK when nothing in the library fits.
   */
  libraryDrillNames?: string[];
  /**
   * Aggregated 👍/👎 trend from this program's recent generations. The
   * prompt uses the down-voted-categories / down-voted-notes signals
   * to bias away from disliked patterns, and the up-voted ones to
   * reinforce. Pure prompt shaping — no ML, no retrieval.
   */
  feedbackTrend?: {
    thumbsUp: number;
    thumbsDown: number;
    recentDownNotes: string[];
    recentUpNotes: string[];
    underperformingCategories: string[];
    reinforcedCategories: string[];
  };
}

/**
 * generatePracticePlan — uses Claude tool use to return a structured
 * list of practice blocks ready to insert. Does NOT touch the database
 * itself; the calling action does that after the coach confirms
 * append-vs-replace.
 */
export async function generatePracticePlan(
  ctx: AICoachContext,
  input: AIPlanGenerateInput,
): Promise<AIPlanProposal> {
  if (!isConfigured()) {
    return {
      ok: false,
      notConfigured: true,
      error: "AI Assistant Coach isn't configured.",
    };
  }

  const minutes =
    input.availableMinutes && input.availableMinutes > 0
      ? Math.min(240, Math.max(20, input.availableMinutes))
      : 90;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const system = [
    `You are Rostr's AI Assistant Coach drafting a practice plan for ${ctx.coachName} (${ctx.programName}).`,
    `Output structured blocks via the propose_practice_plan tool. Be specific, not generic.`,
    ``,
    `## Constraints`,
    `- Total practice length: ~${minutes} minutes (you can be ±10%).`,
    `- Field: ${FIELD_CONSTRAINT_HINTS[input.fieldConstraint]}`,
    input.teamLevel ? `- Team level: ${input.teamLevel}` : null,
    input.focus ? `- Coach emphasis tonight: ${input.focus}` : null,
    ``,
    `## Program context`,
    `- Roster: ${ctx.rosterSummary.total} total. Available today: ${ctx.rosterSummary.availableToday}, questionable ${ctx.rosterSummary.questionableToday}, out ${ctx.rosterSummary.unavailableToday}.`,
    ctx.nextGame
      ? `- Next game: ${ctx.nextGame.homeAway === "home" ? "vs" : "@"} ${ctx.nextGame.opponent} on ${ctx.nextGame.date}${ctx.nextGame.teamLevel ? ` (${ctx.nextGame.teamLevel})` : ""}. Tilt prep toward what beats this opponent.`
      : "- No upcoming game on the books — bias toward fundamentals + skill development.",
    ctx.recentNotes.length > 0
      ? `- Recent coach notes (use these to choose emphases):\n${ctx.recentNotes
          .slice(0, 5)
          .map((n) => `  - ${n.playerName}: ${n.content}`)
          .join("\n")}`
      : "- No recent coach notes.",
    ``,
    input.libraryDrillNames && input.libraryDrillNames.length > 0
      ? `## Coach's drill library (PREFER these names — coach already knows them)\n${input.libraryDrillNames.slice(0, 60).map((n) => `  - ${n}`).join("\n")}`
      : "## Coach's drill library is empty — invent specific drill names.",
    ``,
    input.existingDrillNames && input.existingDrillNames.length > 0
      ? `## Already in the plan (do NOT propose these again)\n${input.existingDrillNames.map((n) => `  - ${n}`).join("\n")}`
      : "## Plan is currently empty.",
    ``,
    // ── Feedback-loop shaping ───────────────────────────────────
    // If we have at least one signal, render a "what this coach has
    // liked/disliked" block. Pure prompt shaping — no retrieval, no ML.
    buildFeedbackPromptSection(input.feedbackTrend),
    ``,
    `## Block requirements`,
    `- Always include a warm-up first and a cool-down last (categories: warm, cool).`,
    `- 4-8 blocks total. Each 8-30 minutes.`,
    `- Categories must be one of: hit, def, bases, pitch, cond, warm, cool.`,
    `- Lane: "main" by default. Use "secondary" only for parallel work (e.g. bullpen during BP) when field allows.`,
    `- Each block needs a SPECIFIC drillName (not "Hitting practice"; instead "Tee work — inside/outside" or "Front toss — two strikes").`,
    `- focusText: 1 short phrase with reps, cues, or intent. Optional but encouraged.`,
    `- Sum of "main" lane durations should be roughly ${minutes} ± 10%.`,
  ]
    .filter(Boolean)
    .join("\n");

  const tool = {
    name: "propose_practice_plan",
    description:
      "Submit a structured practice plan as an ordered list of blocks. The coach reviews and chooses to append or replace.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description:
            "2-sentence TL;DR of the plan: what it focuses on and why, given the constraints.",
        },
        blocks: {
          type: "array",
          minItems: 4,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["hit", "def", "bases", "pitch", "cond", "warm", "cool"],
              },
              drill_name: {
                type: "string",
                description:
                  "Specific drill name. Prefer names from the coach's library when possible.",
              },
              duration_min: {
                type: "integer",
                minimum: 5,
                maximum: 45,
              },
              focus_text: {
                type: "string",
                description:
                  "Short phrase with reps, cues, or intent. Empty string if none.",
              },
              lane: {
                type: "string",
                enum: ["main", "secondary"],
                description:
                  "main = wall-clock time. secondary = parallel block (e.g. bullpen during BP).",
              },
            },
            required: ["category", "drill_name", "duration_min", "lane"],
          },
        },
      },
      required: ["summary", "blocks"],
    },
  };

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: "propose_practice_plan" },
      messages: [
        {
          role: "user",
          content: `Draft a ${minutes}-minute practice plan. Use the propose_practice_plan tool.`,
        },
      ],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return { ok: false, error: "AI didn't return a structured plan." };
    }
    const raw = toolBlock.input as {
      summary: string;
      blocks: Array<{
        category: string;
        drill_name: string;
        duration_min: number;
        focus_text?: string;
        lane: string;
      }>;
    };

    const VALID_CATS: AIPlanCategory[] = [
      "hit",
      "def",
      "bases",
      "pitch",
      "cond",
      "warm",
      "cool",
    ];
    const blocks: AIPlanProposalBlock[] = (raw.blocks ?? [])
      .filter(
        (b) =>
          b &&
          typeof b.drill_name === "string" &&
          b.drill_name.trim().length > 0 &&
          VALID_CATS.includes(b.category as AIPlanCategory) &&
          Number.isFinite(b.duration_min) &&
          b.duration_min > 0,
      )
      .map((b) => ({
        category: b.category as AIPlanCategory,
        drillName: b.drill_name.trim().slice(0, 200),
        durationMin: Math.max(1, Math.min(180, Math.round(b.duration_min))),
        focusText: (b.focus_text ?? "").trim() || null,
        lane: b.lane === "secondary" ? "secondary" : "main",
      }));

    if (blocks.length === 0) {
      return { ok: false, error: "AI returned no usable blocks. Try again." };
    }

    return {
      ok: true,
      summary: (raw.summary ?? "").trim() || undefined,
      blocks,
      model: response.model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "Plan generation failed." };
  }
}
