"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function RosterError({
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
      title="Couldn't load the roster"
      backHref="/app"
      backLabel="Back to Hub"
    />
  );
}
