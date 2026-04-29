import { PageSkeleton, SkeletonBlock } from "@/components/molecules/page-skeleton";

/**
 * /app/games/[id] — route-level skeleton.
 * Game detail uses a hero + tabs + roster grid pattern.
 */
export default function GameDetailLoading() {
  return (
    <PageSkeleton variant="blank" titleWidth="w-64" subtitleWidth="w-48">
      <SkeletonBlock height="h-[180px]" />
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        <SkeletonBlock height="h-[200px]" />
        <SkeletonBlock height="h-[200px]" />
      </div>
    </PageSkeleton>
  );
}
