import { headers } from "next/headers";

/**
 * isDemoRequest — true when this server action was invoked from a
 * /demo page (referer header check).
 *
 * Used to gate mutations + cost-incurring features (AI calls, etc.)
 * on the public demo so prospects don't:
 *   1. See raw "No program" errors when clicking modal submits.
 *   2. Burn the Anthropic budget by spamming Generate.
 *   3. Trigger any code path that assumes a real coach context.
 *
 * Best-effort — referer can be spoofed, but a real client doing that
 * has already chosen to bypass the demo. Falls back to false on any
 * parse error so the action proceeds normally outside the demo.
 */
export function isDemoRequest(): boolean {
  try {
    const ref = headers().get("referer") ?? "";
    if (!ref) return false;
    const url = new URL(ref);
    return url.pathname === "/demo" || url.pathname.startsWith("/demo/");
  } catch {
    return false;
  }
}

/**
 * The standard error message returned by mutation actions when invoked
 * from the demo. Phrased as the next step a prospect should take so
 * the toast itself doubles as a CTA.
 */
export const DEMO_GUARD_MESSAGE =
  "This is a demo — sign up free to save your changes.";
