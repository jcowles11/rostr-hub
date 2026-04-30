"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function RankingsError({
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
      title="Couldn't compute rankings"
      backHref="/app"
      backLabel="Back to Hub"
    />
  );
}
