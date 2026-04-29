import { PageSkeleton, SkeletonBlock } from "@/components/molecules/page-skeleton";

/**
 * /app/practice — route-level skeleton.
 * Three-column planner layout: drill library / plan / AI sidebar.
 */
export default function PracticeLoading() {
  return (
    <PageSkeleton variant="blank" titleWidth="w-44" subtitleWidth="w-60">
      {/* Subsystem switcher row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SkeletonBlock height="h-[56px]" />
        <SkeletonBlock height="h-[56px]" />
        <SkeletonBlock height="h-[56px]" />
      </div>
      {/* Editor: drill library / plan / AI */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-5">
        <SkeletonBlock height="h-[480px]" />
        <SkeletonBlock height="h-[600px]" />
        <div className="flex flex-col gap-3">
          <SkeletonBlock height="h-[260px]" />
          <SkeletonBlock height="h-[200px]" />
        </div>
      </div>
    </PageSkeleton>
  );
}
