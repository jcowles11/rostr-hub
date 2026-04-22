"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Upload, FileText, Check } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { parsePlayerCsv, type ParsedPlayer } from "@/lib/csv";
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
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const parsed = useMemo<ParsedPlayer[]>(() => {
    if (!raw.trim()) return [];
    try {
      return parsePlayerCsv(raw);
    } catch {
      return [];
    }
  }, [raw]);

  const valid = parsed.filter((p) => !p.invalid);
  const invalid = parsed.filter((p) => p.invalid);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setRaw(text);
    setStep("preview");
  };

  const submit = async () => {
    setError(null);
    setLoading(true);
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
    setLoading(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setResult({ inserted: r.inserted, skipped: r.skipped });
    setStep("done");
    router.refresh();
  };

  const reset = () => {
    setRaw(""); setStep("paste"); setResult(null); setError(null);
  };

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      // If we successfully imported, toast on close.
      if (result?.inserted) {
        toast.success(`Imported ${result.inserted} player${result.inserted === 1 ? "" : "s"}`, {
          description: result.skipped > 0 ? `${result.skipped} skipped (duplicates or invalid)` : undefined,
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

          <div className="grid grid-cols-3 gap-3">
            <Summary value={parsed.length} label="Parsed rows" />
            <Summary value={valid.length} label="Will import" tone="grass" />
            <Summary value={invalid.length} label="Will skip" tone="amber" />
          </div>

          <div className="border border-hair rounded-sm overflow-hidden">
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-paper sticky top-0">
                  <tr className="border-b border-hair">
                    {["#", "First", "Last", "Jersey", "Grade", "Positions", "B/T"].map((h) => (
                      <th key={h} className="text-left px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((p, i) => (
                    <tr
                      key={i}
                      className={cn(
                        "border-b border-hair-2 last:border-b-0",
                        p.invalid && "bg-amber-soft/40 text-ink-3",
                      )}
                    >
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11.5px] text-ink-3">
            Skipped rows are missing first or last name. Existing players (matched by full
            name, case-insensitive) won&apos;t be duplicated.
          </p>

          <ModalFooter>
            <button
              type="button"
              onClick={() => setStep("paste")}
              className="px-4 h-[38px] rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={loading || valid.length === 0}
              onClick={submit}
              className="px-4 h-[38px] rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold disabled:opacity-60"
            >
              {loading ? "Importing…" : `Import ${valid.length} player${valid.length === 1 ? "" : "s"}`}
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
          {result.skipped > 0 && (
            <p className="text-[13px] text-ink-3 mt-1">
              {result.skipped} skipped (duplicates or missing names)
            </p>
          )}
          <ModalFooter>
            <button
              type="button"
              onClick={reset}
              className="px-4 h-[38px] rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink"
            >
              Import more
            </button>
            <button
              type="button"
              onClick={() => close(false)}
              className="px-4 h-[38px] rounded-sm bg-ink hover:bg-red text-white text-[13px] font-semibold"
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
  tone?: "grass" | "amber";
}) {
  return (
    <div className="p-3 bg-paper border border-hair rounded-sm">
      <div
        className={cn(
          "font-mono text-[22px] font-semibold leading-none",
          tone === "grass" && "text-grass",
          tone === "amber" && "text-amber",
        )}
      >
        {value}
      </div>
      <div className="type-label mt-1.5">{label}</div>
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
