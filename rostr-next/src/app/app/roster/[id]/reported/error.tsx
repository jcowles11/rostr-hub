"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function PlayerReportedReviewError({
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
      title="Couldn't load player-reported data"
      backHref="/app/roster"
      backLabel="Back to roster"
    />
  );
}
