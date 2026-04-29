export default function LiveScoringLoading() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="h-0.5 bg-red/20 overflow-hidden">
        <div className="h-full bg-red w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite]" />
      </div>
      <div className="flex-1 px-3 pt-3 pb-12">
        <div className="max-w-[600px] mx-auto">
          <div className="h-8 bg-muted/40 rounded w-3/4 mb-2 animate-pulse" />
          <div className="h-4 bg-muted/30 rounded w-1/2 mb-4 animate-pulse" />
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 bg-card border border-hair rounded-md animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-14 bg-card border border-hair rounded-md animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
