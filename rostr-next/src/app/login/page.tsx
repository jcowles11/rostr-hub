"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * /login — real Supabase email/password sign-in.
 * On success redirects to ?next=... or /app.
 */
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Full navigation so middleware re-reads the cookie
    window.location.href = next;
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-8">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="flex items-center gap-2.5 justify-center mb-8">
          <span className="relative inline-flex w-[28px] h-[28px] rounded-sm bg-ink text-red items-center justify-center font-display text-[16px] font-bold brand-dashed">
            R
          </span>
          <span className="font-display text-[19px] font-bold">rostr</span>
        </Link>

        <div className="bg-card border border-hair rounded-lg p-8">
          <h1 className="font-display text-[28px] font-semibold tracking-tight">
            Welcome back.
          </h1>
          <p className="text-[13.5px] text-ink-3 mt-1">
            Coach, player, or recruiter — one login.
          </p>

          {error && (
            <div className="mt-5 flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
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
