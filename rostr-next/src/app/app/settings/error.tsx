"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function SettingsError({
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
      title="Settings couldn't load"
      backHref="/app"
      backLabel="Back to Hub"
    />
  );
}
