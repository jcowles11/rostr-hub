"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck, Eye, Trophy, Search, Mail, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsentScope } from "@/lib/compliance/data-classification";
import { submitConsentAction } from "./actions";

/**
 * ConsentForm — interactive granular-consent UI for a parent.
 *
 * Each scope is independent. None default-on. Parent must affirmatively
 * check what they're authorizing AND retype their name (mild
 * verification gate — proves they read the form).
 */

interface ScopeOption {
  scope: ConsentScope;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const SCOPE_OPTIONS: ScopeOption[] = [
  {
    scope: "public_profile",
    title: "Allow a public profile page",
    description:
      "Lets your athlete have a Rostr profile at /p/<their-handle> that anyone with the link can view. Without this, the profile is invisible to non-coaches.",
    icon: <Eye className="w-4 h-4" />,
  },
  {
    scope: "verified_metrics_external",
    title: "Allow verified performance data to display publicly",
    description:
      "Game stats, tryout measurables, and coach-verified highlights become visible on the public profile. Builds the verified record recruiters trust.",
    icon: <Trophy className="w-4 h-4" />,
  },
  {
    scope: "scout_discovery",
    title: "Include in scout / recruiter search",
    description:
      "Allows college recruiters who use Rostr to find your athlete via search filters. They can see what's on the public profile only.",
    icon: <Search className="w-4 h-4" />,
  },
  {
    scope: "recruiter_outreach",
    title: "Allow recruiters to send a message",
    description:
      "Recruiters can send your athlete a direct message through Rostr. Messages route through your athlete's inbox; they choose whether to reply.",
    icon: <Mail className="w-4 h-4" />,
  },
];

export function ConsentForm({
  token,
  playerName,
  parentEmail,
  parentName,
}: {
  token: string;
  playerName: string;
  parentEmail: string;
  parentName: string;
}) {
  const [scopes, setScopes] = useState<Set<ConsentScope>>(new Set());
  const [confirmedName, setConfirmedName] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle(s: ConsentScope) {
    setScopes((cur) => {
      const next = new Set(cur);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function submit(grant: boolean) {
    if (!grant) {
      // Decline path — submit empty scopes; consent record gets granted_at
      // but with empty scope array. UI on /p/<handle> still gates correctly
      // (no public_profile scope = no public render).
      // Useful for the audit trail: shows the parent did engage with the
      // form rather than ignoring it.
    }
    if (!confirmedName.trim()) {
      toast.error("Please type your name to confirm.");
      return;
    }
    if (
      confirmedName.trim().toLowerCase() !== parentName.trim().toLowerCase()
    ) {
      toast.error(
        "Name doesn't match the request. Use the exact name your coach entered.",
      );
      return;
    }
    startTransition(async () => {
      const res = await submitConsentAction({
        token,
        parentNameConfirmed: confirmedName.trim(),
        scopes: grant ? Array.from(scopes) : [],
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      // Server action redirects to /consent/[token] which then renders
      // AlreadyProcessed because granted_at is now set.
      window.location.href = `/consent/${token}`;
    });
  }

  return (
    <section className="mt-6 bg-card border border-hair rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-[14px] font-bold tracking-tight uppercase tracking-[0.06em] text-ink-3">
        Your authorizations
      </h2>
      <p className="mt-2 text-[12.5px] text-ink-3 leading-relaxed">
        Check each item you authorize for {playerName}. None are required —
        leaving them all unchecked declines public visibility entirely.
      </p>

      <ul className="mt-4 space-y-2">
        {SCOPE_OPTIONS.map((opt) => {
          const active = scopes.has(opt.scope);
          return (
            <li key={opt.scope}>
              <button
                type="button"
                onClick={() => toggle(opt.scope)}
                disabled={pending}
                aria-pressed={active}
                className={cn(
                  "w-full text-left flex items-start gap-3 p-3 sm:p-4 rounded-xl border bg-paper",
                  "transition-all duration-[140ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  "active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100",
                  active
                    ? "border-grass/40 bg-grass-dim/30"
                    : "border-hair hover:border-ink-3",
                )}
              >
                <span
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    active ? "bg-grass text-white" : "bg-hair-2 text-ink-3",
                  )}
                >
                  {active ? (
                    <ShieldCheck className="w-4 h-4" strokeWidth={2.5} />
                  ) : (
                    opt.icon
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[14px] font-bold tracking-tight">
                    {opt.title}
                  </div>
                  <p className="text-[12px] text-ink-3 mt-0.5 leading-snug">
                    {opt.description}
                  </p>
                </div>
                <span
                  aria-hidden
                  className={cn(
                    "w-5 h-5 rounded-md border shrink-0 mt-1 flex items-center justify-center",
                    active
                      ? "bg-grass border-grass"
                      : "bg-paper border-hair",
                  )}
                >
                  {active && (
                    <ShieldCheck className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-1.5">
          Type your name to confirm
        </label>
        <input
          type="text"
          value={confirmedName}
          onChange={(e) => setConfirmedName(e.target.value)}
          placeholder={parentName}
          disabled={pending}
          className={cn(
            "w-full rounded-xl border border-hair bg-paper px-3 py-2.5 text-[14px]",
            "focus:outline-none focus:border-red focus:ring-2 focus:ring-red-soft",
          )}
        />
        <p className="mt-1 text-[10.5px] text-ink-3 leading-snug">
          Authorizing as <span className="font-semibold">{parentName}</span>{" "}
          ({parentEmail}). We&apos;ll record the date, time, and your IP
          address with this consent for our records.
        </p>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={pending || scopes.size === 0}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-grass text-white px-4 py-3 text-[14px] font-bold",
            "shadow-[0_2px_10px_-2px_rgba(47,125,79,0.4)]",
            "transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
          )}
        >
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" strokeWidth={2.5} /> Authorize selected items
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={pending}
          className={cn(
            "inline-flex items-center justify-center rounded-xl border border-hair bg-paper text-ink-2 px-4 py-3 text-[14px] font-medium",
            "hover:text-ink hover:bg-paper-deep transition-colors disabled:opacity-50",
          )}
        >
          Decline all
        </button>
      </div>
    </section>
  );
}
