import { PageSkeleton } from "@/components/molecules/page-skeleton";

/**
 * /app/rankings — route-level skeleton. Variant "list" matches the
 * stacked player-row layout while server scoring runs.
 */
export default function RankingsLoading() {
  return <PageSkeleton variant="list" titleWidth="w-32" subtitleWidth="w-48" />;
}
