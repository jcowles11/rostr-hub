"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * /signup — Coach / Player / Recruiter onboarding stub.
 */
type Role = "coach" | "player" | "recruiter";

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("coach");

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
            Pick your role. You can change it later if needed.
          </p>

          {/* Role picker */}
          <div className="mt-6 grid grid-cols-3 gap-2">
            {(["coach", "player", "recruiter"] as Role[]).map((r) => (
              <button
                key={r}
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

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(role === "coach" ? "/app" : role === "player" ? "/p/marcusjohnson21" : "/app");
            }}
          >
            <div>
              <label className="type-label mb-1.5 block">Full name</label>
              <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2.5 focus-within:border-red">
                <User className="w-3.5 h-3.5 text-ink-3" />
                <input
                  required
                  placeholder={role === "coach" ? "Coach Martinez" : role === "player" ? "Marcus Johnson" : "Rebecca Lee"}
                  className="flex-1 bg-transparent outline-none text-[13.5px]"
                />
              </div>
            </div>
            <div>
              <label className="type-label mb-1.5 block">Email</label>
              <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2.5 focus-within:border-red">
                <Mail className="w-3.5 h-3.5 text-ink-3" />
                <input
                  type="email"
                  required
                  placeholder="you@school.edu"
                  className="flex-1 bg-transparent outline-none text-[13.5px]"
                />
              </div>
            </div>
            <div>
              <label className="type-label mb-1.5 block">Password</label>
              <div className="flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-2.5 focus-within:border-red">
                <Lock className="w-3.5 h-3.5 text-ink-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="flex-1 bg-transparent outline-none text-[13.5px]"
                />
              </div>
            </div>

            {role === "coach" && (
              <div>
                <label className="type-label mb-1.5 block">School or program</label>
                <input
                  required
                  placeholder="Lincoln HS · Baseball"
                  className="w-full bg-paper border border-hair rounded-sm px-3 py-2.5 text-[13.5px] outline-none focus:border-red"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 h-[44px] bg-red hover:bg-red/90 text-white rounded-sm text-[14px] font-semibold transition-colors mt-2"
            >
              Create account <ArrowRight className="w-4 h-4" />
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
