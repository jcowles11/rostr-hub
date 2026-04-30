import { PageSkeleton } from "@/components/molecules/page-skeleton";

/**
 * /app/roster/[id]/reported — route-level skeleton.
 * Read-only review of player-typed fields; "list" variant matches the
 * stacked card layout while server hydration runs.
 */
export default function PlayerReportedReviewLoading() {
  return <PageSkeleton variant="list" titleWidth="w-40" subtitleWidth="w-48" />;
}
