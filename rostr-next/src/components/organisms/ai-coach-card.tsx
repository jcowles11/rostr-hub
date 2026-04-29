"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, X as XIcon, ArrowUp, AlertCircle, Check, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { askAICoachAction, applyAILineupAction } from "@/app/app/ai/actions";
import type { AICoachIntent, AICoachResponse } from "@/lib/services/ai-coach";

/**
 * AICoachCard — live AI Assistant Coach panel on the Hub.
 *
 * States:
 *   - Idle: shows 4 preset prompt buttons + custom "Ask…" input
 *   - Loading: disabled, spinner
 *   - Response: markdown answer with "Ask another" + "Close" buttons
 *   - Not configured: "Set your ANTHROPIC_API_KEY" card with a link to
 *     settings. Replaces the whole card instead of breaking the UI.
 */

const PRESETS: Array<{ key: AICoachIntent; label: string; meta: string }> = [
  { key: "generate_lineup", label: "Build + apply starting lineup", meta: "One-click" },
  { key: "practice_plan", label: "Plan this week's practice", meta: "90 min" },
  { key: "tryout_analysis", label: "Who are my standouts?", meta: "Tryouts" },
  { key: "pep_talk", label: "Write a pre-game talk", meta: "4 sentences" },
];

export function AICoachCard() {
  const router = useRouter();
  const pathname = usePathname();
  // Demo mode: the AI server actions short-circuit with notConfigured
  // before hitting Anthropic (see /lib/demo-guard.ts). The card needs
  // to differentiate between "this prospect is on /demo, AI is off by
  // design" vs "real coach has no API key configured" — same flag,
  // different message. Path check is the cleanest signal.
  const isDemo = pathname?.startsWith("/demo") ?? false;
  const [custom, setCustom] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [lineup, setLineup] = useState<NonNullable<AICoachResponse["lineup"]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isApplying, setIsApplying] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);

  const ask = (intent: AICoachIntent, customPrompt?: string) => {
    setError(null);
    setResponse(null);
    setLineup(null);
    setLastPrompt(customPrompt ?? PRESETS.find((p) => p.key === intent)?.label ?? null);
    startTransition(async () => {
      const res = await askAICoachAction(intent, customPrompt);
      if (res.notConfigured) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) {
        setError(res.error ?? "AI Assistant Coach didn't respond.");
        return;
      }
      setResponse(res.message ?? "");
      if (res.lineup) setLineup(res.lineup);
    });
  };

  const applyLineup = async () => {
    if (!lineup) return;
    setIsApplying(true);
    const r = await applyAILineupAction(
      lineup.gameId,
      lineup.entries.map((e) => ({
        playerId: e.playerId,
        battingOrder: e.battingOrder,
        position: e.position,
      })),
    );
    setIsApplying(false);
    if (r.error) {
      toast.error("Couldn't apply lineup", { description: r.error });
      return;
    }
    toast.success("Lineup applied to the game");
    router.refresh();
    setLineup(null);
    setResponse(null);
    setLastPrompt(null);
  };

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custom.trim()) return;
    ask("custom", custom);
    setCustom("");
  };

  const copyResponse = async () => {
    if (!response) return;
    try {
      await navigator.clipboard.writeText(response);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy blocked by browser");
    }
  };

  if (notConfigured) {
    return (
      <div className="relative overflow-hidden rounded-lg bg-ink text-white p-[18px]">
        <div className="inline-flex items-center gap-1.5 text-[10px] text-red font-bold uppercase tracking-[0.1em]">
          <Sparkles className="w-3 h-3" />
          AI Assistant Coach
        </div>
        {isDemo ? (
          <>
            <h4 className="mt-1.5 font-display text-[16px] font-semibold tracking-tight leading-snug">
              AI Assistant Coach isn&apos;t available in demo mode.
            </h4>
            <p className="text-[11.5px] text-white/70 mt-1 leading-relaxed">
              Sign up free to use it on your real roster.
            </p>
            <Link
              href="/signup"
              className="mt-3 inline-block px-3 py-1.5 bg-red text-white rounded-sm text-[12px] font-semibold hover:bg-red/90"
            >
              Sign up →
            </Link>
          </>
        ) : (
          <>
            <h4 className="mt-1.5 font-display text-[16px] font-semibold tracking-tight leading-snug">
              Almost there.
            </h4>
            <p className="text-[11.5px] text-white/70 mt-1 leading-relaxed">
              Set <code className="font-mono text-[11px] bg-white/10 px-1 rounded">ANTHROPIC_API_KEY</code>
              {" "}in your server env, then reload. Each suggestion costs ~$0.003.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg bg-ink text-white p-[18px]">
      <div
        aria-hidden
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(200,58,58,.25), transparent 70%)",
        }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-[10px] text-red font-bold uppercase tracking-[0.1em]">
            <Sparkles className="w-3 h-3" />
            AI Assistant Coach
            {isPending && <span className="ml-1 text-white/60">· thinking…</span>}
          </div>
          {(response || error) && (
            <button
              onClick={() => {
                setResponse(null);
                setError(null);
                setLastPrompt(null);
              }}
              className="p-1 text-white/60 hover:text-white"
              aria-label="Close response"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Lineup (tool-use response) */}
        {lineup && (
          <div className="mt-3">
            <div className="inline-flex items-center gap-1.5 text-[10px] text-white/60 font-mono mb-1.5">
              <Wand2 className="w-3 h-3" /> AI lineup ready
            </div>
            {response && (
              <div className="text-[11.5px] leading-relaxed text-white/80 mb-2">{response}</div>
            )}
            <div className="bg-white/[0.04] border border-white/10 rounded-md overflow-hidden">
              {lineup.entries
                .slice()
                .sort((a, b) => a.battingOrder - b.battingOrder)
                .map((e) => (
                  <div
                    key={e.battingOrder}
                    className="flex items-center gap-2 px-2.5 py-1.5 border-b border-white/5 last:border-b-0"
                  >
                    <span className="font-mono text-[13px] font-bold text-red w-5">
                      {e.battingOrder}
                    </span>
                    <span className="text-[12px] text-white font-semibold flex-1 truncate">
                      {e.playerName}
                    </span>
                    <span className="font-mono text-[11px] text-white/60 w-10 text-right">
                      {e.position}
                    </span>
                  </div>
                ))}
            </div>
            <div className="mt-3 flex gap-1.5">
              <button
                onClick={applyLineup}
                disabled={isApplying}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 bg-red hover:bg-red/90 disabled:bg-red/60 text-white rounded-sm text-[12px] font-bold"
              >
                <Check className="w-3.5 h-3.5" />
                {isApplying ? "Applying…" : "Apply lineup to game"}
              </button>
              <Link
                href={`/app/games/${lineup.gameId}`}
                className="inline-flex items-center gap-1 px-2.5 py-2 bg-white/[0.08] hover:bg-white/[0.14] text-white rounded-sm text-[11.5px] font-semibold"
              >
                Preview →
              </Link>
              <button
                onClick={() => {
                  setLineup(null);
                  setResponse(null);
                  setLastPrompt(null);
                }}
                className="px-2.5 py-2 bg-white/[0.08] hover:bg-white/[0.14] text-white rounded-sm text-[11.5px] font-semibold"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Text response */}
        {response && !lineup && (
          <div className="mt-3">
            {lastPrompt && (
              <div className="text-[10.5px] font-mono text-white/50 mb-1.5">
                {lastPrompt}
              </div>
            )}
            <div className="max-h-[340px] overflow-y-auto pr-1 text-[12.5px] leading-relaxed text-white/90 whitespace-pre-wrap">
              {response}
            </div>
            <div className="mt-3 flex gap-1.5">
              <button
                onClick={copyResponse}
                className="flex-1 px-2.5 py-1.5 bg-white/[0.08] hover:bg-white/[0.14] text-white rounded-sm text-[11.5px] font-semibold"
              >
                Copy
              </button>
              <button
                onClick={() => {
                  setResponse(null);
                  setError(null);
                  setLastPrompt(null);
                }}
                className="flex-1 px-2.5 py-1.5 bg-red hover:bg-red/90 text-white rounded-sm text-[11.5px] font-semibold"
              >
                Ask another
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !response && (
          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-sm bg-red/30 text-white text-[11.5px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Idle: presets + input */}
        {!response && !error && !lineup && (
          <>
            <h4 className="mt-1.5 font-display text-[16px] font-semibold tracking-tight leading-snug">
              What would you like to tackle first?
            </h4>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => ask(p.key)}
                  disabled={isPending}
                  className={cn(
                    "flex items-center justify-between gap-2 px-2.5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-sm text-left text-[12px] transition-colors",
                    isPending && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <span>{p.label}</span>
                  <span className="font-mono text-[11px] text-red font-semibold shrink-0">
                    {p.meta}
                  </span>
                </button>
              ))}
            </div>

            <form onSubmit={submitCustom} className="mt-3 flex gap-1.5">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Ask the assistant coach anything…"
                disabled={isPending}
                className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-sm px-2.5 py-1.5 text-[12px] outline-none focus:border-red placeholder:text-white/35 text-white"
              />
              <button
                type="submit"
                disabled={isPending || !custom.trim()}
                className="w-9 h-9 inline-flex items-center justify-center bg-red hover:bg-red/90 disabled:bg-red/40 text-white rounded-sm"
                aria-label="Ask"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
