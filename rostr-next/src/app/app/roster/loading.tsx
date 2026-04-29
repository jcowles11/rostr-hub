import { PageSkeleton } from "@/components/molecules/page-skeleton";

/**
 * /app/roster — route-level skeleton.
 * Renders instantly during navigation so the table doesn't pop in.
 * Variant "list" matches the stacked player-row layout.
 */
export default function RosterLoading() {
  return <PageSkeleton variant="list" titleWidth="w-32" subtitleWidth="w-56" />;
}
