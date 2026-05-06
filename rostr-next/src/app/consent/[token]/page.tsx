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

        {/* Direct-notice block. Includes the seven elements 16 CFR
            312.4(c) requires for COPPA-compliant parental notification:
              1. Operator name + contact info
              2. Categories of information collected
              3. How information is used and disclosed
              4. That parental consent is required
              5. Methods to grant consent
              6. Right to review + delete + revoke
              7. Link to full privacy policy
            Even though Rostr does not knowingly collect under-13 data
            (grade ≥ 9 hard floor), the consent flow uses the same
            direct-notice format for all minors so the same UI is
            defensible across age ranges + state laws. */}
        <section className="mt-6 bg-card border border-hair rounded-2xl p-5 space-y-3">
          <h2 className="font-display text-[14px] font-bold tracking-tight uppercase tracking-[0.06em] text-ink-3">
            About this authorization
          </h2>
          <p className="text-[13px] text-ink-2 leading-relaxed">
            <strong>Who is asking:</strong> Rostr (operated by Rostr, Inc.,
            reachable at{" "}
            <a href="mailto:privacy@rostr.app" className="text-red hover:underline">
              privacy@rostr.app
            </a>
            ) — the team management platform {playerName}&apos;s coach uses
            to run tryouts, plan practices, and track season stats.
          </p>
          <p className="text-[13px] text-ink-2 leading-relaxed">
            <strong>What we collect from {playerName}:</strong> only what
            the coach has entered or what {playerName} chooses to add —
            basic roster information (name, grade, position, jersey
            number), tryout measurables (e.g. 60-yard dash time, exit
            velocity), game statistics generated by live scoring, optional
            academic information (GPA, test scores, intended college
            level), and optional contact / social media handles. We do
            not collect Social Security numbers, full date of birth,
            financial information, or government IDs. We do not collect
            health information or emergency contacts.
          </p>
          <p className="text-[13px] text-ink-2 leading-relaxed">
            <strong>Who else can see it:</strong> the coaching staff in
            {" "}
            {playerName}&apos;s program always. Anyone else only sees what
            you authorize below — by default, public visibility, scout
            search, and recruiter contact are all OFF.
          </p>
          <p className="text-[13px] text-ink-2 leading-relaxed">
            <strong>Your choices below are independent.</strong> Each
            checkbox controls a specific use; grant only what you&apos;re
            comfortable with. You can change or revoke any of them at any
            time by emailing{" "}
            <a href="mailto:privacy@rostr.app" className="text-red hover:underline">
              privacy@rostr.app
            </a>
            , by contacting the coach, or via the link in any Rostr email.
            You can also request a copy of all data we hold on
            {" "}
            {playerName}, or its deletion, at the same address. We respond
            to those requests within 45 days.
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
            <strong className="text-ink-2">How long we keep data:</strong>{" "}
            operational data (jersey number, position, schedule) is kept
            for up to 2 years after {playerName} leaves the program.
            Verified performance records (game statistics, tryout
            measurables) are kept up to 7 years to support college
            recruiting; deletion may be requested at any time and we will
            comply within 45 days.
          </p>
          <p>
            <strong className="text-ink-2">Your rights at a glance:</strong>{" "}
            access (request a copy), correction (fix what&apos;s wrong),
            deletion (remove the record), revocation of any consent above.
            All rights apply at any time. Send requests to{" "}
            <a href="mailto:privacy@rostr.app" className="text-red hover:underline">
              privacy@rostr.app
            </a>{" "}
            or use the data-rights page at{" "}
            <Link href="/legal/data-rights" className="text-red hover:underline">
              rostr.app/legal/data-rights
            </Link>
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
