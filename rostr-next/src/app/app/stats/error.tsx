"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function StatsError({
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
      title="Stats failed to load"
      backHref="/app"
      backLabel="Back to Hub"
    />
  );
}
