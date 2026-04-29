import Link from "next/link";
import { AlertTriangle, CheckCircle2, Trophy } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchInvitePreview } from "@/app/app/settings/invite-actions";
import { LogoMark } from "@/components/atoms/logo";
import { AcceptInviteForm } from "./accept-form";

/**
 * /invite/[token] — public coach-invite landing page.
 *
 * Flow:
 *   1. Head coach shares `/invite/<token>` with an assistant
 *   2. Page shows "You've been invited to Lincoln Baseball as
 *      assistant_coach"
 *   3. If not signed in → Sign up or Sign in with ?next=/invite/<token>
 *   4. If signed in → big Accept button that calls the RPC to create
 *      the coaches row, then redirects to /app
 */
export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const preview = await fetchInvitePreview(token);

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!preview) {
    return (
      <InviteShell>
        <div className="w-11 h-11 rounded-full bg-red-soft text-red inline-flex items-center justify-center mb-3">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight">
          Invite link isn&apos;t valid
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-2 leading-relaxed">
          This link either expired or was revoked. Ask the head coach for a
          fresh one.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-1.5 px-3 py-2 bg-ink text-white rounded-sm text-[12.5px] font-semibold"
        >
          ← Back to rostr.app
        </Link>
      </InviteShell>
    );
  }

  const roleDisplay =
    preview.role === "head_coach" ? "Head Coach" : "Assistant Coach";

  if (preview.alreadyAccepted) {
    return (
      <InviteShell>
        <div className="w-11 h-11 rounded-full bg-grass-dim text-grass inline-flex items-center justify-center mb-3">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight">
          Invite already accepted
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-2 leading-relaxed">
          This invite was already accepted. If you&apos;re trying to join{" "}
          <b className="text-ink">{preview.programName}</b>, sign in normally or
          ask for a fresh invite.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex items-center gap-1.5 px-3 py-2 bg-ink text-white rounded-sm text-[12.5px] font-semibold"
        >
          Sign in
        </Link>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <div className="inline-flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-red">
        <Trophy className="w-3.5 h-3.5" />
        Coach invite
      </div>
      <h1 className="font-display text-[26px] font-semibold tracking-tight leading-tight">
        Join {preview.programName} as {roleDisplay}
      </h1>
      <p className="text-[13px] text-ink-3 mt-3 leading-relaxed">
        {preview.invitedName
          ? `Hi ${preview.invitedName}, `
          : ""}
        you&apos;ve been invited to help coach{" "}
        <b className="text-ink">{preview.programName}</b>. Accepting adds you to
        the program so you can view the roster, mark attendance, score at
        tryouts, and manage game-day lineups.
      </p>

      {user ? (
        <div className="mt-5">
          <AcceptInviteForm
            token={token}
            programName={preview.programName}
            role={roleDisplay}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          <Link
            href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}${preview.invitedEmail ? `&email=${encodeURIComponent(preview.invitedEmail)}` : ""}`}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-red hover:bg-red/90 text-white rounded-sm text-[14px] font-semibold"
          >
            Sign up to accept
          </Link>
          <Link
            href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-paper hover:bg-paper-deep text-ink rounded-sm text-[14px] font-semibold"
          >
            Already have an account? Sign in
          </Link>
        </div>
      )}
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
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
