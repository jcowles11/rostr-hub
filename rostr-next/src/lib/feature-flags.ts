/**
 * Feature flags — pilot-safe isolation for unfinished modules.
 *
 * Goal: let Claude Code (or anyone) build new modules behind a switch
 * so they CAN'T accidentally surface on the live pilot site. Default
 * everything OFF in production. Devs flip flags locally via .env.local
 * to iterate.
 *
 * ---
 *
 * Rules for using a flag:
 *
 *   1. Wrap the entry point of every new module — route page, nav
 *      link, button, server action, public surface — with a flag
 *      check. If the flag is OFF, the surface MUST NOT appear.
 *
 *   2. New routes that exist behind a flag MUST `notFound()` (or
 *      redirect) when the flag is off. Don't render an empty shell;
 *      the route should be invisible to anonymous traffic.
 *
 *   3. Server actions called only by gated UI should also early-
 *      return with a generic error when the flag is off — defense-
 *      in-depth in case the UI gate is bypassed.
 *
 *   4. Feature flag names are SHOUT_SNAKE_CASE with the
 *      `NEXT_PUBLIC_ENABLE_` prefix so they're available on both
 *      server + client (Next.js inlines them at build time).
 *
 *   5. Default is always OFF. The string "true" (lowercase) is the
 *      only ON value. Anything else (undefined, "false", "1", etc.)
 *      reads as off.
 *
 *   6. `.env.example` documents every flag. Production env (Vercel)
 *      omits the variable entirely so it reads as off.
 *
 * ---
 *
 * Adding a new flag:
 *
 *   1. Add the flag name to `FlagName` below + a default-off entry
 *      in `FLAG_DESCRIPTIONS`.
 *   2. Mirror the env-var name in `.env.example` with a brief note.
 *   3. Update AGENTS.md / CLAUDE.md if the gated module changes
 *      pilot-safe assumptions.
 *
 * Removing a flag (after the module ships to pilot):
 *
 *   1. Delete the env-var read AND the gated branches at the same
 *      time. Don't leave dangling flag checks.
 *   2. Remove the entry from FlagName + FLAG_DESCRIPTIONS + .env.example.
 */

/**
 * Canonical list of flag names. Adding a flag without updating this
 * type forces a TypeScript error at the callsite, which keeps stragglers
 * out of the codebase.
 */
export type FlagName =
  | "NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES"
  | "NEXT_PUBLIC_ENABLE_PLAYER_SELF_REPORTED_STATS"
  | "NEXT_PUBLIC_ENABLE_TRAINING_PROGRAMS"
  | "NEXT_PUBLIC_ENABLE_AI_PLAYER_ASSISTANT"
  | "NEXT_PUBLIC_ENABLE_SCOUT_MODE";

/**
 * Human-readable description per flag — used by the dev tooling page
 * and surfaced in error messages when a gated route is hit.
 */
export const FLAG_DESCRIPTIONS: Record<FlagName, string> = {
  NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES:
    "Advanced player profile UI: privacy toggles, prior-season stats, verified-vs-reported badges. Gates new /me/profile sections + new /p/[handle] cards beyond the v0 read-only profile.",
  NEXT_PUBLIC_ENABLE_PLAYER_SELF_REPORTED_STATS:
    "Player-typed prior-season stats. Gates the editor section AND the public-profile render. Sub-flag of advanced player profiles — both must be ON for the prior-stats UI to appear.",
  NEXT_PUBLIC_ENABLE_TRAINING_PROGRAMS:
    "Individualized training programs (workouts, weekly plans, athlete check-ins). Gates the entire feature surface; default OFF until v2.",
  NEXT_PUBLIC_ENABLE_AI_PLAYER_ASSISTANT:
    "Athlete-facing AI assistant on /me. Distinct from the coach AI Assistant Coach (which ships unflagged); this is the player-side counterpart and is OFF until we have privacy review.",
  NEXT_PUBLIC_ENABLE_SCOUT_MODE:
    "Simplified scout discovery experience at /scout/discover. Read-only search + filters + player cards leveraging the verified-vs-reported signals from the advanced player profiles module. Distinct from the existing recruiter system at /scout/* (which stays live unflagged).",
};

/**
 * Read a flag. Process.env access is safe on both server and client
 * because the flag names are NEXT_PUBLIC_-prefixed (Next.js inlines
 * them into the client bundle at build time).
 *
 * NOTE: do NOT read process.env[flag] dynamically — Next.js's build
 * step replaces literal `process.env.FOO` references but does NOT
 * replace dynamic reads. The switch statement below is intentional;
 * each call site shows up as a literal env-var read in the bundle
 * and gets statically replaced.
 */
export function isFeatureEnabled(flag: FlagName): boolean {
  const v = readFlag(flag);
  return v === "true";
}

function readFlag(flag: FlagName): string | undefined {
  // Switch on literal flag name so Next.js's build-time replacement
  // can statically inline each env var. Adding a new flag requires
  // adding a case here AND to FlagName (TypeScript catches the gap).
  switch (flag) {
    case "NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES":
      return process.env.NEXT_PUBLIC_ENABLE_ADVANCED_PLAYER_PROFILES;
    case "NEXT_PUBLIC_ENABLE_PLAYER_SELF_REPORTED_STATS":
      return process.env.NEXT_PUBLIC_ENABLE_PLAYER_SELF_REPORTED_STATS;
    case "NEXT_PUBLIC_ENABLE_TRAINING_PROGRAMS":
      return process.env.NEXT_PUBLIC_ENABLE_TRAINING_PROGRAMS;
    case "NEXT_PUBLIC_ENABLE_AI_PLAYER_ASSISTANT":
      return process.env.NEXT_PUBLIC_ENABLE_AI_PLAYER_ASSISTANT;
    case "NEXT_PUBLIC_ENABLE_SCOUT_MODE":
      return process.env.NEXT_PUBLIC_ENABLE_SCOUT_MODE;
  }
}

/**
 * Server-side guard for gated route pages. Wrap the page's default
 * export body with this — when the flag is OFF, calls Next's
 * `notFound()` so the route returns 404 (not a stub or redirect that
 * could leak the route's existence).
 *
 *   import { notFound } from "next/navigation";
 *   import { requireFlag } from "@/lib/feature-flags";
 *
 *   export default async function NewFeaturePage() {
 *     requireFlag("NEXT_PUBLIC_ENABLE_TRAINING_PROGRAMS");
 *     // ... rest of the page only runs when flag is on
 *   }
 *
 * NOTE: imports `notFound` lazily so this module stays usable from
 * pure-client contexts (component conditionals) without dragging
 * Next.js server runtime in.
 */
export function requireFlag(flag: FlagName): void {
  if (isFeatureEnabled(flag)) return;
  // Lazy import — keeps this module client-safe.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { notFound } = require("next/navigation") as typeof import("next/navigation");
  notFound();
}

/**
 * Server-action guard. Use at the TOP of any server action that
 * belongs to a gated module:
 *
 *   export async function updatePriorStatsAction(input: ...) {
 *     if (!isFeatureEnabled("NEXT_PUBLIC_ENABLE_PLAYER_SELF_REPORTED_STATS")) {
 *       return { error: featureDisabledMessage("NEXT_PUBLIC_ENABLE_PLAYER_SELF_REPORTED_STATS") };
 *     }
 *     // ...
 *   }
 *
 * This ensures the action is unreachable even if a UI bug exposes
 * its callsite — defense-in-depth for the gate.
 */
export function featureDisabledMessage(flag: FlagName): string {
  return `Feature unavailable. (${flag} disabled)`;
}
