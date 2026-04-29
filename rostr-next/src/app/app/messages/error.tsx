"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function MessagesError({
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
      title="Inbox failed to load"
      backHref="/app"
      backLabel="Back to Hub"
    />
  );
}
