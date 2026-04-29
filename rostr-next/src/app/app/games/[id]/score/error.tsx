"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

/**
 * Live game scoring error boundary. The coach is at the field, kid's at
 * the plate — we cannot leave them on a white screen. Reassure that
 * recorded plays survived.
 */
export default function LiveScoringError({
  error,
  reset,
  params,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  params?: { id?: string };
}) {
  const back = params?.id ? `/app/games/${params.id}` : "/app/games";
  return (
    <RouteErrorCard
      error={error}
      reset={reset}
      title="Live scoring crashed"
      backHref={back}
      backLabel="Back to game"
      message="Plays you've already logged are saved. Hit Retry to keep scoring."
    />
  );
}
