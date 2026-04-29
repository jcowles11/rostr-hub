export default function LiveAbsStatsLoading() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="h-0.5 bg-red/20 overflow-hidden">
        <div className="h-full bg-red w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite]" />
      </div>
      <div className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div className="h-8 bg-muted/40 rounded w-48 mb-3 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-card border border-hair rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="mt-7 h-64 bg-card border border-hair rounded-lg animate-pulse" />
          <div className="mt-7 h-48 bg-card border border-hair rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}
