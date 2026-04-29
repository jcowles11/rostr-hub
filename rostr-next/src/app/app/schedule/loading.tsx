import { PageSkeleton } from "@/components/molecules/page-skeleton";

/**
 * /app/schedule — route-level skeleton.
 * Stacked event rows match the unified games + practices layout.
 */
export default function ScheduleLoading() {
  return <PageSkeleton variant="list" titleWidth="w-36" subtitleWidth="w-64" />;
}
