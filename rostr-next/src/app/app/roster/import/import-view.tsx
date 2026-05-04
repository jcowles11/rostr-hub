"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Upload, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  previewImportAction,
  commitImportAction,
  type PreviewResult,
} from "./actions";
import type { ParsedRow } from "@/lib/services/gamechanger-import";

/**
 * /app/roster/import — client view.
 *
 * Stage A: paste CSV → preview parses
 * Stage B: review parsed rows + dup warnings → check rows to import
 * Stage C: commit, show summary, route back to /app/roster
 *
 * GameChanger's "Export Roster" hands the coach a .csv file. They open
 * it in Excel/Numbers, copy all, paste here. Native file upload would
 * be slightly nicer UX but adds storage/MIME concerns that paste avoids.
 */

export function ImportView({
  programId,
  programName,
}: {
  programId: string;
  programName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<Set<number>>(
    new Set(),
  );

  function runPreview() {
    if (!csv.trim()) {
      toast.error("Paste your CSV first.");
      return;
    }
    startTransition(async () => {
      const res = await previewImportAction(csv);
      if (res.error || !res.result) {
        toast.error(res.error ?? "Couldn't parse CSV.");
        return;
      }
      setPreview(res.result);
      // Default-select all non-duplicate rows
      const dupSet = new Set(
        res.result.potentialDuplicates.map((d) => d.rowIndex),
      );
      setSelectedRowIndexes(
        new Set(
          res.result.rows
            .filter((r) => !dupSet.has(r.rowIndex))
            .map((r) => r.rowIndex),
        ),
      );
    });
  }

  function toggleRow(idx: number) {
    setSelectedRowIndexes((cur) => {
      const next = new Set(cur);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function commit() {
    if (!preview) return;
    const rowsToImport = preview.rows.filter((r) =>
      selectedRowIndexes.has(r.rowIndex),
    );
    if (rowsToImport.length === 0) {
      toast.error("Select at least one row to import.");
      return;
    }
    startTransition(async () => {
      const res = await commitImportAction({
        programId,
        rows: rowsToImport,
      });
      if (res.error || !res.result) {
        toast.error(res.error ?? "Import failed.");
        return;
      }
      toast.success(
        `Imported ${res.result.inserted} player${res.result.inserted === 1 ? "" : "s"}`,
        {
          description:
            res.result.failed.length > 0
              ? `${res.result.failed.length} row${res.result.failed.length === 1 ? "" : "s"} failed`
              : undefined,
        },
      );
      router.push("/app/roster");
    });
  }

  const dupSet = new Set(
    (preview?.potentialDuplicates ?? []).map((d) => d.rowIndex),
  );

  return (
    <div className="min-h-[100dvh] bg-paper">
      <header className="sticky top-0 z-topbar h-12 px-3 flex items-center gap-2 bg-paper/85 backdrop-blur-xl backdrop-saturate-150 border-b border-hair">
        <Link
          href="/app/roster"
          className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-hair-2 active:scale-[0.92] transition"
        >
          <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2.25} />
        </Link>
        <div className="flex-1 min-w-0 font-display text-[15px] font-bold tracking-tight truncate">
          Import roster
        </div>
        <span className="text-[10.5px] font-mono uppercase tracking-[0.06em] text-ink-3 px-2 py-1 rounded-full bg-paper-deep border border-hair">
          {programName}
        </span>
      </header>

      <main className="max-w-[760px] mx-auto px-4 sm:px-6 pt-5 pb-24">
        {!preview ? (
          // Stage A: paste CSV
          <>
            <h1 className="font-display text-[20px] font-semibold tracking-tight">
              Paste your GameChanger roster
            </h1>
            <p className="mt-2 text-[12.5px] text-ink-3 leading-relaxed max-w-[520px]">
              In GameChanger: Team Settings → Roster → Export. Open the .csv
              in Excel or Numbers, select all, copy, and paste below. We&apos;ll
              show you the preview before importing anything.
            </p>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder="Paste CSV content here..."
              rows={14}
              className={cn(
                "mt-5 w-full rounded-xl border border-hair bg-card px-3 py-2.5 text-[12px] font-mono",
                "focus:outline-none focus:border-red focus:ring-2 focus:ring-red-soft",
              )}
            />
            <button
              type="button"
              onClick={runPreview}
              disabled={pending || !csv.trim()}
              className={cn(
                "mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink text-paper px-5 py-2.5 text-[13.5px] font-bold",
                "transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
              )}
            >
              {pending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Parsing…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Preview import
                </>
              )}
            </button>
          </>
        ) : (
          // Stage B: review + commit
          <>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="font-display text-[20px] font-semibold tracking-tight">
                Preview ({preview.rows.length} rows)
              </h1>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-[11.5px] text-ink-3 hover:text-red hover:underline"
              >
                Back to paste
              </button>
            </div>
            {preview.unrecognizedColumns.length > 0 && (
              <p className="mt-2 text-[11.5px] text-ink-3 leading-snug">
                Ignored columns: {preview.unrecognizedColumns.join(", ")}
              </p>
            )}
            {preview.errors.length > 0 && (
              <div className="mt-3 bg-amber-soft/40 border border-amber/25 rounded-xl px-4 py-3 text-[12px]">
                <div className="font-bold text-amber mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {preview.errors.length} parse error
                  {preview.errors.length === 1 ? "" : "s"}
                </div>
                {preview.errors.slice(0, 5).map((e) => (
                  <div key={e.rowIndex} className="text-ink-2">
                    Row {e.rowIndex + 2}: {e.message}
                  </div>
                ))}
              </div>
            )}
            <ul className="mt-4 space-y-1">
              {preview.rows.map((row) => {
                const isDup = dupSet.has(row.rowIndex);
                const selected = selectedRowIndexes.has(row.rowIndex);
                return (
                  <li
                    key={row.rowIndex}
                    onClick={() => toggleRow(row.rowIndex)}
                    className={cn(
                      "cursor-pointer flex items-center gap-3 px-3 py-2 rounded-xl border bg-card",
                      "transition-all hover:border-ink-3",
                      selected && "border-grass/40 bg-grass-dim/20",
                      isDup && !selected && "border-amber/30 bg-amber-soft/20",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "w-5 h-5 rounded-md border shrink-0 flex items-center justify-center",
                        selected
                          ? "bg-grass border-grass"
                          : "bg-paper border-hair",
                      )}
                    >
                      {selected && (
                        <CheckCircle2
                          className="w-3 h-3 text-white"
                          strokeWidth={3}
                        />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate">
                        {row.firstName} {row.lastName}
                        {isDup && (
                          <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.06em] text-amber">
                            possible duplicate
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-3">
                        {row.positions.join("/") || "—"}
                        {row.grade != null && ` · Grade ${row.grade}`}
                        {row.jerseyNumber != null && ` · #${row.jerseyNumber}`}
                        {row.bats && ` · B/${row.bats}`}
                        {row.throws && ` T/${row.throws}`}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex items-center justify-between gap-3 sticky bottom-3 bg-paper/95 backdrop-blur p-3 -mx-3 rounded-xl border border-hair">
              <div className="text-[12px] text-ink-2 font-medium">
                {selectedRowIndexes.size} selected
              </div>
              <button
                type="button"
                onClick={commit}
                disabled={pending || selectedRowIndexes.size === 0}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-grass text-white px-4 py-2.5 text-[13.5px] font-bold",
                  "shadow-[0_2px_10px_-2px_rgba(47,125,79,0.4)]",
                  "transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
                )}
              >
                {pending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Importing…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Import {selectedRowIndexes.size} player
                    {selectedRowIndexes.size === 1 ? "" : "s"}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
