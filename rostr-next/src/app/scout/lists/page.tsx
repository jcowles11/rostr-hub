import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Heart } from "lucide-react";
import { getCurrentRecruiter, fetchLists } from "@/lib/services/recruiter";
import { ListsGrid } from "./lists-grid";

export default async function ScoutListsPage() {
  const recruiter = await getCurrentRecruiter();
  if (!recruiter) redirect("/scout/setup");

  const lists = await fetchLists(recruiter.id);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-layout-app mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[24px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
              My lists
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1">
              Your prospect boards. Watch list, top 25, already offered — however you want to organize.
            </p>
          </div>
        </div>

        {lists.length === 0 ? (
          <EmptyLists />
        ) : (
          <ListsGrid lists={lists} />
        )}
      </div>
    </div>
  );
}

function EmptyLists() {
  return (
    <div className="p-10 bg-card border border-dashed border-hair rounded-lg text-center">
      <div className="inline-flex w-12 h-12 rounded-full bg-red-soft text-red items-center justify-center mb-3">
        <Heart className="w-6 h-6" />
      </div>
      <h2 className="font-display text-[20px] font-semibold tracking-tight">
        No lists yet
      </h2>
      <p className="text-[13px] text-ink-3 mt-2 max-w-[440px] mx-auto leading-relaxed">
        Save players from any search result to start a list. Name them whatever
        makes sense to you — &quot;Watch list 2027&quot;, &quot;Top 10 arms&quot;,
        &quot;JUCO fallback&quot;.
      </p>
      <Link
        href="/scout"
        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 bg-ink hover:bg-red text-white rounded-sm text-[13px] font-semibold transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Find prospects
      </Link>
    </div>
  );
}
