/**
 * Analytics Service
 *
 * Lightweight event tracking for pilot usage observation.
 * Fire-and-forget — never blocks UI, never throws.
 * No sensitive player data is captured in properties.
 *
 * Event catalog:
 *   roster_import        — coach imported players from file
 *   player_create        — coach added a single player
 *   metric_configure     — coach created or updated a metric
 *   session_create       — coach created a tryout session/event
 *   score_entry          — coach saved a score (batched, not per-keystroke)
 *   ranking_filter       — coach applied a filter on Dashboard
 *   player_profile_view  — coach opened a player detail page
 *   evaluator_filter     — coach filtered Dashboard by evaluator
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────

export type AnalyticsEvent =
  | "roster_import"
  | "player_create"
  | "metric_configure"
  | "session_create"
  | "score_entry"
  | "ranking_filter"
  | "player_profile_view"
  | "evaluator_filter";

export interface TrackProperties {
  /** Number of items affected (e.g., players imported, scores saved) */
  count?: number;
  /** Categorical label (e.g., filter type, metric type) */
  label?: string;
  /** Source surface that triggered the event */
  source?: string;
  /** Duration in ms (e.g., how long an import took) */
  duration_ms?: number;
  /** Any additional context — keep lightweight */
  [key: string]: string | number | boolean | null | undefined;
}

// ── Track function ─────────────────────────────────────────────────

/**
 * Fire-and-forget event tracking.
 * - Never awaited in calling code (returns void, not Promise)
 * - Silently drops events if user is not authenticated or insert fails
 * - Strips any fields that might contain PII before inserting
 */
export function track(
  event: AnalyticsEvent,
  programId: string,
  coachId: string | null,
  properties?: TrackProperties
): void {
  // Sanitize: strip any keys that could contain PII
  const safeProps = properties ? sanitizeProperties(properties) : {};

  // Fire and forget — no await, no error surfacing
  supabase
    .from("analytics_events")
    .insert({
      program_id: programId,
      coach_id: coachId,
      event_name: event,
      properties: safeProps,
    })
    .then(({ error }) => {
      if (error) {
        // Silent failure — analytics should never disrupt the app
        console.debug("[analytics] track failed:", event, error.message);
      }
    });
}

// ── Helpers ─────────────────────────────────────────────────────────

const PII_KEYS = new Set([
  "name", "first_name", "last_name", "email", "phone",
  "player_name", "coach_name", "emergency_contact",
]);

function sanitizeProperties(props: TrackProperties): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (PII_KEYS.has(key)) continue;
    if (value === undefined) continue;
    safe[key] = value;
  }
  return safe;
}
