"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, Lock, User, ArrowRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * /signup — real Supabase email/password account creation.
 * Role determines post-signup redirect:
 *   coach → /app
 *   player → /me
 *   recruiter → /app
 *
 * Coach/player/recruiter role record (coaches/players/recruiter_seats)
 * is created lazily in a later sprint — for now only the auth.user row
 * is created, and the UI falls back to mock data until real records exist.
 */
type Role = "coach" | "player" | "recruiter";

export default function SignupPage() {
  const [role, setRole] = useState<Role>("coach");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [program, setProgram] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, role, program_name: program || null },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // If email confirmation is required, no session is returned yet.
    if (!data.session) {
      setInfo("Check your email to confirm your account before signing in.");
      setLoading(false);
      return;
    }
    window.location.href = role === "player" ? "/me" : "/app";
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-8">
      <div className="w-full max-w-[460px]">
        <Link href="/" className="flex items-center gap-2.5 justify-center mb-8">
          <span className="relative inline-flex w-[28px] h-[28px] rounded-sm bg-ink text-red items-center justify-center font-display text-[16px] font-bold brand-dashed">
            R
          </span>
          <span className="font-display text-[19px] font-bold">rostr</span>
        </Link>

        <div className="bg-card border border-hair rounded-lg p-8">
          <h1 className="font-display text-[28px] font-semibold tracking-tight">
            Start free.
          </h1>
          <p className="text-[13.5px] text-ink-3 mt-1">
            Pick your role. You can add teams, players, and coaches later.
          </p>

          {error && (
            <div className="mt-5 flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mt-5 flex items-start gap-2 p-3 rounded-sm bg-grass-dim text-grass text-[12.5px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-2">
            {(["coach", "player", "recruiter"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  "p-3 rounded-sm border text-center transition-all",
                  role === r
                    ? "border-red bg-red-soft shadow-[0_0_0_3px_var(--red-soft)]"
                    : "border-hair bg-card hover:border-ink-3",
                )}
              >
                <div className="type-label">
                  {r === "coach" && "Coach"}
                  {r === "player" && "Player"}
                  {r === "recruiter" && "Recruiter"}
                </div>
                <div className="text-[11px] text-ink-3 mt-1 leading-tight">
                  {r === "coach" && "Run a team"}
                  {r === "player" && "Claim profile"}
                  {r === "recruiter" && "College / D1"}
                </div>
              </button>
            ))}
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="type-label mb-1.5 block">Full name</label>
              <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2.5 focus-within:border-red">
                <User className="w-3.5 h-3.5 text-ink-3" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={role === "coach" ? "Coach Martinez" : role === "player" ? "Marcus Johnson" : "Rebecca Lee"}
                  className="flex-1 bg-transparent outline-none text-[13.5px]"
                  autoComplete="name"
                />
              </div>
            </div>
            <div>
              <label className="type-label mb-1.5 block">Email</label>
              <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2.5 focus-within:border-red">
                <Mail className="w-3.5 h-3.5 text-ink-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@school.edu"
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
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="flex-1 bg-transparent outline-none text-[13.5px]"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {role === "coach" && (
              <div>
                <label className="type-label mb-1.5 block">School or program</label>
                <input
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  required
                  placeholder="Lincoln HS · Baseball"
                  className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 h-[44px] bg-red hover:bg-red/90 text-white rounded-sm text-[14px] font-semibold transition-colors mt-2 disabled:opacity-60"
            >
              {loading ? "Creating…" : <>Create account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>

        <div className="mt-5 text-center text-[13px] text-ink-3">
          Already have an account?{" "}
          <Link href="/login" className="text-red font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
