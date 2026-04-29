/**
 * PageSkeleton — shared route-loading primitive.
 *
 * Drop into any `loading.tsx` to get an instant chrome-on-the-page
 * placeholder while the server component finishes streaming. The thin
 * progress bar at the top mirrors the global `/app/loading.tsx` pattern
 * so navigation never feels frozen.
 *
 * Variants pre-bake common layouts so individual loading.tsx files stay
 * one-liners. Custom layouts can compose <SkeletonBlock /> + <SkeletonRow />
 * directly.
 *
 * Mobile tap-target rule (40px+) doesn't apply here — these are
 * non-interactive placeholders.
 */

interface PageSkeletonProps {
  /** Top loading bar visible during the wait. Defaults to true. */
  showProgressBar?: boolean;
  /** Optional title placeholder width (Tailwind w-* class). */
  titleWidth?: string;
  /** Optional subtitle placeholder width. */
  subtitleWidth?: string;
  /** Body layout — pick one or supply custom children. */
  variant?:
    | "cards" // grid of generic cards
    | "list" // stacked rows (rosters, schedules)
    | "split" // 2-column (planner-like)
    | "blank"; // header only
  children?: React.ReactNode;
}

export function PageSkeleton({
  showProgressBar = true,
  titleWidth = "w-48",
  subtitleWidth = "w-72",
  variant = "cards",
  children,
}: PageSkeletonProps) {
  return (
    <div className="flex-1 flex flex-col">
      {showProgressBar && (
        <div className="h-0.5 bg-red/20 overflow-hidden">
          <div className="h-full bg-red w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite]" />
        </div>
      )}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="max-w-layout-app mx-auto">
          <div className={`h-8 bg-muted/40 rounded ${titleWidth} mb-3 animate-pulse`} />
          <div className={`h-4 bg-muted/30 rounded ${subtitleWidth} mb-6 animate-pulse`} />
          {children ?? <DefaultBody variant={variant} />}
        </div>
      </div>
    </div>
  );
}

function DefaultBody({ variant }: { variant: PageSkeletonProps["variant"] }) {
  if (variant === "blank") return null;

  if (variant === "list") {
    // Roster / schedule pattern — stacked rows with consistent height
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (variant === "split") {
    // Planner / detail pattern — sticky-left + main column
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <div className="bg-card border border-hair rounded-lg h-[400px] animate-pulse" />
        <div className="flex flex-col gap-3">
          <div className="bg-card border border-hair rounded-lg h-[120px] animate-pulse" />
          <div className="bg-card border border-hair rounded-lg h-[200px] animate-pulse" />
          <div className="bg-card border border-hair rounded-lg h-[80px] animate-pulse" />
        </div>
      </div>
    );
  }

  // cards (default)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <SkeletonBlock key={i} />
      ))}
    </div>
  );
}

export function SkeletonBlock({ height = "h-24" }: { height?: string }) {
  return (
    <div className={`bg-card border border-hair rounded-lg ${height} animate-pulse`} />
  );
}

export function SkeletonRow() {
  return (
    <div className="bg-card border border-hair rounded-lg h-[64px] flex items-center px-4 gap-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-muted/40" />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-3 bg-muted/40 rounded w-32" />
        <div className="h-2.5 bg-muted/30 rounded w-48" />
      </div>
      <div className="w-12 h-5 bg-muted/30 rounded" />
    </div>
  );
}
