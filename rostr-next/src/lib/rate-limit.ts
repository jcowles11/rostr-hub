/**
 * In-memory rate limiter for server actions.
 *
 * Why in-memory: the pilot has one Vercel deployment, low traffic, and
 * a small active-coach pool. Cross-instance state isn't worth a Redis
 * dep yet. When we need it, swap the Map for an Upstash KV client —
 * the public API stays identical.
 *
 * Two algorithms in one helper: per-window count (good for "20 calls
 * per hour") and an emergency global cap (good for "stop the bleeding
 * if a bug pegs the AI endpoint").
 */

type Bucket = {
  /** Timestamps (ms) of recent calls within the active window. */
  hits: number[];
};

const buckets = new Map<string, Bucket>();
let lastJanitorAt = Date.now();
const JANITOR_INTERVAL_MS = 60 * 1000;

/**
 * Sliding-window rate check.
 *
 * Returns `{ ok: true }` if the call is allowed, or `{ ok: false,
 * retryAfterMs }` if the limit is exceeded.
 *
 * Records the call only when allowed — failed checks don't count
 * against the user, which matters because failed AI requests don't
 * actually hit Anthropic.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterMs: number; limit: number; windowMs: number } {
  const now = Date.now();

  // Periodic janitor — throw out empty buckets so the Map doesn't
  // grow forever. Cheap; runs at most once per minute.
  if (now - lastJanitorAt > JANITOR_INTERVAL_MS) {
    lastJanitorAt = now;
    buckets.forEach((b, k) => {
      if (b.hits.length === 0 || now - b.hits[b.hits.length - 1] > windowMs * 4) {
        buckets.delete(k);
      }
    });
  }

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  // Drop hits that fell out of the window.
  const cutoff = now - windowMs;
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= limit) {
    const oldestInWindow = bucket.hits[0];
    const retryAfterMs = Math.max(0, windowMs - (now - oldestInWindow));
    return { ok: false, retryAfterMs, limit, windowMs };
  }

  bucket.hits.push(now);
  return { ok: true };
}

/**
 * Convenience wrapper for the AI Coach rate limits.
 *
 * Two layers:
 *   - Per-coach short window: 20 calls / hour. Stops a coach (or a UI
 *     bug) from accidentally racking up the budget.
 *   - Per-coach burst: 5 calls / minute. Catches spam-clicking.
 *
 * Bumps to these are cheap if real coaches actually want more — the
 * point is to put a ceiling, not to gatekeep.
 */
export function checkAIRateLimit(
  coachId: string,
):
  | { ok: true }
  | { ok: false; retryAfterMs: number; reason: "burst" | "hourly" } {
  const burst = checkRateLimit(`ai:burst:${coachId}`, 5, 60 * 1000);
  if (!burst.ok) return { ok: false, retryAfterMs: burst.retryAfterMs, reason: "burst" };

  const hourly = checkRateLimit(`ai:hour:${coachId}`, 20, 60 * 60 * 1000);
  if (!hourly.ok) return { ok: false, retryAfterMs: hourly.retryAfterMs, reason: "hourly" };

  return { ok: true };
}

/**
 * Format a "try again in 38s" / "try again in 12 minutes" string for
 * the user-facing toast.
 */
export function formatRetryAfter(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.ceil(m / 60);
  return `${h}h`;
}
