"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Upload,
  FileText,
  Check,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import {
  parsePlayerCsv,
  detectHeaderMapping,
  type ParsedPlayer,
  type HeaderMapping,
} from "@/lib/csv";
import { bulkCreatePlayersAction } from "@/app/app/roster/actions";
import { cn } from "@/lib/utils";

const SAMPLE = `First Name,Last Name,Jersey,Position,Grade,Bats,Throws
Marcus,Johnson,21,CF,12,R,R
Jordan,Kim,12,SS,11,L,R
Alex,Riggs,7,P/1B,12,R,R
DeAndre,Brooks,33,2B/3B,11,R,R`;

export function ImportRosterModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [step, setStep] = useState<"paste" | "preview" | "done">("paste");
  const [result, setResult] = useState<{ inserted: number; skipped: number; invalid: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // useTransition gives us a non-blocking pending state without manual
  // setLoading bookkeeping — pairs with router.refresh() afterward.
  const [isPending, startTransition] = useTransition();
  const loading = isPending;

  const parsed = useMemo<ParsedPlayer[]>(() => {
    if (!raw.trim()) return [];
    try {
      return parsePlayerCsv(raw);
    } catch {
      return [];
    }
  }, [raw]);

  const mapping = useMemo<HeaderMapping>(() => {
    if (!raw.trim()) return { detected: [], missing: [] };
    try {
      return detectHeaderMapping(raw);
    } catch {
      return { detected: [], missing: [] };
    }
  }, [raw]);

  const valid = parsed.filter((p) => !p.invalid);
  const invalid = parsed.filter((p) => p.invalid);
  const withWarnings = parsed.filter((p) => (p.warnings?.length ?? 0) > 0);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setRaw(text);
    setStep("preview");
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const r = await bulkCreatePlayersAction(
        valid.map((p) => ({
          firstName: p.firstName,
          lastName: p.lastName,
          grade: p.grade,
          positions: p.positions,
          bats: p.bats,
          throws: p.throws,
          playerNumber: p.playerNumber,
        })),
      );
      if (r.error) {
        setError(r.error);
        return;
      }
      setResult({
        inserted: r.inserted,
        skipped: r.skipped,
        invalid: r.invalid ?? 0,
      });
      setStep("done");
      router.refresh();
    });
  };

  const reset = () => {
    setRaw(""); setStep("paste"); setResult(null); setError(null);
  };

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      // If we successfully imported, toast on close.
      if (result?.inserted) {
        const extras: string[] = [];
        if (result.skipped > 0) extras.push(`${result.skipped} skipped`);
        if (result.invalid > 0) extras.push(`${result.invalid} invalid`);
        toast.success(`Imported ${result.inserted} player${result.inserted === 1 ? "" : "s"}`, {
          description: extras.length > 0 ? extras.join(" · ") : undefined,
        });
      }
      reset();
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Import roster"
      description="Paste from GameChanger, MaxPreps, Google Sheets — or upload a CSV. We'll auto-detect columns."
      size="lg"
    >
      {step === "paste" && (
        <div className="space-y-4">
          <DropZone onFile={handleFile} />
          <div className="text-center text-[12px] text-ink-3">— or paste CSV text —</div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={SAMPLE}
            rows={10}
            className="w-full font-mono text-[12px] bg-paper border border-hair rounded-sm px-3 py-2.5 outline-none focus:border-red focus:ring-2 focus:ring-red-soft"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setRaw(SAMPLE)}
              className="text-[12px] text-ink-3 hover:text-ink font-semibold"
            >
              Use sample data
            </button>
            <ModalFooter>
              <button
                type="button"
                onClick={() => close(false)}
                className="px-4 h-[38px] rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!raw.trim()}
                onClick={() => setStep("preview")}
                className="px-4 h-[38px] rounded-sm bg-ink hover:bg-red text-white text-[13px] font-semibold disabled:opacity-60"
              >
                Preview →
              </button>
            </ModalFooter>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Column mapping card */}
          {mapping.detected.length > 0 && (
            <div className="p-3 bg-paper border border-hair rounded-sm">
              <div className="type-label mb-1.5">Detected columns</div>
              <div className="flex flex-wrap gap-1.5">
                {mapping.detected.map((m) => (
                  <span
                    key={m.source}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-card border border-hair-2 text-[11px]"
                    title={`"${m.source}" → ${m.mapped}`}
                  >
                    <span className="font-semibold">{m.source}</span>
                    <span className="text-ink-4">→</span>
                    <span className="font-mono text-ink-3">{m.mapped}</span>
                  </span>
                ))}
              </div>
              {mapping.missing.length > 0 && (
                <div className="mt-2 text-[11.5px] text-red">
                  Missing columns: {mapping.missing.join(", ")}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <Summary value={parsed.length} label="Parsed" />
            <Summary value={valid.length} label="Will import" tone="grass" />
            <Summary value={invalid.length} label="Will skip" tone="amber" />
            <Summary value={withWarnings.length} label="Warnings" tone="sky" />
          </div>

          <div className="border border-hair rounded-sm overflow-hidden">
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-paper sticky top-0">
                  <tr className="border-b border-hair">
                    {["", "#", "First", "Last", "Jersey", "Grade", "Positions", "B/T"].map((h) => (
                      <th key={h} className="text-left px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((p, i) => {
                    const hasWarn = (p.warnings?.length ?? 0) > 0;
                    return (
                      <>
                        <tr
                          key={`row-${i}`}
                          className={cn(
                            "border-b border-hair-2 last:border-b-0",
                            p.invalid && "bg-amber-soft/40 text-ink-3",
                          )}
                        >
                          <td className="px-2 py-1.5">
                            {p.invalid ? (
                              <AlertCircle className="w-3.5 h-3.5 text-amber" />
                            ) : hasWarn ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-sky" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-grass" />
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 font-mono text-ink-4">{i + 1}</td>
                          <td className="px-2.5 py-1.5">{p.firstName || <em className="text-ink-4">—</em>}</td>
                          <td className="px-2.5 py-1.5 font-semibold">{p.lastName || <em className="text-ink-4">—</em>}</td>
                          <td className="px-2.5 py-1.5 font-mono">{p.playerNumber ?? ""}</td>
                          <td className="px-2.5 py-1.5 font-mono">{p.grade ?? ""}</td>
                          <td className="px-2.5 py-1.5 font-mono">{p.positions?.join("/") ?? ""}</td>
                          <td className="px-2.5 py-1.5 font-mono">
                            {p.bats ?? "—"}/{p.throws ?? "—"}
                          </td>
                        </tr>
                        {(p.invalidReason || hasWarn) && (
                          <tr key={`reason-${i}`} className="border-b border-hair-2 last:border-b-0 bg-paper/60">
                            <td className="px-2 py-1" />
                            <td colSpan={7} className="px-2.5 py-1 text-[11px]">
                              {p.invalidReason && (
                                <span className="text-amber font-semibold">
                                  ⚠ {p.invalidReason}
                                </span>
                              )}
                              {hasWarn && (
                                <span className="text-sky ml-2">
                                  {p.warnings!.join(" · ")}
                                </span>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11.5px] text-ink-3">
            <b>Skipped:</b> rows missing first or last name.{" "}
            <b>Warnings:</b> the row will still import but something looks off —
            open each triangle to see.{" "}
            <b>Duplicates:</b> existing players matched by full name (case-insensitive)
            won&apos;t be re-inserted.
          </p>

          <ModalFooter>
            <button
              type="button"
              onClick={() => setStep("paste")}
              disabled={loading}
              className="min-h-[40px] px-4 rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink disabled:opacity-50"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={loading || valid.length === 0}
              onClick={submit}
              className="min-h-[40px] px-4 rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Importing {valid.length} row{valid.length === 1 ? "" : "s"}…
                </>
              ) : (
                <>Import {valid.length} player{valid.length === 1 ? "" : "s"}</>
              )}
            </button>
          </ModalFooter>
        </div>
      )}

      {step === "done" && result && (
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-full bg-grass-dim text-grass flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <h3 className="font-display text-[22px] font-semibold tracking-tight">
            {result.inserted} player{result.inserted === 1 ? "" : "s"} added
          </h3>
          {/* Detailed breakdown so the coach can reconcile against
              the source CSV — every row is accounted for. */}
          <div className="mt-4 grid grid-cols-3 gap-2 max-w-[420px] mx-auto">
            <ResultStat value={result.inserted} label="Imported" tone="grass" />
            <ResultStat value={result.skipped} label="Skipped" tone="amber" hint="Duplicates" />
            <ResultStat value={result.invalid} label="Invalid" tone="red" hint="Bad data" />
          </div>
          {(result.skipped > 0 || result.invalid > 0) && (
            <p className="text-[12px] text-ink-3 mt-3 max-w-[420px] mx-auto leading-relaxed">
              {result.skipped > 0 && (
                <>
                  <b className="text-ink-2">Skipped</b> rows already match an
                  existing player by name (case-insensitive).{" "}
                </>
              )}
              {result.invalid > 0 && (
                <>
                  <b className="text-ink-2">Invalid</b> rows failed validation
                  (missing name, jersey out of range, etc.).
                </>
              )}
            </p>
          )}
          <ModalFooter>
            <button
              type="button"
              onClick={reset}
              className="min-h-[40px] px-4 rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink"
            >
              Import more
            </button>
            <button
              type="button"
              onClick={() => close(false)}
              className="min-h-[40px] px-4 rounded-sm bg-ink hover:bg-red text-white text-[13px] font-semibold"
            >
              Done
            </button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  );
}

function Summary({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "grass" | "amber" | "sky";
}) {
  return (
    <div className="p-3 bg-paper border border-hair rounded-sm">
      <div
        className={cn(
          "font-mono text-[22px] font-semibold leading-none",
          tone === "grass" && "text-grass",
          tone === "amber" && "text-amber",
          tone === "sky" && "text-sky",
        )}
      >
        {value}
      </div>
      <div className="type-label mt-1.5">{label}</div>
    </div>
  );
}

/**
 * ResultStat — variant used on the post-import success screen. Lays out
 * imported / skipped / invalid side-by-side with color-coded numbers
 * so the coach can reconcile against the source CSV at a glance.
 */
function ResultStat({
  value,
  label,
  tone,
  hint,
}: {
  value: number;
  label: string;
  tone: "grass" | "amber" | "red";
  hint?: string;
}) {
  return (
    <div className="p-3 bg-paper border border-hair rounded-sm text-center">
      <div
        className={cn(
          "font-mono text-[24px] font-semibold leading-none",
          tone === "grass" && "text-grass",
          tone === "amber" && "text-amber",
          tone === "red" && "text-red",
        )}
      >
        {value}
      </div>
      <div className="type-label mt-1.5">{label}</div>
      {hint && (
        <div className="text-[10.5px] text-ink-3 mt-0.5">{hint}</div>
      )}
    </div>
  );
}

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [drag, setDrag] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 cursor-pointer transition-colors",
        drag ? "border-red bg-red-soft/50" : "border-hair bg-card hover:border-ink-3",
      )}
    >
      <div className="w-10 h-10 rounded-full bg-paper flex items-center justify-center text-ink-3">
        <Upload className="w-4 h-4" />
      </div>
      <div className="text-center">
        <div className="font-semibold text-[14px]">Drop a CSV here</div>
        <div className="text-[11.5px] text-ink-3 mt-0.5">
          Or click to choose — from GameChanger, MaxPreps, Google Sheets…
        </div>
      </div>
      <input
        type="file"
        accept=".csv,.tsv,.txt,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-ink-4 font-mono">
        <FileText className="w-3 h-3" /> CSV / TSV / plain text
      </span>
    </label>
  );
}
