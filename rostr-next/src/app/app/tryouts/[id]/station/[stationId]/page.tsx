import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { StationScoringView } from "./station-scoring-view";
import { fetchStationScoringContext } from "@/lib/services/tryouts";

/**
 * /app/tryouts/[id]/station/[stationId] — mobile scoring page.
 * Optimized for coaches on phones at a station. Big tap targets, keypad
 * entry, save-and-advance to the next player. Works on tablet too.
 */
export default async function StationScoringPage({
  params,
}: {
  params: { id: string; stationId: string };
}) {
  const ctx = await fetchStationScoringContext(params.id, params.stationId);

  if (!ctx) notFound();
  if ((ctx as { migrationMissing?: boolean }).migrationMissing) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <div className="max-w-[420px] w-full bg-card border border-hair rounded-lg p-6">
          <div className="w-10 h-10 rounded-full bg-amber-soft text-amber inline-flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h1 className="font-display text-[20px] font-semibold tracking-tight">
            Tryouts not set up
          </h1>
          <p className="text-[13px] text-ink-3 mt-2">
            Apply migration 20260315000008_tryouts.sql, then reload.
          </p>
          <Link
            href="/app"
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 bg-ink text-white rounded-sm text-[12.5px] font-semibold"
          >
            ← Back to Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <StationScoringView
      tryoutId={params.id}
      stationId={params.stationId}
      tryout={ctx.tryout}
      station={ctx.station}
      attendees={ctx.attendees}
    />
  );
}
