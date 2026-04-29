/**
 * Skeleton loading state for /me/profile.
 *
 * Stays close to the editor's actual layout so the page doesn't
 * "jump" when content lands — Apple iOS pattern. Bone-grey blocks
 * shimmer subtly via the `animate-shimmer` keyframe in globals.css.
 */
export default function ProfileEditorLoading() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-topbar h-12 px-3 flex items-center gap-2 bg-paper/85 backdrop-blur-xl border-b border-hair">
        <div className="w-9 h-9 rounded-full bg-hair-2" />
        <div className="flex-1 h-5 bg-hair-2 rounded-md max-w-[120px]" />
      </header>
      <div className="max-w-[640px] mx-auto px-4 sm:px-6 pt-5 pb-24">
        {/* Identity hero skeleton */}
        <div className="bg-card border border-hair rounded-2xl overflow-hidden mb-5">
          <div className="h-32 bg-gradient-to-br from-hair to-hair-2" />
          <div className="px-5 pt-12 pb-4">
            <div className="h-6 bg-hair-2 rounded-md w-2/3 mb-2" />
            <div className="h-4 bg-hair-2 rounded-md w-1/2" />
          </div>
        </div>
        {/* Section skeletons */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-hair rounded-2xl p-5 mb-5 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-hair-2" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-hair-2 rounded-md w-1/3" />
                <div className="h-3 bg-hair-2 rounded-md w-3/4" />
              </div>
            </div>
            <div className="h-11 bg-hair-2 rounded-xl" />
            <div className="h-11 bg-hair-2 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
