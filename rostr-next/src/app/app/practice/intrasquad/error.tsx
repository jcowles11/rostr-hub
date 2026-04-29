"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function IntrasquadError({
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
      title="Couldn't load Intrasquad builder"
      backHref="/app/practice"
      backLabel="Back to practice"
    />
  );
}
