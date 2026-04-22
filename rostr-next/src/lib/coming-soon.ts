"use client";

import { toast } from "sonner";

/**
 * comingSoon — fire a "feature coming in next sprint" toast.
 * Use for click handlers whose backend isn't wired yet.
 */
export function comingSoon(featureName: string, detail?: string) {
  toast(featureName, {
    description: detail ?? "Wired to a real backend in the next sprint.",
    duration: 2800,
  });
}
