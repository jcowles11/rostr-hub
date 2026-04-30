"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCoach } from "@/lib/services/coach";
import { isDemoRequest, DEMO_GUARD_MESSAGE } from "@/lib/demo-guard";
import { checkAIRateLimit } from "@/lib/rate-limit";

export interface CreateGameInput {
  opponent: string;
  name?: string;
  gameDate: string; // YYYY-MM-DD
  gameTime?: string; // HH:MM
  location?: string;
  homeAway: "home" | "away" | "neutral";
  teamLevel?: string;
}

export async function createGameAction(
  input: CreateGameInput,
): Promise<{ error: string | null; gameId?: string }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  if (!input.opponent.trim() || !input.gameDate) {
    return { error: "Opponent and game date are required." };
  }
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("games")
    .insert({
      program_id: coach.program_id,
      name: input.name?.trim() || `vs ${input.opponent.trim()}`,
      opponent: input.opponent.trim(),
      game_date: input.gameDate,
      game_time: input.gameTime || null,
      location: input.location?.trim() || null,
      home_away: input.homeAway,
      team_level: input.teamLevel || null,
      status: "scheduled",
      created_by: coach.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Couldn't create game." };

  revalidatePath("/app");
  revalidatePath("/app/games");
  revalidatePath("/app/schedule");
  return { error: null, gameId: data.id };
}

/**
 * setGameRosterAction — set the full roster for a game.
 * Deletes rows for players not in the new list, then upserts the rest.
 */
export async function setGameRosterAction(
  gameId: string,
  playerIds: string[],
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  // Delete existing rows not in the new list
  if (playerIds.length > 0) {
    const { error: delErr } = await supabase
      .from("game_rosters")
      .delete()
      .eq("game_id", gameId)
      .not("player_id", "in", `(${playerIds.map((p) => `"${p}"`).join(",")})`);
    if (delErr) return { error: delErr.message };
  } else {
    const { error: delErr } = await supabase
      .from("game_rosters")
      .delete()
      .eq("game_id", gameId);
    if (delErr) return { error: delErr.message };
  }

  if (playerIds.length === 0) {
    revalidatePath(`/app/games/${gameId}`);
    return { error: null };
  }

  const rows = playerIds.map((pid) => ({
    game_id: gameId,
    player_id: pid,
    status: "active",
  }));
  const { error } = await supabase
    .from("game_rosters")
    .upsert(rows, { onConflict: "game_id,player_id" });
  if (error) return { error: error.message };

  revalidatePath(`/app/games/${gameId}`);
  revalidatePath("/app");
  return { error: null };
}

export interface LineupEntry {
  playerId: string;
  battingOrder: number; // 1..N
  position: string; // "P", "C", "SS", ...
}

/**
 * setLineupAction — replace the lineup_entries for a game.
 */
export async function setLineupAction(
  gameId: string,
  entries: LineupEntry[],
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();

  const { error: delErr } = await supabase
    .from("lineup_entries")
    .delete()
    .eq("game_id", gameId);
  if (delErr) return { error: delErr.message };

  if (entries.length === 0) {
    revalidatePath(`/app/games/${gameId}`);
    return { error: null };
  }

  const { error } = await supabase.from("lineup_entries").insert(
    entries.map((e) => ({
      game_id: gameId,
      player_id: e.playerId,
      batting_order: e.battingOrder,
      position: e.position,
    })),
  );
  if (error) return { error: error.message };

  revalidatePath(`/app/games/${gameId}`);
  return { error: null };
}

/**
 * recordGameResultAction — flip a scheduled game to completed with a
 * final score. Stores recap notes + stamps who / when. The `result`
 * column (W/L/T) is a generated column on games, so no need to pass it.
 */
export interface RecordGameResultInput {
  gameId: string;
  ourScore: number;
  opponentScore: number;
  recapNotes?: string;
}

export async function recordGameResultAction(
  input: RecordGameResultInput,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (!Number.isFinite(input.ourScore) || !Number.isFinite(input.opponentScore)) {
    return { error: "Both scores are required." };
  }
  if (input.ourScore < 0 || input.opponentScore < 0) {
    return { error: "Scores can't be negative." };
  }
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("games")
    .update({
      status: "completed",
      our_score: input.ourScore,
      opponent_score: input.opponentScore,
      recap_notes: input.recapNotes?.trim() || null,
      completed_at: new Date().toISOString(),
      completed_by: coach.id,
    })
    .eq("id", input.gameId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };

  revalidatePath(`/app/games/${input.gameId}`);
  revalidatePath("/app/games");
  revalidatePath("/app/schedule");
  revalidatePath("/app");
  return { error: null };
}

/**
 * clearGameResultAction — un-complete a game. Used if the coach
 * recorded the wrong score or needs to re-record.
 */
export async function clearGameResultAction(
  gameId: string,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("games")
    .update({
      status: "scheduled",
      our_score: null,
      opponent_score: null,
      recap_notes: null,
      completed_at: null,
      completed_by: null,
    })
    .eq("id", gameId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };

  revalidatePath(`/app/games/${gameId}`);
  revalidatePath("/app");
  return { error: null };
}

// ── Game prep ────────────────────────────────────────────────────

export interface UpdateGamePrepInput {
  gameId: string;
  reportTime: string | null; // "HH:MM" or null
  releaseTime: string | null;
  uniform: string | null;
  equipmentNotes: string | null;
  lineupPreview: string | null;
  prepNotes: string | null;
  /** Migration 31 — show the saved batting lineup to players. */
  shareLineup?: boolean;
  /** Free-text scorekeeper designation. */
  scorekeeperName?: string | null;
}

/**
 * updateGamePrepAction — save coach-authored prep details for a game.
 * Shown to players on /me + /p/[handle] so they can plan uniforms,
 * arrival, early release from school, etc.
 */
export async function updateGamePrepAction(
  input: UpdateGamePrepInput,
): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  // Convert "14:30" → "14:30:00" for PostgreSQL time columns
  const normalizeTime = (t: string | null): string | null => {
    if (!t) return null;
    const trimmed = t.trim();
    if (!trimmed) return null;
    return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
  };
  // Build the update payload. Only include the migration-31 columns
  // when the caller provided them, so older code paths that don't know
  // about share_lineup / scorekeeper_name don't accidentally clear them.
  const update: Record<string, unknown> = {
    report_time: normalizeTime(input.reportTime),
    release_time: normalizeTime(input.releaseTime),
    uniform: input.uniform?.trim() || null,
    equipment_notes: input.equipmentNotes?.trim() || null,
    lineup_preview: input.lineupPreview?.trim() || null,
    prep_notes: input.prepNotes?.trim() || null,
  };
  if (input.shareLineup !== undefined) update.share_lineup = input.shareLineup;
  if (input.scorekeeperName !== undefined) {
    update.scorekeeper_name = input.scorekeeperName?.trim() || null;
  }

  const { error } = await supabase
    .from("games")
    .update(update)
    .eq("id", input.gameId)
    .eq("program_id", coach.program_id);
  if (error) {
    // Migration-resilience: if the env doesn't have the new columns
    // (migration 31 not applied), retry without them so the rest of
    // the prep save still works.
    if (
      /column .* does not exist/i.test(error.message) ||
      /could not find the .* column/i.test(error.message)
    ) {
      delete update.share_lineup;
      delete update.scorekeeper_name;
      const { error: retryErr } = await supabase
        .from("games")
        .update(update)
        .eq("id", input.gameId)
        .eq("program_id", coach.program_id);
      if (retryErr) return { error: retryErr.message };
    } else {
      return { error: error.message };
    }
  }

  revalidatePath(`/app/games/${input.gameId}`);
  revalidatePath("/me");
  revalidatePath("/app");
  return { error: null };
}

