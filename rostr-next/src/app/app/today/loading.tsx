import { PageSkeleton, SkeletonBlock } from "@/components/molecules/page-skeleton";

/**
 * /app/today — route-level skeleton.
 * Mirrors the standup layout: hero brief + 2-col grid (events / availability).
 */
export default function TodayLoading() {
  return (
    <PageSkeleton
      titleWidth="w-56"
      subtitleWidth="w-72"
      variant="blank"
    >
      {/* Daily-brief hero */}
      <div className="bg-ink/90 rounded-lg h-[120px] mb-5 animate-pulse" />
      {/* Events column + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="flex flex-col gap-5">
          <SkeletonBlock height="h-[180px]" />
          <SkeletonBlock height="h-[180px]" />
        </div>
        <div className="flex flex-col gap-5">
          <SkeletonBlock height="h-[160px]" />
          <SkeletonBlock height="h-[140px]" />
        </div>
      </div>
    </PageSkeleton>
  );
}
