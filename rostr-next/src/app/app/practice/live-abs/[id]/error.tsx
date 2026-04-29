"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

/**
 * Critical surface — coach is mid-session, sun in their face, tapping
 * outcomes. If something blows up, give them a clear path back to the
 * session list (where their data is still safe) instead of a white
 * screen.
 */
export default function LiveAbsScoringError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorCard
      error={error}
      reset={reset}
      title="Scoring view crashed"
      backHref="/app/practice/live-abs"
      backLabel="Back to sessions"
      message="Your at-bats are saved — nothing was lost. Reload to keep going."
    />
  );
}
