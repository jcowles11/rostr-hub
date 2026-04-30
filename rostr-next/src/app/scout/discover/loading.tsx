import { PageSkeleton } from "@/components/molecules/page-skeleton";

/**
 * /scout/discover — route-level skeleton. Variant "list" matches the
 * stacked card grid while server search runs.
 */
export default function ScoutDiscoverLoading() {
  return <PageSkeleton variant="list" titleWidth="w-40" subtitleWidth="w-56" />;
}
