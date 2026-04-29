"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function GamesError({
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
      title="Couldn't load games"
      backHref="/app"
      backLabel="Back to Hub"
    />
  );
}
