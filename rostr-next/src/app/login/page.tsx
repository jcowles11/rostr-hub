"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { LogoMark } from "@/components/atoms/logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * /login — real Supabase email/password sign-in.
 * On success redirects to ?next=... or /app.
 *
 * Split into an outer page (shell) and inner form so the
 * useSearchParams() hook can live inside a Suspense boundary,
 * which Next.js requires for static-export builds.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-8">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="flex items-center gap-2.5 justify-center mb-8">
          <LogoMark size="md" variant="dark" />
          <span className="font-display text-[19px] font-bold">rostr</span>
        </Link>

        <Suspense
          fallback={
            <div className="bg-card border border-hair rounded-lg p-8 h-[380px] animate-pulse" />
          }
        >
          <LoginForm />
        </Suspense>

        <div className="mt-5 text-center text-[13px] text-ink-3">
          New here?{" "}
          <Link href="/signup" className="text-red font-semibold hover:underline">
            Create an account
          </Link>
        </div>
        <div className="mt-3 text-center text-[12px] text-ink-4">
          Players: claim your profile with the invite link your coach sent.
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const _router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // If Supabase returns "Email not confirmed" we offer a one-click
  // resend rather than making the coach hunt for the original email.
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendState, setResendState] =
    useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailNotConfirmed(false);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message || "Sign in failed.";
      // Supabase returns "Email not confirmed" (or a variant) when the
      // user hasn't clicked the confirmation link yet.
      if (/email.*not.*confirm/i.test(msg) || /confirm.*email/i.test(msg)) {
        setEmailNotConfirmed(true);
        setError(
          "This email hasn't been confirmed yet. Check your inbox for the link — or resend it below.",
        );
      } else if (/invalid.*credentials/i.test(msg) || /invalid.*login/i.test(msg)) {
        setError("Wrong email or password. Try again, or reset your password below.");
      } else {
        setError(msg);
      }
      setLoading(false);
      return;
    }
    // Full navigation so middleware re-reads the cookie
    window.location.href = next;
  };

  const handleResendConfirmation = async () => {
    if (!email) return;
    setResendState("sending");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResendState(error ? "error" : "sent");
  };

  return (
    <div className="bg-card border border-hair rounded-lg p-8">
      <h1 className="font-display text-[28px] font-semibold tracking-tight">
        Welcome back.
      </h1>
      <p className="text-[13.5px] text-ink-3 mt-1">
        Coach, player, or recruiter — one login.
      </p>

      {error && (
        <div className="mt-5 flex flex-col gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          {emailNotConfirmed && (
            <div className="pl-6">
              {resendState === "sent" ? (
                <span className="text-grass font-semibold">
                  ✓ Confirmation email sent to {email}. Check your inbox.
                </span>
              ) : resendState === "sending" ? (
                <span className="text-ink-3">Sending…</span>
              ) : resendState === "error" ? (
                <span className="text-red font-semibold">
                  Couldn&apos;t resend. Try signing up again.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  className="text-red font-semibold hover:underline"
                >
                  Resend confirmation email →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="type-label mb-1.5 block">Email</label>
          <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2.5 focus-within:border-red">
            <Mail className="w-3.5 h-3.5 text-ink-3" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="coach@yourteam.edu"
              className="flex-1 bg-transparent outline-none text-[13.5px]"
              autoComplete="email"
            />
          </div>
        </div>
        <div>
          <label className="type-label mb-1.5 block">Password</label>
          <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2.5 focus-within:border-red">
            <Lock className="w-3.5 h-3.5 text-ink-3" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="flex-1 bg-transparent outline-none text-[13.5px]"
              autoComplete="current-password"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 h-[44px] bg-ink hover:bg-red text-white rounded-sm text-[14px] font-semibold transition-colors disabled:opacity-60"
        >
          {loading ? "Signing in…" : <>Sign in <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>

      <div className="mt-5 text-center text-[12.5px]">
        <Link href="#" className="text-ink-3 hover:text-ink">
          Forgot password?
        </Link>
      </div>
    </div>
  );
}

