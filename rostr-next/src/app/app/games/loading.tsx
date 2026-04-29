import { PageSkeleton } from "@/components/molecules/page-skeleton";

/**
 * /app/games — route-level skeleton.
 * Stacked game cards mirror the games list layout.
 */
export default function GamesLoading() {
  return <PageSkeleton variant="list" titleWidth="w-32" subtitleWidth="w-56" />;
}
