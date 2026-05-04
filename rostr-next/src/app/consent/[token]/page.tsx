import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ConsentForm } from "./consent-form";

/**
 * /consent/[token] — parental consent landing page.
 *
 * Reached by parents via the email link the coach sends ("Authorize
 * Alex Rivera's Rostr profile"). Token is single-use; once redeemed
 * the consent row is locked.
 *
 * Layout:
 *   - Headline: "Authorize Alex Rivera's Rostr profile"
 *   - Plain-English explanation of what Rostr is + what they're consenting to
 *   - Granular checkboxes per scope (4 of them)
 *   - Confirm name + submit
 *   - Footer with revoke link explanation
 *
 * No auth required. The token IS the auth.
 */

export const metadata = {
  title: "Authorize player profile · Rostr",
  robots: { index: false, follow: false },
};

export default async function ConsentPage({
  params,
}: {
  params: { token: string };
}) {
  if (!params.token || params.token.length < 10) notFound();

  const supabase = createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("parental_consent")
    .select(
      "id, player_id, parent_email, parent_name, granted_at, revoked_at, players!inner(first_name, last_name, grade, profile_slug)",
    )
    .eq("consent_token", params.token)
    .maybeSingle();

  if (error || !row) {
    notFound();
  }

  // Single-use: once granted, show a friendly confirmation. Don't
  // expose the underlying record beyond what the parent already knows.
  if (row.granted_at) {
    return <AlreadyProcessed kind="granted" />;
  }
  if (row.revoked_at) {
    return <AlreadyProcessed kind="revoked" />;
  }

  // Defensive normalize — Supabase returns the joined row as either
  // an object or an array depending on FK direction.
  const playerField = (row as unknown as { players?: unknown }).players;
  const player =
    (Array.isArray(playerField)
      ? (playerField[0] as
          | {
              first_name: string;
              last_name: string;
              grade: number | null;
              profile_slug: string | null;
            }
          | undefined)
      : (playerField as
          | {
              first_name: string;
              last_name: string;
              grade: number | null;
              profile_slug: string | null;
            }
          | undefined)) ?? null;

  if (!player) notFound();

  const playerName = `${player.first_name} ${player.last_name}`.trim();

  return (
    <div className="min-h-[100dvh] bg-paper">
      <header className="bg-card border-b border-hair">
        <div className="max-w-[640px] mx-auto px-5 py-4 flex items-center gap-3">
          <Link href="/" className="font-display text-[16px] font-bold tracking-tight">
            Rostr
          </Link>
          <span className="ml-auto text-[10.5px] font-mono uppercase tracking-[0.06em] text-ink-3 px-2 py-1 rounded-full bg-paper-deep border border-hair">
            Parental authorization
          </span>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-5 py-8 pb-24">
        <h1 className="font-display text-[24px] sm:text-[28px] font-semibold tracking-tight">
          Authorize {playerName}&apos;s Rostr profile
        </h1>
        <p className="mt-2 text-[13.5px] text-ink-2 leading-relaxed">
          A coach has set up a Rostr profile for {playerName}. Before any
          information is visible publicly or to college recruiters, we need
          your permission as a parent or legal guardian. You control what&apos;s
          shared.
        </p>

        {/* Plain-English what-is-Rostr block */}
        <section className="mt-6 bg-card border border-hair rounded-2xl p-5 space-y-3">
          <h2 className="font-display text-[14px] font-bold tracking-tight uppercase tracking-[0.06em] text-ink-3">
            What is Rostr?
          </h2>
          <p className="text-[13px] text-ink-2 leading-relaxed">
            Rostr is the team management platform their coach uses to run
            tryouts, plan practices, and track season stats. It also lets
            athletes share a verified profile with college recruiters when
            they choose to.
          </p>
          <p className="text-[13px] text-ink-2 leading-relaxed">
            Each item below is independent. Grant only what you&apos;re
            comfortable with. You can change your mind anytime — there&apos;s
            a revocation link at the bottom of every email we send you.
          </p>
        </section>

        <ConsentForm
          token={params.token}
          playerName={playerName}
          parentEmail={row.parent_email as string}
          parentName={row.parent_name as string}
        />

        <section className="mt-8 text-[12px] text-ink-3 leading-relaxed space-y-2">
          <p>
            <strong className="text-ink-2">What we collect:</strong> only what
            the coach has entered (basic roster info, optional academics,
            optional contact details, optional measurables from tryouts).
            We do not collect a Social Security number, full date of birth,
            or financial information from athletes.
          </p>
          <p>
            <strong className="text-ink-2">Who can see this data:</strong>{" "}
            depends on what you grant below. Without your authorization,
            only the coaching staff in {playerName}&apos;s program can see
            anything.
          </p>
          <p>
            <strong className="text-ink-2">How long we keep it:</strong>{" "}
            operational data (jersey number, position, etc.) is kept for
            up to 2 years after {playerName} leaves the program. Verified
            performance records (game stats, tryout measurables) are kept
            indefinitely so {playerName} can reference them later — unless
            you request deletion.
          </p>
          <p>
            <strong className="text-ink-2">Your rights:</strong> you can
            revoke this authorization at any time. You can request a copy
            of the data we hold on {playerName} or its deletion by emailing{" "}
            <a href="mailto:privacy@rostr.app" className="text-red hover:underline">
              privacy@rostr.app
            </a>
            .
          </p>
          <p>
            See our full{" "}
            <Link href="/legal/privacy" className="text-red hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/legal/terms" className="text-red hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}

function AlreadyProcessed({ kind }: { kind: "granted" | "revoked" }) {
  return (
    <div className="min-h-[100dvh] bg-paper flex items-center justify-center px-5">
      <div className="max-w-[480px] bg-card border border-hair rounded-2xl p-8 text-center">
        <h1 className="font-display text-[20px] font-semibold tracking-tight">
          {kind === "granted"
            ? "Authorization already processed"
            : "Authorization revoked"}
        </h1>
        <p className="mt-3 text-[13px] text-ink-2 leading-relaxed">
          {kind === "granted"
            ? "This consent link has already been used. If you'd like to revoke or change what you authorized, please contact your coach or email privacy@rostr.app."
            : "This consent request was revoked and is no longer active. If this was a mistake, contact your coach to issue a new request."}
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center justify-center rounded-md border border-hair bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink hover:bg-paper-deep transition-colors"
        >
          Back to Rostr
        </Link>
      </div>
    </div>
  );
}
