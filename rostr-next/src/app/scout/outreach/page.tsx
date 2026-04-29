import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, ArrowRight, Clock, Check, X as XIcon } from "lucide-react";
import { getCurrentRecruiter } from "@/lib/services/recruiter";
import {
  fetchOutreachHistory,
  fetchRecruiterQuota,
  type OutreachStatus,
} from "@/lib/services/messaging";
import { cn } from "@/lib/utils";

export default async function OutreachPage() {
  const recruiter = await getCurrentRecruiter();
  if (!recruiter) redirect("/scout/setup");

  const [history, quota] = await Promise.all([
    fetchOutreachHistory(recruiter.id),
    fetchRecruiterQuota(recruiter.id),
  ]);

  const pendingCount = history.filter((h) => h.status === "pending").length;
  const acceptedCount = history.filter((h) => h.status === "accepted").length;
  const declinedCount = history.filter((h) => h.status === "declined").length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-layout-app mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h1 className="font-display text-[24px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
          Outreach
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-1 mb-6">
          Messages you&apos;ve sent to players and their response status.
        </p>

        {/* Quota + status strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <QuotaCard
            label="Remaining"
            value={`${quota.remaining} / ${quota.monthlyLimit}`}
            sub={`Plan: ${quota.plan.toUpperCase()}`}
            tone="ink"
          />
          <QuotaCard label="Pending" value={pendingCount} tone="amber" />
          <QuotaCard label="Accepted" value={acceptedCount} tone="grass" />
          <QuotaCard label="Declined" value={declinedCount} tone="ink-3" />
        </div>

        {history.length === 0 ? (
          <div className="p-10 bg-card border border-dashed border-hair rounded-lg text-center">
            <div className="inline-flex w-12 h-12 rounded-full bg-red-soft text-red items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="font-display text-[20px] font-semibold tracking-tight">
              No outreach yet
            </h2>
            <p className="text-[13px] text-ink-3 mt-2 max-w-[440px] mx-auto leading-relaxed">
              Open any player&apos;s profile and click <b>Message</b> in the
              recruiter tools bar. Each outreach is gated by your plan quota.
            </p>
            <Link
              href="/scout"
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 bg-ink hover:bg-red text-white rounded-sm text-[13px] font-semibold"
            >
              Find prospects →
            </Link>
          </div>
        ) : (
          <div className="bg-card border border-hair rounded-lg overflow-hidden">
            {history.map((h, i) => (
              <OutreachRow
                key={h.threadId}
                h={h}
                isLast={i === history.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuotaCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone: "ink" | "amber" | "grass" | "ink-3";
}) {
  const toneClass =
    tone === "amber" ? "text-amber" :
    tone === "grass" ? "text-grass" :
    tone === "ink-3" ? "text-ink-3" :
    "text-ink";
  return (
    <div className="p-4 bg-card border border-hair rounded-md">
      <div className="type-label">{label}</div>
      <div className={cn("font-mono text-[22px] font-semibold mt-1.5 leading-none", toneClass)}>
        {value}
      </div>
      {sub && <div className="text-[10.5px] text-ink-3 mt-1">{sub}</div>}
    </div>
  );
}

function OutreachRow({
  h,
  isLast,
}: {
  h: {
    threadId: string;
    subject: string | null;
    status: OutreachStatus;
    createdAt: string;
    targetPlayer: { firstName: string; lastName: string; profileSlug: string };
  };
  isLast: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 sm:px-5 py-3",
        !isLast && "border-b border-hair-2",
      )}
    >
      <StatusBadge status={h.status} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[13.5px] truncate">
          {h.targetPlayer.firstName} {h.targetPlayer.lastName}
        </div>
        <div className="text-[11.5px] text-ink-3 mt-0.5 truncate">
          {h.subject ?? "Recruiter outreach"} ·{" "}
          {new Date(h.createdAt).toLocaleDateString()}
        </div>
      </div>
      <Link
        href={`/p/${h.targetPlayer.profileSlug}`}
        className="text-[12px] text-ink-3 hover:text-ink"
      >
        Profile
      </Link>
      <Link
        href={`/scout/outreach/${h.threadId}`}
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-red hover:text-red/80"
      >
        Open
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status: OutreachStatus }) {
  const map = {
    pending: { bg: "bg-amber-soft text-amber", icon: <Clock className="w-3 h-3" />, label: "Pending" },
    accepted: { bg: "bg-grass-dim text-grass", icon: <Check className="w-3 h-3" />, label: "Accepted" },
    declined: { bg: "bg-paper-deep text-ink-3", icon: <XIcon className="w-3 h-3" />, label: "Declined" },
  };
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10.5px] font-bold uppercase tracking-[0.06em] shrink-0",
        s.bg,
      )}
    >
      {s.icon}
      {s.label}
    </span>
  );
}
