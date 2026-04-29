"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { captureError } from "@/lib/observability";

/**
 * RouteErrorCard — shared error UI for route-level error.tsx boundaries.
 *
 * Design intent:
 * - Never show a blank white screen. Every route's error.tsx uses this.
 * - Don't leak stack traces — show a short, honest message + a retry
 *   button + a link back to safety.
 * - Log the full error to the console so we can still debug from the
 *   browser devtools.
 *
 * Next.js 14 passes error boundaries two props: `error` (the thrown
 * Error) and `reset()` (re-renders the segment's children).
 */
export function RouteErrorCard({
  error,
  reset,
  title = "Something went wrong",
  backHref = "/app",
  backLabel = "Back to Hub",
  message,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  backHref?: string;
  backLabel?: string;
  /** Optional custom reassurance line in place of the generic copy. */
  message?: string;
}) {
  useEffect(() => {
    // Surface full error in the browser console for debugging.
    // eslint-disable-next-line no-console
    console.error("[route error]", error);
    // Report through the observability pipeline so the error lands in
    // Vercel logs (and, once swapped in, Sentry/Datadog/etc).
    captureError(error, {
      area: "route-boundary",
      level: "error",
      extra: { digest: error.digest, title },
    });
  }, [error, title]);

  return (
    <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-[60vh]">
      <div className="w-full max-w-[460px] bg-card border border-hair rounded-lg p-6 sm:p-8 text-center">
        <div className="w-11 h-11 rounded-full bg-red-soft text-red inline-flex items-center justify-center mb-3">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-2 leading-relaxed">
          {message ??
            "We hit an error loading this page. Retry usually fixes it. If it keeps happening, head back and try a different way."}
        </p>
        {error.message && (
          <div className="mt-3 p-3 bg-paper rounded-sm text-left text-[11.5px] font-mono text-ink-3 break-words">
            {error.message}
            {error.digest && (
              <div className="mt-1 text-ink-4">ref: {error.digest}</div>
            )}
          </div>
        )}
        <div className="mt-5 flex gap-2 justify-center">
          <Button variant="primary" size="md" onClick={reset}>
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
          <Link href={backHref}>
            <Button variant="ghost" size="md">{backLabel}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
