"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function AppError({
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
      title="The Hub hit a snag"
      backHref="/"
      backLabel="Marketing site"
    />
  );
}
