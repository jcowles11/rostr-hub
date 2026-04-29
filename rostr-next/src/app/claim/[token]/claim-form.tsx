"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { claimPlayerAction } from "./actions";

export function ClaimForm({
  token,
  playerName,
}: {
  token: string;
  playerName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await claimPlayerAction(token);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(`Welcome, ${playerName.split(" ")[0]}!`);
      if (res.redirectTo) router.push(res.redirectTo);
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
        onClick={submit}
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-red hover:bg-red/90 disabled:bg-red/60 text-white rounded-sm text-[14px] font-semibold transition-colors"
      >
        {isPending ? "Claiming…" : `Claim profile for ${playerName.split(" ")[0]}`}
      </button>
      <p className="text-[11px] text-ink-3 leading-relaxed text-center">
        By claiming, you confirm this profile belongs to you. If that&apos;s not the
        case, ask your coach to regenerate the link.
      </p>
    </div>
  );
}
