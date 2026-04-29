import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, TrendingUp } from "lucide-react";
import { getCurrentRecruiter, fetchRecentViews } from "@/lib/services/recruiter";

export default async function RecentViewsPage() {
  const recruiter = await getCurrentRecruiter();
  if (!recruiter) redirect("/scout/setup");
  const views = await fetchRecentViews(recruiter.id, 50);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-layout-app mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h1 className="font-display text-[24px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
          Recent views
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-1 mb-6">
          Players you&apos;ve opened recently. Great for circling back on prospects
          you saw last week but didn&apos;t save.
        </p>

        {views.length === 0 ? (
          <div className="p-10 bg-card border border-dashed border-hair rounded-lg text-center">
            <div className="inline-flex w-12 h-12 rounded-full bg-red-soft text-red items-center justify-center mb-3">
              <Clock className="w-6 h-6" />
            </div>
            <div className="font-display text-[18px] font-semibold tracking-tight">
              Nothing yet
            </div>
            <div className="text-[12.5px] text-ink-3 mt-1">
              Open a player profile and we&apos;ll track your recent views here.
            </div>
          </div>
        ) : (
          <div className="bg-card border border-hair rounded-lg">
            {views.map((v, i) => (
              <Link
                key={`${v.playerId}-${i}`}
                href={`/p/${v.profileSlug}`}
                className="flex items-center gap-4 px-5 py-3 border-b border-hair-2 last:border-b-0 hover:bg-paper"
              >
                <TrendingUp className="w-4 h-4 text-ink-3 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">
                    {v.firstName} {v.lastName}
                  </div>
                  <div className="font-mono text-[11px] text-ink-3 mt-0.5">
                    {new Date(v.viewedAt).toLocaleString()}
                  </div>
                </div>
                <span className="text-[12px] text-red font-semibold">View →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
