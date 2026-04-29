"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/atoms/logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * /signup — Supabase email/password account creation with:
 *   - Role picker (coach / player / recruiter)
 *   - Confirm-password validation
 *   - Optional phone number (stored in user_metadata.phone)
 *   - Full-screen "check your email" takeover when email confirmation
 *     is enabled on the project — previously a small banner that got
 *     missed
 */
type Role = "coach" | "player" | "recruiter";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [role, setRole] = useState<Role>("coach");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [program, setProgram] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Live password-match hint — only flashes after user starts typing
  // the confirm-password field.
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role,
          program_name: program || null,
          phone: phone.trim() || null,
        },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // If email confirmation is required, no session is returned yet.
    // Swap to the full-screen "check your email" takeover so the
    // visitor doesn't miss it.
    if (!data.session) {
      setConfirmSent(email);
      setLoading(false);
      return;
    }
    // Session live — route by role.
    if (next && next.startsWith("/")) {
      window.location.href = next;
      return;
    }
    if (role === "player") window.location.href = "/me";
    else if (role === "recruiter") window.location.href = "/scout/setup";
    else window.location.href = "/app/setup";
  };

  // ── Full-screen "check your email" takeover ─────────────────────

  if (confirmSent) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-8">
        <div className="w-full max-w-[480px] text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 justify-center mb-8">
            <LogoMark size="md" variant="dark" />
            <span className="font-display text-[19px] font-bold">rostr</span>
          </Link>

          <div className="bg-card border border-hair rounded-lg p-10">
            <div className="inline-flex w-16 h-16 rounded-full bg-grass-dim text-grass items-center justify-center mb-4">
              <Mail className="w-8 h-8" />
            </div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight">
              Check your email
            </h1>
            <p className="text-[14px] text-ink-2 mt-3 leading-relaxed">
              We sent a confirmation link to{" "}
              <span className="font-semibold text-ink">{confirmSent}</span>.
              Click the link in that email to finish creating your account —
              then come back here to sign in.
            </p>
            <div className="mt-6 p-4 rounded-sm bg-paper border border-hair-2 text-left text-[12.5px] text-ink-3 leading-relaxed">
              <div className="font-semibold text-ink mb-1">
                Can&apos;t find the email?
              </div>
              <ul className="space-y-1 list-disc list-inside">
                <li>Check your spam / junk folder</li>
                <li>Email can take up to 2 minutes to arrive</li>
                <li>
                  Or, turn off email confirmation in Supabase:{" "}
                  <span className="font-mono text-[11px] bg-card px-1 py-0.5 rounded-xs">
                    Auth → Providers → Email → Confirm email OFF
                  </span>
                </li>
              </ul>
            </div>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center justify-center gap-2 px-5 h-[42px] bg-ink hover:bg-red text-white rounded-sm text-[13.5px] font-semibold transition-colors"
            >
              Go to sign in <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="mt-4 text-[12px] text-ink-3">
              Used the wrong email?{" "}
              <button
                onClick={() => {
                  setConfirmSent(null);
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="text-red font-semibold hover:underline"
              >
                Sign up again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Regular signup form ─────────────────────────────────────────

  return (
    <div className="min-h-screen bg-paper grid lg:grid-cols-[1fr_480px]">
      {/* Left rail: marketing / brand (hidden on small screens) */}
      <div className="hidden lg:flex bg-ink text-white relative overflow-hidden flex-col justify-between p-12">
        {/* Background pattern */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: [
              "radial-gradient(circle at 20% 30%, rgba(200,58,58,.35), transparent 45%)",
              "radial-gradient(circle at 80% 80%, rgba(58,110,168,.25), transparent 50%)",
              "linear-gradient(135deg, #14181f, #0a0d12)",
            ].join(", "),
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <Link href="/" className="relative flex items-center gap-2.5 w-max">
          <LogoMark size="lg" variant="light" />
          <span className="font-display text-[22px] font-bold">rostr</span>
        </Link>

        <div className="relative">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-red mb-3">
            The team operating system
          </div>
          <h2 className="font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.03em]">
            Your roster. Your stats. Your season — all in one place.
          </h2>
          <p className="text-[14px] text-white/70 mt-5 max-w-[420px] leading-relaxed">
            Import your roster and stats from GameChanger in 30 seconds. Score
            games live. Share player profiles with recruiters. Built for HS
            coaches who are done juggling four apps.
          </p>
        </div>

        <div className="relative space-y-3 text-[13px] text-white/80">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex w-5 h-5 rounded-full bg-red/20 text-red items-center justify-center shrink-0 mt-0.5">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path d="M8 12.5L4.5 9l-1 1L8 14.5 16.5 6l-1-1L8 12.5z" />
              </svg>
            </span>
            <span>
              <b className="text-white">Roster</b> — CSV import from GameChanger, per-level assignments, jerseys, lineup-ready
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="inline-flex w-5 h-5 rounded-full bg-red/20 text-red items-center justify-center shrink-0 mt-0.5">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path d="M8 12.5L4.5 9l-1 1L8 14.5 16.5 6l-1-1L8 12.5z" />
              </svg>
            </span>
            <span>
              <b className="text-white">Stats</b> — season + career batting and pitching, live from every at-bat
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="inline-flex w-5 h-5 rounded-full bg-red/20 text-red items-center justify-center shrink-0 mt-0.5">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path d="M8 12.5L4.5 9l-1 1L8 14.5 16.5 6l-1-1L8 12.5z" />
              </svg>
            </span>
            <span>
              <b className="text-white">Game day</b> — live scoring that feeds fan viewers, profiles, and recruiter searches
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="inline-flex w-5 h-5 rounded-full bg-red/20 text-red items-center justify-center shrink-0 mt-0.5">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path d="M8 12.5L4.5 9l-1 1L8 14.5 16.5 6l-1-1L8 12.5z" />
              </svg>
            </span>
            <span>
              <b className="text-white">Recruiting</b> — verified measurables + real game data, one tap to share
            </span>
          </div>
        </div>
      </div>

      {/* Right: signup form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-[460px]">
          <Link
            href="/"
            className="flex items-center gap-2.5 justify-center mb-8 lg:hidden"
          >
            <LogoMark size="md" variant="dark" />
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
                  placeholder={
                    role === "coach"
                      ? "Coach Martinez"
                      : role === "player"
                        ? "Marcus Johnson"
                        : "Rebecca Lee"
                  }
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
              <label className="type-label mb-1.5 block">
                Phone{" "}
                <span className="text-ink-4 font-normal normal-case tracking-normal ml-1">
                  (optional)
                </span>
              </label>
              <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2.5 focus-within:border-red">
                <Phone className="w-3.5 h-3.5 text-ink-3" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="flex-1 bg-transparent outline-none text-[13.5px]"
                  autoComplete="tel"
                />
              </div>
              <div className="text-[10.5px] text-ink-3 mt-1">
                We&apos;ll use this for account recovery and optional game-day SMS alerts later.
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

            <div>
              <label className="type-label mb-1.5 block">Confirm password</label>
              <div
                className={cn(
                  "flex items-center gap-2 bg-paper border rounded-sm px-3 py-2.5",
                  passwordsMismatch
                    ? "border-red focus-within:border-red"
                    : passwordsMatch
                      ? "border-grass focus-within:border-grass"
                      : "border-hair focus-within:border-red",
                )}
              >
                <Lock className="w-3.5 h-3.5 text-ink-3" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Re-type your password"
                  className="flex-1 bg-transparent outline-none text-[13.5px]"
                  autoComplete="new-password"
                />
                {passwordsMatch && (
                  <CheckCircle2 className="w-4 h-4 text-grass" />
                )}
              </div>
              {passwordsMismatch && (
                <div className="text-[11px] text-red mt-1 font-semibold">
                  Passwords don&apos;t match yet.
                </div>
              )}
            </div>

            {role === "coach" && (
              <div>
                <label className="type-label mb-1.5 block">School or program</label>
                <input
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  required
                  placeholder="Heritage HS · Baseball"
                  className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !passwordsMatch}
              className="w-full inline-flex items-center justify-center gap-2 h-[44px] bg-red hover:bg-red/90 text-white rounded-sm text-[14px] font-semibold transition-colors mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                "Creating…"
              ) : (
                <>
                  Create account <ArrowRight className="w-4 h-4" />
                </>
              )}
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
    </div>
  );
}
