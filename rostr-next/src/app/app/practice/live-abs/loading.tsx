export default function LiveAbsLoading() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="h-0.5 bg-red/20 overflow-hidden">
        <div className="h-full bg-red w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite]" />
      </div>
      <div className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="max-w-layout-app mx-auto">
          <div className="h-7 bg-muted/40 rounded w-40 mb-2 animate-pulse" />
          <div className="h-4 bg-muted/30 rounded w-80 mb-6 animate-pulse" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 bg-card border border-hair rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
