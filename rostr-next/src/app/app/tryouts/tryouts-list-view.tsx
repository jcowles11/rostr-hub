"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Trophy,
  Plus,
  Bell,
  ChevronRight,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { cn } from "@/lib/utils";
import { comingSoon } from "@/lib/coming-soon";
import { RowActions } from "@/components/molecules/row-actions";
import { CreateTryoutModal } from "@/components/organisms/create-tryout-modal";
import { deleteTryoutAction } from "./actions";
import type { Tryout } from "@/lib/services/tryouts";

export function TryoutsListView({
  tryouts,
  programName,
}: {
  tryouts: Tryout[];
  programName: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: programName }, { label: "Tryouts" }]}
        actions={[
          { kind: "icon", icon: <Bell className="w-[15px] h-[15px]" />, onClick: () => comingSoon("Notifications") },
          {
            kind: "primary",
            label: "New tryout",
            icon: <Plus className="w-[15px] h-[15px]" />,
            onClick: () => setCreateOpen(true),
          },
        ]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div>
            <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
              Tryouts
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1">
              Seasonal tryouts with station-based scoring and live rankings.
              Verdicts flow into the roster and verified measurables land on each
              player&apos;s public profile.
            </p>
          </div>

          {tryouts.length === 0 ? (
            <EmptyState onCreate={() => setCreateOpen(true)} />
          ) : (
            <div className="mt-7 space-y-3">
              {tryouts.map((t) => (
                <TryoutRow key={t.id} tryout={t} onDelete={() => router.refresh()} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateTryoutModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setCreateOpen(false);
          router.push(`/app/tryouts/${id}`);
        }}
      />
    </>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-10 p-10 bg-card border border-dashed border-hair rounded-lg text-center">
      <div className="inline-flex w-12 h-12 rounded-full bg-red-soft text-red items-center justify-center mb-3">
        <Trophy className="w-6 h-6" />
      </div>
      <h2 className="font-display text-[20px] font-semibold tracking-tight">
        No tryouts yet
      </h2>
      <p className="text-[13px] text-ink-3 mt-2 max-w-[440px] mx-auto leading-relaxed">
        Start a tryout to run station-based evaluations. Station coaches score on
        their phones, you see the leaderboard live, and verdicts apply straight
        to the roster when you&apos;re done. Verified measurables stick with the
        player on their public profile.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 bg-ink hover:bg-red text-white rounded-sm text-[13px] font-semibold transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Create first tryout
      </button>
    </div>
  );
}

function TryoutRow({
  tryout,
  onDelete,
}: {
  tryout: Tryout;
  onDelete: () => void;
}) {
  const isLive = tryout.status === "live";
  const isComplete = tryout.status === "complete";
  const when = formatDateRange(tryout.startDate, tryout.endDate);

  return (
    <div className="relative flex items-center gap-4 p-5 bg-card border border-hair rounded-lg hover:border-ink transition-colors group">
      <Link href={`/app/tryouts/${tryout.id}`} className="absolute inset-0" aria-label={tryout.name} />
      <div
        className={cn(
          "w-10 h-10 rounded-md flex items-center justify-center shrink-0 z-[1]",
          isLive
            ? "bg-red text-white"
            : isComplete
              ? "bg-paper-deep text-ink-2"
              : "bg-sky-soft text-sky",
        )}
      >
        {isLive ? (
          <Trophy className="w-5 h-5" />
        ) : isComplete ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <Trophy className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0 z-[1] pointer-events-none">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-display text-[18px] font-semibold tracking-tight">
            {tryout.name}
          </div>
          {isLive && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-soft text-red rounded-xs text-[9.5px] font-bold uppercase tracking-[0.06em]">
              <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse-live" />
              Live now
            </span>
          )}
          {isComplete && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-paper-deep text-ink-2 rounded-xs text-[9.5px] font-bold uppercase tracking-[0.06em]">
              Complete
            </span>
          )}
          {tryout.status === "scheduled" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-sky-soft text-sky rounded-xs text-[9.5px] font-bold uppercase tracking-[0.06em]">
              Scheduled
            </span>
          )}
        </div>
        <div className="text-[12.5px] text-ink-3 mt-0.5 font-mono">{when}</div>
      </div>
      <div className="flex items-center gap-1 z-[2]">
        <ChevronRight className="w-5 h-5 text-ink-3" />
        <RowActions
          items={[
            {
              label: "Delete tryout",
              icon: <Trash2 className="w-3.5 h-3.5" />,
              danger: true,
              onSelect: async () => {
                if (!confirm(`Delete "${tryout.name}"? This removes all scores and verdicts.`)) return;
                const r = await deleteTryoutAction(tryout.id);
                if (r.error) toast.error("Couldn't delete", { description: r.error });
                else {
                  toast.success("Tryout deleted");
                  onDelete();
                }
              },
            },
          ]}
        />
      </div>
    </div>
  );
}

function formatDateRange(start: string, end: string | null): string {
  const s = new Date(start + "T00:00:00");
  const startStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (!end || end === start) return startStr;
  const e = new Date(end + "T00:00:00");
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const endStr = sameMonth
    ? e.toLocaleDateString("en-US", { day: "numeric", year: "numeric" })
    : e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${endStr}`;
}
