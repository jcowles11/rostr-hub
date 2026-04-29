import Link from "next/link";
import { redirect } from "next/navigation";
import { BookmarkCheck } from "lucide-react";
import {
  getCurrentRecruiter,
  fetchSavedSearches,
  computeSavedSearchDiffs,
} from "@/lib/services/recruiter";
import { SavedSearchesView } from "./searches-view";

export default async function SavedSearchesPage() {
  const recruiter = await getCurrentRecruiter();
  if (!recruiter) redirect("/scout/setup");
  const searches = await fetchSavedSearches(recruiter.id);
  const diffs = await computeSavedSearchDiffs(searches);
  // Build a quick lookup: searchId → newMatchesCount
  const newMatchesById = new Map(diffs.map((d) => [d.searchId, d.newPlayerIds.length]));
  const currentTotalById = new Map(diffs.map((d) => [d.searchId, d.total]));

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-layout-app mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[24px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
              Saved searches
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1">
              Filter presets you can re-run with one tap. Turn on email alerts
              to hear when new players match.
            </p>
          </div>
        </div>

        {searches.length === 0 ? (
          <div className="p-10 bg-card border border-dashed border-hair rounded-lg text-center">
            <div className="inline-flex w-12 h-12 rounded-full bg-red-soft text-red items-center justify-center mb-3">
              <BookmarkCheck className="w-6 h-6" />
            </div>
            <h2 className="font-display text-[20px] font-semibold tracking-tight">
              No saved searches yet
            </h2>
            <p className="text-[13px] text-ink-3 mt-2 max-w-[440px] mx-auto leading-relaxed">
              Build a filter set on the Search page, then click
              &quot;Save search&quot; to pin it here.
            </p>
            <Link
              href="/scout"
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 bg-ink hover:bg-red text-white rounded-sm text-[13px] font-semibold"
            >
              Go to search →
            </Link>
          </div>
        ) : (
          <SavedSearchesView
            searches={searches}
            newMatchesById={Object.fromEntries(newMatchesById)}
            currentTotalById={Object.fromEntries(currentTotalById)}
          />
        )}
      </div>
    </div>
  );
}
