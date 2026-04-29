"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function ProfileError({
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
      title="Couldn't load this profile"
      backHref="/"
      backLabel="Home"
    />
  );
}
