"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { acceptCoachInviteAction } from "@/app/app/settings/invite-actions";

export function AcceptInviteForm({
  token,
  programName,
  role,
}: {
  token: string;
  programName: string;
  role: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const accept = () => {
    setError(null);
    startTransition(async () => {
      const res = await acceptCoachInviteAction(token);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(`Welcome to ${programName}!`);
      router.push("/app");
    });
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <button
        type="button"
        onClick={accept}
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-red hover:bg-red/90 disabled:bg-red/60 text-white rounded-sm text-[14px] font-semibold transition-colors"
      >
        {isPending ? "Accepting…" : `Accept as ${role}`}
      </button>
      <p className="text-[11px] text-ink-3 leading-relaxed text-center">
        Accepting gives you access to this program&apos;s roster, schedule, and scoring tools.
      </p>
    </div>
  );
}
