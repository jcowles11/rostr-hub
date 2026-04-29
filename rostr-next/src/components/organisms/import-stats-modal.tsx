"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Check, FileText, TrendingUp } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import {
  parseGameChangerStatsCsv,
  isGameChangerStatsCsv,
  type GcPlayerRow,
} from "@/lib/csv";
import { importGameChangerStatsAction } from "@/app/app/roster/actions";
import { cn } from "@/lib/utils";

/**
 * ImportStatsModal — one-shot GameChanger stats upload.
 *
 * Flow:
 *   1. Paste/drop a GameChanger team stats CSV
 *   2. Preview — detects players (creating any new ones) + shows
 *      batting + pitching lines per player
 *   3. Confirm → upserts players + stats
 *
 * Unlike the roster importer, this one happily creates missing players
 * because a stats CSV for a whole team is the most natural first-time
 * onboarding path.
 */
export function ImportStatsModal({
  open,
  onOpenChange,
  levels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levels: string[];
}) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [assignLevel, setAssignLevel] = useState(levels[0] ?? "JV");
  const [step, setStep] = useState<"paste" | "preview" | "done">("paste");
  const [result, setResult] = useState<{
    playersCreated: number;
    battingRows: number;
    pitchingRows: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const parsed = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      return parseGameChangerStatsCsv(raw);
    } catch {
      return null;
    }
  }, [raw]);

  const detected = useMemo(() => {
    if (!raw.trim()) return false;
    try {
      return isGameChangerStatsCsv(raw);
    } catch {
      return false;
    }
  }, [raw]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setRaw(text);
    // Sniff a source note from the filename if the coach hasn't set one
    if (!sourceNote) {
      const clean = file.name
        .replace(/\.csv$/i, "")
        .replace(/_/g, " ")
        .trim();
      setSourceNote(clean);
    }
    setStep("preview");
  };

  const submit = async () => {
    if (!parsed) return;
    setError(null);
    setLoading(true);
    const r = await importGameChangerStatsAction({
      sourceNote: sourceNote.trim() || "GameChanger import",
      seasonYear,
      levelAssignment: assignLevel || undefined,
      players: parsed.players.map((p) => ({
        jersey: p.jersey,
        firstName: p.firstName,
        lastName: p.lastName,
        primaryPosition: p.primaryPosition,
        batting: p.batting,
        pitching: p.pitching,
      })),
    });
    setLoading(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setResult({
      playersCreated: r.playersCreated,
      battingRows: r.battingRows,
      pitchingRows: r.pitchingRows,
    });
    setStep("done");
    router.refresh();
  };

  const reset = () => {
    setRaw("");
    setStep("paste");
    setResult(null);
    setError(null);
  };

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      if (result?.battingRows) {
        toast.success(
          `Imported ${result.battingRows} batting lines + ${result.pitchingRows} pitching lines`,
          {
            description:
              result.playersCreated > 0
                ? `Created ${result.playersCreated} new player${result.playersCreated === 1 ? "" : "s"} on the roster.`
                : undefined,
          },
        );
      }
      reset();
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Import stats from GameChanger"
      description="Drop in a team stats CSV exported from GameChanger. We'll auto-detect players, batting, and pitching — and create any who aren't on your roster yet."
      size="lg"
    >
      {step === "paste" && (
        <div className="space-y-4">
          <label className="block">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="block w-full text-[12.5px] file:mr-3 file:px-3 file:py-2 file:rounded-sm file:border-0 file:bg-ink file:text-white file:font-semibold file:text-[12.5px] file:cursor-pointer"
            />
          </label>
          <div className="text-center text-[12px] text-ink-3">— or paste CSV text —</div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder='Paste the entire CSV — starts with a row like: "","","","Batting","","",...'
            rows={10}
            className="w-full font-mono text-[12px] bg-paper border border-hair rounded-sm px-3 py-2.5 outline-none focus:border-red"
          />
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
      )}

      {step === "preview" && parsed && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Summary
              value={parsed.players.length}
              label="Players detected"
              tone="grass"
            />
            <Summary
              value={parsed.players.filter((p) => p.batting.pa > 0).length}
              label="With batting"
            />
            <Summary
              value={parsed.players.filter((p) => p.pitching.outs > 0).length}
              label="With pitching"
            />
          </div>

          {detected ? (
            <div className="flex items-start gap-2 p-3 rounded-sm bg-grass-dim text-grass text-[12.5px]">
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Detected <b>GameChanger</b> export format. Section groups (Batting / Pitching / Fielding) mapped.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 rounded-sm bg-amber-soft text-amber-dark text-[12.5px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This doesn&apos;t look like a GameChanger stats CSV, but we&apos;ll try anyway. Check the preview below.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="type-label mb-1.5 block">Season year</label>
              <input
                type="number"
                value={seasonYear}
                onChange={(e) => setSeasonYear(parseInt(e.target.value, 10))}
                className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red font-mono"
              />
            </div>
            <div>
              <label className="type-label mb-1.5 block">Assign to level</label>
              <select
                value={assignLevel}
                onChange={(e) => setAssignLevel(e.target.value)}
                className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red"
              >
                <option value="">Don&apos;t assign</option>
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="type-label mb-1.5 block">Source note</label>
            <input
              type="text"
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
              placeholder="e.g. Heritage Eagles JV Spring 2026"
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red"
            />
            <div className="text-[10.5px] text-ink-3 mt-1">
              Shown on the player&apos;s profile under the imported stats.
            </div>
          </div>

          <div className="border border-hair rounded-sm overflow-hidden">
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full text-[11.5px]">
                <thead className="bg-paper sticky top-0 z-[1]">
                  <tr className="border-b border-hair">
                    {["#", "Player", "Pos", "G", "AVG", "OBP", "OPS", "HR", "RBI", "IP", "ERA", "K"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.players.map((p, i) => (
                    <PlayerPreviewRow key={i} p={p} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
              disabled={loading || parsed.players.length === 0}
              onClick={submit}
              className="px-4 h-[38px] rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold disabled:opacity-60"
            >
              {loading ? "Importing…" : `Import ${parsed.players.length} player${parsed.players.length === 1 ? "" : "s"} →`}
            </button>
          </ModalFooter>
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-4 text-center py-6">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-full bg-grass-dim text-grass">
            <TrendingUp className="w-7 h-7" />
          </div>
          <h3 className="font-display text-[20px] font-semibold tracking-tight">
            Stats loaded.
          </h3>
          <p className="text-[13px] text-ink-3 max-w-[380px] mx-auto leading-relaxed">
            <b className="text-ink">{result.battingRows}</b> batting lines +{" "}
            <b className="text-ink">{result.pitchingRows}</b> pitching lines
            saved for {seasonYear}.
            {result.playersCreated > 0 && (
              <>
                <br />
                <b className="text-ink">{result.playersCreated}</b> new player
                {result.playersCreated === 1 ? "" : "s"} created on your roster.
              </>
            )}
          </p>
          <p className="text-[11.5px] text-ink-3">
            Every player&apos;s profile, the roster table, and scout search
            now show these numbers.
          </p>
          <ModalFooter>
            <button
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
  tone?: "grass" | "amber" | "sky";
}) {
  return (
    <div
      className={cn(
        "p-2.5 rounded-sm border text-center",
        tone === "grass" && "bg-grass-dim border-grass/30",
        tone === "amber" && "bg-amber-soft border-amber/30",
        tone === "sky" && "bg-sky-soft border-sky/30",
        !tone && "bg-paper border-hair",
      )}
    >
      <div className="font-mono text-[22px] font-bold tracking-[-0.02em]">
        {value}
      </div>
      <div className="text-[9.5px] font-bold text-ink-3 uppercase tracking-[0.06em] mt-0.5">
        {label}
      </div>
    </div>
  );
}

function PlayerPreviewRow({ p }: { p: GcPlayerRow }) {
  return (
    <tr className="border-b border-hair-2 last:border-b-0 hover:bg-paper/60">
      <td className="px-2 py-1.5 font-mono text-ink-4">
        {p.jersey ?? "—"}
      </td>
      <td className="px-2 py-1.5 font-semibold">
        {p.firstName} {p.lastName}
      </td>
      <td className="px-2 py-1.5 font-mono text-ink-3">
        {p.primaryPosition ?? "—"}
      </td>
      <td className="px-2 py-1.5 font-mono">{p.batting.gp}</td>
      <td className="px-2 py-1.5 font-mono">
        {p.batting.ab > 0 ? formatPreviewAvg(p.batting.ba) : "—"}
      </td>
      <td className="px-2 py-1.5 font-mono">
        {p.batting.pa > 0 ? formatPreviewAvg(p.batting.obp) : "—"}
      </td>
      <td className="px-2 py-1.5 font-mono">
        {p.batting.pa > 0 ? formatPreviewAvg(p.batting.ops) : "—"}
      </td>
      <td className="px-2 py-1.5 font-mono">{p.batting.hr}</td>
      <td className="px-2 py-1.5 font-mono">{p.batting.rbi}</td>
      <td className="px-2 py-1.5 font-mono">
        {p.pitching.outs > 0 ? p.pitching.ip.toFixed(1) : "—"}
      </td>
      <td className="px-2 py-1.5 font-mono">
        {p.pitching.outs > 0 ? p.pitching.era.toFixed(2) : "—"}
      </td>
      <td className="px-2 py-1.5 font-mono">{p.pitching.k}</td>
    </tr>
  );
}

function formatPreviewAvg(n: number): string {
  if (n === 0) return "—";
  const s = n.toFixed(3);
  return s.startsWith("0") ? s.slice(1) : s;
}
