"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function LiveAbsError({
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
      title="Couldn't load Live ABs"
      backHref="/app/practice"
      backLabel="Back to practice"
    />
  );
}
