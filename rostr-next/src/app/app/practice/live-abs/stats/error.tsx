"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function LiveAbsStatsError({
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
      title="Couldn't load Live AB stats"
      backHref="/app/practice/live-abs"
      backLabel="Back to sessions"
    />
  );
}
