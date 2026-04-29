"use client";

import { RouteErrorCard } from "@/components/organisms/error-boundary";

export default function ProfileEditorError({
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
      title="Couldn't load profile editor"
      backHref="/me"
      backLabel="My profile"
    />
  );
}
