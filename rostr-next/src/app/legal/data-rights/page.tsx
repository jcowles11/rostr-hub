import Link from "next/link";
import { PublicNav } from "@/components/organisms/public-nav";

/**
 * /legal/data-rights — public-facing description of the data subject
 * rights Rostr supports + the SLAs we commit to. Required surface for
 * CCPA/CPRA compliance and a useful reference for state student-data
 * privacy laws.
 *
 * No auth required; the page describes the process. Actual request
 * processing routes through privacy@rostr.app for now (we'll build
 * an authenticated portal once volume justifies it).
 */

export const metadata = {
  title: "Your data rights · Rostr",
  description:
    "How to request access to, correction of, deletion of, or revocation of consent for the data Rostr holds about you or your athlete.",
};

export default function DataRightsPage() {
  return (
    <div className="bg-paper min-h-[100dvh]">
      <PublicNav />
      <article className="max-w-[760px] mx-auto px-5 py-12 sm:py-16">
        <h1 className="font-display text-[32px] sm:text-[40px] font-bold tracking-tight">
          Your data rights
        </h1>
        <p className="mt-3 text-[15px] text-ink-2 leading-relaxed">
          You — or a parent/legal guardian acting for a minor — have rights
          over the data Rostr holds. This page describes those rights, the
          process for exercising them, and the timelines we commit to.
        </p>
        <p className="mt-2 text-[12.5px] text-ink-3">
          Last updated: 2026-05-06
        </p>

        <hr className="my-8 border-hair" />

        <Section title="The rights we honor">
          <RightRow
            name="Right to access"
            slas="45 days"
            description="Request a copy of all data Rostr holds about you or your athlete. We deliver as a structured JSON file plus a human-readable PDF summary, sent to the email of record after identity verification."
          />
          <RightRow
            name="Right to correction"
            slas="45 days"
            description="Request that we correct inaccurate data. We do not modify coach-verified game stats or coach-recorded tryout measurables (those are the historical record); we will note disputes alongside them. Self-typed fields (bio, prior-season stats, contact info) we correct on request."
          />
          <RightRow
            name="Right to deletion"
            slas="45 days for visibility cut, 90 days for downstream chain"
            description="Request permanent deletion. Public visibility cuts within 45 days. Backups and subprocessor copies (Supabase, Vercel) take up to 90 days to flush per their retention windows. Audit-trail records of consent grants and access logs are retained as legally required."
          />
          <RightRow
            name="Right to portability"
            slas="45 days"
            description="Receive your data in a portable structured format (JSON). Useful when transferring to another platform."
          />
          <RightRow
            name="Right to revoke consent"
            slas="Within minutes (visibility cut)"
            description="Revoke any parental consent you previously granted. The active consent view re-evaluates on the next request; public-facing surfaces stop rendering the affected data near-instantly."
          />
          <RightRow
            name="Right to opt out of automated decision-making"
            slas="On request"
            description="Rostr's Scout Signal score and AI-generated practice plans are forms of automated decision-making. You can opt out of having your data used in those features without affecting your access to the rest of Rostr."
          />
        </Section>

        <Section title="How to make a request">
          <ol className="list-decimal pl-6 mt-3 space-y-2 text-[14px] text-ink-2 leading-relaxed">
            <li>
              Email{" "}
              <a
                href="mailto:privacy@rostr.app"
                className="text-red hover:underline"
              >
                privacy@rostr.app
              </a>{" "}
              with subject line <em>Data rights request — [Athlete name]</em>.
            </li>
            <li>
              Tell us which right you&apos;re exercising (access / correction
              / deletion / portability / revocation / opt-out).
            </li>
            <li>
              Confirm your relationship to the athlete (athlete themselves,
              parent/legal guardian).
            </li>
            <li>
              We&apos;ll verify identity via the email of record (or a
              second factor for sensitive operations like full deletion).
            </li>
            <li>
              We respond and complete the request within the SLAs above.
            </li>
          </ol>
        </Section>

        <Section title="Special cases">
          <h3 className="font-display text-[16px] font-bold mt-3">
            Coach-verified data
          </h3>
          <p className="mt-1 text-[14px] text-ink-2 leading-relaxed">
            Game stats and tryout measurables are the historical record
            generated by coaches during operations. Deletion requests for
            these records are honored, but we cannot modify the underlying
            value (the coach&apos;s recorded measurement). When an athlete
            disputes a measurement, the coach can re-test or the athlete
            can request the record be deleted entirely.
          </p>

          <h3 className="font-display text-[16px] font-bold mt-4">
            Consent records
          </h3>
          <p className="mt-1 text-[14px] text-ink-2 leading-relaxed">
            Records that you previously granted consent are retained for up
            to 7 years after revocation as a legal audit trail. They are
            not deleted on a deletion request because doing so would
            compromise our ability to demonstrate that we operated
            lawfully on your behalf during the consent period.
          </p>

          <h3 className="font-display text-[16px] font-bold mt-4">
            School-affiliated data (FERPA)
          </h3>
          <p className="mt-1 text-[14px] text-ink-2 leading-relaxed">
            When Rostr operates under a school district contract (a Data
            Processing Addendum is in place), the district is the data
            controller and rights requests should be directed to them
            first. We support districts in fulfilling those requests
            within the same SLAs above.
          </p>
        </Section>

        <Section title="What we do not delete">
          <ul className="list-disc pl-6 mt-3 space-y-1 text-[14px] text-ink-2 leading-relaxed">
            <li>
              Aggregate, de-identified statistics used for product
              improvement (these cannot be re-identified to a specific
              athlete).
            </li>
            <li>
              Audit logs of consent grants, revocations, and data access
              requests — retained for the legally-required period.
            </li>
            <li>
              Backups, until they age out of the standard retention
              window (up to 90 days). The data is not actively
              referenced from production after the deletion is processed.
            </li>
          </ul>
        </Section>

        <Section title="Geographic notes">
          <p className="mt-3 text-[14px] text-ink-2 leading-relaxed">
            <strong>California residents:</strong> the rights above
            satisfy CCPA/CPRA Sections 1798.100–1798.135. We do not sell
            personal information.
          </p>
          <p className="mt-2 text-[14px] text-ink-2 leading-relaxed">
            <strong>EU/UK residents:</strong> Rostr is currently US-only.
            If you reside in the EU/UK, please refrain from creating an
            account; if you have one, contact us and we&apos;ll close it
            and delete the data.
          </p>
          <p className="mt-2 text-[14px] text-ink-2 leading-relaxed">
            <strong>Children under 13:</strong> Rostr does not knowingly
            collect data on users under 13. If you believe we have such
            data, contact us at{" "}
            <a
              href="mailto:privacy@rostr.app"
              className="text-red hover:underline"
            >
              privacy@rostr.app
            </a>{" "}
            and we will delete it within 30 days.
          </p>
        </Section>

        <hr className="my-8 border-hair" />

        <p className="text-[12px] text-ink-3 leading-relaxed">
          Questions about how these rights apply to you? See the full{" "}
          <Link href="/legal/privacy" className="text-red hover:underline">
            Privacy Policy
          </Link>{" "}
          or write to us.
        </p>
      </article>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-[20px] sm:text-[22px] font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function RightRow({
  name,
  slas,
  description,
}: {
  name: string;
  slas: string;
  description: string;
}) {
  return (
    <div className="mt-3 bg-card border border-hair rounded-xl p-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-display text-[15px] font-bold tracking-tight">
          {name}
        </h3>
        <span className="text-[10.5px] font-mono uppercase tracking-[0.06em] text-grass bg-grass-dim px-2 py-0.5 rounded-full border border-grass/20">
          SLA: {slas}
        </span>
      </div>
      <p className="mt-1.5 text-[13.5px] text-ink-2 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
