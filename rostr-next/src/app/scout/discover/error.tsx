"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function ScoutDiscoverError({
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
      title="Couldn't load discovery"
      backHref="/scout"
      backLabel="Back to scout"
    />
  );
}
