/**
 * Observability — single entry point for error reporting + future
 * structured events.
 *
 * Today: errors are POSTed to /api/log-error which forwards to
 * `console.error()` on the server (visible in Vercel function logs)
 * and optionally to Sentry / Datadog / wherever later. The single
 * choke point keeps swap-out painless.
 *
 * Why not @sentry/nextjs directly? Adding it requires a heavy SDK
 * (~200KB) + interactive wizard config that doesn't compose with
 * an opinionated route layout like ours. The cost of a manual swap
 * later is small — we already have the abstraction.
 */

export interface ErrorContext {
  /** Where the error came from — usually a route segment name. */
  area?: string;
  /** Auth state if known. */
  userId?: string | null;
  programId?: string | null;
  /** Anything serializable. Stringified server-side; avoid PII. */
  extra?: Record<string, unknown>;
  /** Coarse severity. */
  level?: "fatal" | "error" | "warning" | "info";
}

/**
 * captureError — fire-and-forget error report. Safe to call from any
 * client component; never throws.
 */
export function captureError(err: unknown, ctx: ErrorContext = {}): void {
  try {
    const payload = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : "UnknownError",
      ...ctx,
      ts: new Date().toISOString(),
    };
    if (typeof window !== "undefined") {
      // Use sendBeacon when available so the report survives page
      // unloads; fall back to fetch for everything else.
      const url = "/api/log-error";
      const body = JSON.stringify(payload);
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
        return;
      }
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        /* swallow — never crash on observability failure */
      });
    } else {
      // Server-side path (server components, server actions). Just log
      // — Vercel captures stdout/stderr from server functions.
      // eslint-disable-next-line no-console
      console.error("[error]", payload);
    }
  } catch {
    /* never throw from observability */
  }
}

/**
 * Type-safe rate-limit error — used by AI server actions to signal
 * "you're going too fast" without leaking budget.
 */
export class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number, message = "Rate limit hit") {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}
