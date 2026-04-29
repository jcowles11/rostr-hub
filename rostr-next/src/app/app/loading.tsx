/**
 * Route-level loading UI for the coach app.
 * Renders instantly between server-component navigations so the app
 * never looks frozen. A thin progress bar at the top mirrors the
 * "tap feels instant" UX coaches expect on mobile.
 */
export default function AppLoading() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Progress bar */}
      <div className="h-0.5 bg-red/20 overflow-hidden">
        <div className="h-full bg-red w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite]" />
      </div>
      {/* Skeleton page */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="max-w-layout-app mx-auto">
          <div className="h-8 bg-muted/40 rounded w-48 mb-3 animate-pulse" />
          <div className="h-4 bg-muted/30 rounded w-72 mb-6 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-card border border-hair rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
