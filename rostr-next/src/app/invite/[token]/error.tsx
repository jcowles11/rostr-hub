"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function InviteError({
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
      title="Couldn't load this invite"
      backHref="/"
      backLabel="Home"
    />
  );
}
