/**
 * PrintPracticeView — Printable practice plan layout.
 * Route: /practice/:id/print
 *
 * Uses CSS @media print (same pattern as PrintLineupView).
 * BEM-style class names to avoid Tailwind purge issues.
 */
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import {
  fetchPracticePlan,
  fetchPracticeBlocks,
  type PracticePlan,
  type PracticeBlockWithCoach,
} from "@/services/practiceService";

// ── Helpers ────────────────────────────────────────────────────────

function formatTime12(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function blockDur(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// ── Component ──────────────────────────────────────────────────────

export default function PrintPracticeView() {
  const { id: planId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<PracticePlan | null>(null);
  const [blocks, setBlocks] = useState<PracticeBlockWithCoach[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!planId) return;
    const [planRes, blocksRes] = await Promise.all([
      fetchPracticePlan(planId),
      fetchPracticeBlocks(planId),
    ]);
    if (planRes.data) setPlan(planRes.data);
    setBlocks(blocksRes.data);
    setLoading(false);
  }, [planId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading || !plan) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Group blocks by time slot
  const slots = new Map<string, PracticeBlockWithCoach[]>();
  for (const b of blocks) {
    const key = `${b.start_time}-${b.end_time}`;
    const arr = slots.get(key) || [];
    arr.push(b);
    slots.set(key, arr);
  }
  const sortedSlots = [...slots.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const formatDate = (d: string) => {
    const date = new Date(d + "T12:00:00");
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  return (
    <>
      <style>{`
        .pp-print-hide { }
        .pp-page { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 16px; }
        .pp-header { margin-bottom: 16px; border-bottom: 2px solid #222; padding-bottom: 8px; }
        .pp-title { font-size: 22px; font-weight: 800; margin: 0; }
        .pp-subtitle { font-size: 13px; color: #666; margin: 4px 0 0 0; }
        .pp-notes { font-size: 12px; color: #555; margin-top: 8px; font-style: italic; }
        .pp-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .pp-table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #666; padding: 6px 8px; border-bottom: 1px solid #ccc; }
        .pp-table td { font-size: 13px; padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
        .pp-time { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; width: 120px; }
        .pp-dur { font-size: 11px; color: #888; font-weight: 400; }
        .pp-activity { font-weight: 600; }
        .pp-group { font-size: 11px; color: #555; background: #f0f0f0; padding: 1px 6px; border-radius: 4px; display: inline-block; margin-left: 6px; }
        .pp-coach { font-size: 11px; color: #666; }
        .pp-coach-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
        .pp-block-notes { font-size: 11px; color: #888; margin-top: 2px; }
        .pp-concurrent { border-left: 3px solid #ddd; padding-left: 8px; margin-top: 4px; }
        .pp-footer { margin-top: 16px; font-size: 10px; color: #aaa; text-align: center; }
        @media print {
          .pp-print-hide { display: none !important; }
          @page { size: letter portrait; margin: 0.5in; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="pp-print-hide" style={{ padding: "12px 16px", display: "flex", gap: "8px", borderBottom: "1px solid #eee" }}>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/practice/${planId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
      </div>

      {/* Printable content */}
      <div className="pp-page">
        <div className="pp-header">
          <h1 className="pp-title">{plan.title}</h1>
          <p className="pp-subtitle">
            {formatDate(plan.practice_date)}
            {plan.team_level && ` — ${plan.team_level}`}
          </p>
          {plan.notes && <p className="pp-notes">{plan.notes}</p>}
        </div>

        {blocks.length === 0 ? (
          <p style={{ color: "#888", fontSize: "14px" }}>No blocks added to this practice plan.</p>
        ) : (
          <table className="pp-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Activity</th>
                <th>Coach</th>
              </tr>
            </thead>
            <tbody>
              {sortedSlots.map(([timeKey, slotBlocks]) => {
                const [start, end] = timeKey.split("-");
                const dur = blockDur(start, end);

                return slotBlocks.map((block, bi) => (
                  <tr key={block.id} style={bi > 0 ? { borderTop: "none" } : {}}>
                    {bi === 0 && (
                      <td className="pp-time" rowSpan={slotBlocks.length}>
                        {formatTime12(start)} – {formatTime12(end)}
                        <br />
                        <span className="pp-dur">{dur} min</span>
                      </td>
                    )}
                    <td>
                      <span className="pp-activity">{block.activity_name}</span>
                      {block.player_group && <span className="pp-group">{block.player_group}</span>}
                      {block.notes && <div className="pp-block-notes">{block.notes}</div>}
                    </td>
                    <td className="pp-coach">
                      {block.coach_name ? (
                        <>
                          {block.coach_color && (
                            <span className="pp-coach-dot" style={{ backgroundColor: block.coach_color }} />
                          )}
                          {block.coach_name}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        )}

        <div className="pp-footer">
          Powered by Rostr
        </div>
      </div>
    </>
  );
}
