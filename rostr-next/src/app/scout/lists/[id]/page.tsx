import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getCurrentRecruiter,
  fetchListDetail,
  classYearForGrade,
} from "@/lib/services/recruiter";
import { ListDetailView } from "./detail-view";

export default async function ListDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const recruiter = await getCurrentRecruiter();
  if (!recruiter) redirect("/scout/setup");

  const detail = await fetchListDetail(params.id);
  if (!detail) notFound();

  const playersWithClass = detail.players.map((p) => ({
    ...p,
    classYear: p.grade != null ? classYearForGrade(p.grade) : null,
  }));

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-layout-app mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Link
          href="/scout/lists"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> All lists
        </Link>

        <div className="flex items-start gap-3 sm:gap-4 mb-6">
          <span
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-md flex items-center justify-center text-[26px] shrink-0"
            style={{ background: detail.list.color ? `${detail.list.color}22` : "#f8dedc" }}
          >
            {detail.list.emoji ?? "•"}
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-[24px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
              {detail.list.name}
            </h1>
            <div className="text-[13.5px] text-ink-3 mt-1">
              {detail.list.playerCount}{" "}
              {detail.list.playerCount === 1 ? "player" : "players"}
            </div>
            {detail.list.description && (
              <p className="mt-2 text-[13px] text-ink-2">{detail.list.description}</p>
            )}
          </div>
        </div>

        <ListDetailView listId={detail.list.id} players={playersWithClass} />
      </div>
    </div>
  );
}
