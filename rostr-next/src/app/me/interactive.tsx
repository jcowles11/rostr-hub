"use client";

import Link from "next/link";
import { toast } from "sonner";
import {
  Upload,
  CheckCircle2,
  Star,
  TrendingUp,
  Share2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/atoms/button";
import { comingSoon } from "@/lib/coming-soon";

/**
 * Client islands for /me. Keeps the parent page a Server Component
 * (required because it uses <PublicNav> which is async).
 */

export function MeHeaderActions({ handle }: { handle: string }) {
  const copy = async () => {
    const url = `${window.location.origin}/p/${handle}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied", { description: url });
    } catch {
      toast.error("Couldn't copy", { description: "Browser blocked clipboard access." });
    }
  };
  return (
    <div className="ml-auto flex gap-2">
      <Link
        href={`/p/${handle}`}
        className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-hair hover:border-ink text-ink rounded-sm text-[13px] font-semibold transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        View public profile
      </Link>
      <Button variant="red" size="md" onClick={copy}>
        <Share2 className="w-[15px] h-[15px]" />
        Share
      </Button>
    </div>
  );
}

// Unused but exported so the original import list stays valid.
export function MeActions() {
  return null;
}

const ICONS = {
  Upload,
  CheckCircle2,
  Star,
  TrendingUp,
} as const;

const ICON_COLOR: Record<string, string> = {
  red: "text-red",
  grass: "text-grass",
  gold: "text-gold",
  sky: "text-sky",
};

export function SuggestionAction({
  iconName,
  iconColor,
  title,
  meta,
  cta,
}: {
  iconName: keyof typeof ICONS;
  iconColor: "red" | "grass" | "gold" | "sky";
  title: string;
  meta: string;
  cta: string;
}) {
  const Icon = ICONS[iconName];
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-hair-2 last:border-b-0">
      <div className="w-9 h-9 rounded-md bg-paper flex items-center justify-center shrink-0">
        <Icon className={`w-4 h-4 ${ICON_COLOR[iconColor]}`} />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-[13.5px]">{title}</div>
        <div className="text-[11.5px] text-ink-3 mt-0.5">{meta}</div>
      </div>
      <button
        onClick={() => comingSoon(title, "Wires to real account editing in the next sprint.")}
        className="px-3 py-1.5 bg-card border border-hair rounded-sm text-[12px] font-semibold hover:border-ink"
      >
        {cta}
      </button>
    </div>
  );
}

export function QuickAction({
  label,
  feature,
  detail,
}: {
  label: string;
  feature: string;
  detail: string;
}) {
  return (
    <button
      onClick={() => comingSoon(feature, detail)}
      className="text-left px-3 py-2.5 bg-paper hover:bg-paper-deep rounded-sm text-[13px] font-semibold"
    >
      {label}
    </button>
  );
}
