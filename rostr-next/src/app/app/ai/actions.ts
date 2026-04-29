"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCoach } from "@/lib/services/coach";
import { isDemoRequest } from "@/lib/demo-guard";
import { checkAIRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import {
  askAICoach,
  gatherAICoachContext,
  gatherLineupContext,
  generateLineup,
  type AICoachIntent,
  type AICoachResponse,
} from "@/lib/services/ai-coach";
import { setLineupAction } from "@/app/app/games/actions";

/**
 * askAICoachAction — server action used by the AI Assistant Coach panel on
 * the Hub. Gathers live program context for the signed-in coach and
 * forwards a one-shot prompt to Claude. For `generate_lineup` intent,
 * uses tool-use to return a structured applyable lineup.
 */
export async function askAICoachAction(
  intent: AICoachIntent,
  customPrompt?: string,
): Promise<AICoachResponse> {
  // Demo requests can't trigger Anthropic — protects the API budget.
  if (isDemoRequest()) {
    return {
      ok: false,
      notConfigured: true,
      error: "AI Assistant Coach is disabled in the demo. Sign up to use it for free.",
    };
  }
  const coach = await getCurrentCoach();
  if (!coach) return { ok: false, error: "No program." };

  // Per-coach rate limit — ceiling on the Anthropic spend before the
  // request ever leaves the server. Returns a friendly message with a
  // retry-after hint instead of silently calling Claude on every click.
  const rl = checkAIRateLimit(coach.id);
  if (!rl.ok) {
    return {
      ok: false,
      error:
        rl.reason === "burst"
          ? `Slow down — try again in ${formatRetryAfter(rl.retryAfterMs)}.`
          : `You've hit the hourly AI limit. Try again in ${formatRetryAfter(rl.retryAfterMs)}.`,
    };
  }

  const baseCtx = await gatherAICoachContext(
    coach.program_id,
    coach.full_name,
    coach.program_name,
    coach.program_levels,
  );

  if (intent === "generate_lineup") {
    const lineupCtx = await gatherLineupContext(baseCtx, coach.program_id);
    return generateLineup(lineupCtx);
  }

  return askAICoach(baseCtx, { intent, customPrompt });
}

/**
 * applyAILineupAction — writes the AI-generated lineup to the real
 * game's lineup_entries. Validates that the caller is a coach on the
 * program that owns the game.
 */
export async function applyAILineupAction(
  gameId: string,
  entries: Array<{ playerId: string; battingOrder: number; position: string }>,
): Promise<{ error: string | null }> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: "No program." };
  if (entries.length !== 9) return { error: "Need 9 slots." };

  // Delegate to the existing setLineupAction which handles the upsert.
  const r = await setLineupAction(gameId, entries);
  if (r.error) return { error: r.error };

  revalidatePath(`/app/games/${gameId}`);
  return { error: null };
}
