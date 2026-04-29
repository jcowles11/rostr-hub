import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchClaimPreview } from "./actions";
import { ClaimForm } from "./claim-form";
import { LogoMark } from "@/components/atoms/logo";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * /claim/[token] — public player-claim landing page.
 *
 * Visitor flow:
 *   1. Coach shares link `/claim/<token>`
 *   2. Page shows "Claim profile for <first> <last> · #<jersey>"
 *      (fetched via SECURITY DEFINER RPC — no broad RLS exposure)
 *   3. If not signed in → Sign up / Sign in CTAs with ?claim=<token>
 *      param so the auth flow redirects back here after success
 *   4. If signed in → big Claim button, which calls the RPC to link
 *      the player row to this auth user and redirects to /me
 *   5. If already claimed by someone else → friendly error
 */
export default async function ClaimPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const preview = await fetchClaimPreview(token);

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!preview) {
    return (
      <ClaimShell>
        <div className="w-11 h-11 rounded-full bg-red-soft text-red inline-flex items-center justify-center mb-3">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight">
          Claim link isn&apos;t valid
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-2 leading-relaxed">
          This link either expired or has already been used. Ask your coach to
          send you a fresh one.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-1.5 px-3 py-2 bg-ink text-white rounded-sm text-[12.5px] font-semibold"
        >
          ← Back to rostr.app
        </Link>
      </ClaimShell>
    );
  }

  const displayName = `${preview.firstName} ${preview.lastName}`;
  const jerseyPart = preview.jersey ? ` · #${preview.jersey}` : "";

  if (preview.alreadyClaimed) {
    return (
      <ClaimShell>
        <div className="w-11 h-11 rounded-full bg-grass-dim text-grass inline-flex items-center justify-center mb-3">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight">
          Profile already claimed
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-2 leading-relaxed">
          <span className="font-semibold text-ink">{displayName}</span>
          {jerseyPart} has already been linked to an account. If that wasn&apos;t
          you, ask your coach to regenerate the claim link.
        </p>
        <div className="mt-5 flex gap-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-ink text-white rounded-sm text-[12.5px] font-semibold"
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-paper hover:bg-paper-deep text-ink-2 rounded-sm text-[12.5px] font-semibold"
          >
            Home
          </Link>
        </div>
      </ClaimShell>
    );
  }

  return (
    <ClaimShell>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-red mb-2">
        Player claim
      </div>
      <h1 className="font-display text-[26px] font-semibold tracking-tight leading-tight">
        Claim this profile
      </h1>
      <div className="mt-4 p-4 bg-paper rounded-md border-l-[3px] border-l-red">
        <div className="font-display text-[18px] font-semibold tracking-tight">
          {displayName}
          <span className="font-mono text-ink-3 ml-2 text-[14px]">
            {jerseyPart.slice(2)}
          </span>
        </div>
        <div className="text-[12px] text-ink-3 mt-0.5 font-mono">
          {preview.teamName}
          {preview.grade ? ` · Grade ${preview.grade}` : ""}
        </div>
      </div>
      <p className="text-[13px] text-ink-3 mt-4 leading-relaxed">
        This links the coach-created profile for <b className="text-ink">{displayName}</b>
        {" "}to your account. Once claimed, you&apos;ll see your schedule, stats, and can
        update your availability. College coaches can see your career-verified
        measurables.
      </p>

      {user ? (
        <div className="mt-5">
          <ClaimForm token={token} playerName={displayName} />
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          <Link
            href={`/signup?next=${encodeURIComponent(`/claim/${token}`)}`}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-red hover:bg-red/90 text-white rounded-sm text-[14px] font-semibold"
          >
            Sign up to claim
          </Link>
          <Link
            href={`/login?next=${encodeURIComponent(`/claim/${token}`)}`}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-paper hover:bg-paper-deep text-ink rounded-sm text-[14px] font-semibold"
          >
            Already have an account? Sign in
          </Link>
        </div>
      )}
    </ClaimShell>
  );
}

function ClaimShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-[460px] bg-card border border-hair rounded-lg p-6 sm:p-8">
        <Link href="/" className="flex items-center gap-2 mb-6">
          <LogoMark size="md" variant="dark" />
          <span className="font-display text-[16px] font-bold tracking-tight">
            rostr
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}
