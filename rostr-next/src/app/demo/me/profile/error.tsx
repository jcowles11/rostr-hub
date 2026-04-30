"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function DemoProfilePreviewError({
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
      title="Couldn't load demo preview"
      backHref="/demo"
      backLabel="Back to demo"
    />
  );
}
