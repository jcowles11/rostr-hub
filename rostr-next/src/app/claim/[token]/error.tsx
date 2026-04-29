"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function ClaimError({
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
      title="Couldn't load the claim page"
      backHref="/"
      backLabel="Home"
    />
  );
}