// ── AI fill: Game-day prep from a single prompt ──────────────────

/**
 * Output of aiFillPrepFromPromptAction. Each field is optional so the
 * UI can apply only the fields the coach actually mentioned, leaving
 * the rest untouched. e.g. "5pm at home, white jerseys" sets
 * gameTime + uniform but leaves report/release alone.
 */
export interface AIFilledPrep {
  gameTime?: string | null; // "HH:MM"
  reportTime?: string | null;
  releaseTime?: string | null;
  uniform?: string | null;
  equipmentNotes?: string | null;
  prepNotes?: string | null;
  scorekeeperName?: string | null;
}

/**
 * aiFillPrepFromPromptAction — one-shot extraction.
 *
 * Coach types something like "Friday vs Central, 5pm, home whites,
 * report 4:00, school out 2:30, Tyler's mom is scoring." The AI parses
 * it into structured fields the UI can drop into the prep form. Coach
 * reviews + saves with one tap.
 *
 * Uses Claude Haiku w/ tool-use for structured output (no string
 * parsing of JSON-in-text). Rate-limited per coach via the same
 * bucket as askAICoach / generatePracticePlan.
 */
export async function aiFillPrepFromPromptAction(
  prompt: string,
): Promise<{
  ok: boolean;
  data?: AIFilledPrep;
  error?: string;
  notConfigured?: boolean;
  retryAfter?: string;
}> {
  if (isDemoRequest()) {
    return { ok: false, notConfigured: true, error: DEMO_GUARD_MESSAGE };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      notConfigured: true,
      error:
        "AI Assistant Coach isn't configured. Set ANTHROPIC_API_KEY in your environment to turn it on.",
    };
  }
  const trimmed = prompt.trim();
  if (!trimmed) return { ok: false, error: "Tell the AI Coach the game info first." };
  if (trimmed.length > 1500) {
    return { ok: false, error: "Prompt too long — keep it under 1500 chars." };
  }

  const coach = await getCurrentCoach();
  if (!coach) return { ok: false, error: "No program." };

  // Rate-limit shares the AI bucket so a flood of fills can't blow
  // the same Anthropic budget the rest of the AI features use.
  const limit = checkAIRateLimit(coach.id);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Slow down — try again in ${limit.retryAfterMs > 60000 ? `${Math.ceil(limit.retryAfterMs / 60000)} min` : `${Math.ceil(limit.retryAfterMs / 1000)}s`}`,
    };
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Tool-use for structured output. Every field is optional so partial
  // prompts ("5pm vs Central") don't force the model to fabricate
  // uniform / equipment / scorekeeper data the coach didn't supply.
  const tools: Anthropic.Tool[] = [
    {
      name: "fill_game_prep",
      description:
        "Extract structured game-day prep fields from the coach's free-text description. Only set fields the coach explicitly mentioned. Times use 24-hour HH:MM format.",
      input_schema: {
        type: "object",
        properties: {
          gameTime: {
            type: "string",
            description:
              "First-pitch / start time, 24-hour HH:MM. Example: '17:00' for 5pm. Omit if not stated.",
          },
          reportTime: {
            type: "string",
            description:
              "When players should arrive at the field / bus / locker room. 24-hour HH:MM. Omit if not stated.",
          },
          releaseTime: {
            type: "string",
            description:
              "Early-release / dismissal time from school for the players. 24-hour HH:MM. Omit if not stated.",
          },
          uniform: {
            type: "string",
            description:
              "Short uniform description. Example: 'Home whites, gold belts, black cleats'. Omit if not stated.",
          },
          equipmentNotes: {
            type: "string",
            description:
              "Extra equipment reminders. Example: 'Bring own gloves; long sleeves; turf shoes'. Omit if not stated.",
          },
          prepNotes: {
            type: "string",
            description:
              "Anything else players should know that doesn't fit the other fields — opponent scouting, travel, team dinner, ceremony notes. Omit if not stated.",
          },
          scorekeeperName: {
            type: "string",
            description:
              "Name of the player or parent designated to run scoring during the game. Example: 'Tyler Smith — #12' or 'Mrs. Patel'. Omit if not stated.",
          },
        },
      },
    },
  ];

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      tools,
      tool_choice: { type: "tool", name: "fill_game_prep" },
      system:
        "You convert a coach's free-text game-day brief into structured prep fields. Only fill fields the coach explicitly mentioned — never invent details. Convert times to 24-hour HH:MM (5pm → 17:00, 2:30 → 14:30 if context implies afternoon). Trim filler words from uniform / equipment so the saved value reads cleanly on a player's phone.",
      messages: [{ role: "user", content: trimmed }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { ok: false, error: "AI didn't return structured fields." };
    }

    const raw = toolUse.input as Partial<AIFilledPrep> | null;
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "AI returned an unexpected shape." };
    }

    const cleanString = (v: unknown): string | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (typeof v !== "string") return undefined;
      const s = v.trim();
      return s ? s : null;
    };
    const cleanTime = (v: unknown): string | null | undefined => {
      const s = cleanString(v);
      if (!s) return s;
      // Accept HH:MM or HH:MM:SS, normalize to HH:MM. Reject anything else.
      const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
      if (!m) return undefined;
      const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
      return `${String(h).padStart(2, "0")}:${m[2]}`;
    };

    const data: AIFilledPrep = {
      gameTime: cleanTime(raw.gameTime),
      reportTime: cleanTime(raw.reportTime),
      releaseTime: cleanTime(raw.releaseTime),
      uniform: cleanString(raw.uniform),
      equipmentNotes: cleanString(raw.equipmentNotes),
      prepNotes: cleanString(raw.prepNotes),
      scorekeeperName: cleanString(raw.scorekeeperName),
    };

    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg || "AI fill failed." };
  }
}

export async function deleteGameAction(gameId: string): Promise<{ error: string | null }> {
  if (isDemoRequest()) return { error: DEMO_GUARD_MESSAGE };
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("games")
    .delete()
    .eq("id", gameId)
    .eq("program_id", coach.program_id);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/games");
  revalidatePath("/app/schedule");
  return { error: null };
}
