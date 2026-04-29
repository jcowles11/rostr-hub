import Link from "next/link";
import { PublicNav } from "@/components/organisms/public-nav";

export const metadata = {
  title: "Terms of service · Rostr",
  description:
    "Rostr terms of service for pilot-phase coaches, athletes, parents, and college recruiters.",
};

/**
 * Operative terms during the pilot. These are the actual terms users
 * agree to when they sign up. They do not replace a lawyer-vetted MSA
 * for a school district contract — but they're substantively honest
 * about what we promise, what we don't, and how the relationship ends.
 */
export default function TermsPage() {
  return (
    <div className="bg-paper min-h-screen">
      <PublicNav />
      <div className="max-w-[760px] mx-auto px-7 py-14">
        <div className="type-label !text-red mb-2">Legal</div>
        <h1 className="font-display text-[40px] font-semibold tracking-[-0.03em] leading-[1.05]">
          Terms of service
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-2">Last updated {LAST_UPDATED}.</p>

        <div className="mt-10 space-y-8 text-[14.5px] leading-relaxed text-ink-2">

          <Section title="Who can use Rostr">
            <p>
              Coaches at real high school or club athletic programs. Athletes on those programs&apos; rosters. Parents linked to a rostered athlete. College recruiters with an authorized seat. Rostr is not designed for users under 13.
            </p>
            <p className="mt-3">
              You agree to provide accurate information when you sign up and to keep your account credentials secure. One person per account. Don&apos;t share login credentials.
            </p>
          </Section>

          <Section title="Pilot-phase pricing">
            <p>
              During the pilot, Rostr is free for coaches and the athletes / parents on their roster. Recruiter access is by separate paid arrangement. We&apos;ll give you at least 60 days&apos; written notice before any billing change, and pilot programs keep their pilot pricing through the end of the season the change is announced in.
            </p>
          </Section>

          <Section title="What you can do">
            <p>Use Rostr to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Manage your team&apos;s roster, schedule, practice plans, and game stats.</li>
              <li>Score practice at-bats and games.</li>
              <li>Run tryouts and intrasquad scrimmages.</li>
              <li>Publish opt-in athlete profiles to college recruiters.</li>
              <li>Send messages within your program and (where applicable) to recruiters.</li>
              <li>Export your own data at any time.</li>
            </ul>
          </Section>

          <Section title="What you cannot do">
            <ul className="list-disc pl-5 space-y-2">
              <li>Upload data about anyone you don&apos;t have authority to roster (e.g. random kids who aren&apos;t on your team).</li>
              <li>Scrape the public profiles or directory in bulk for any purpose other than legitimate, individual recruiting outreach.</li>
              <li>Reverse-engineer, resell, or rebrand the service.</li>
              <li>Use Rostr to harass, threaten, or doxx anyone — including but not limited to athletes, coaches, parents, and recruiters on the platform.</li>
              <li>Submit data you know to be false (fake stats, fake measurables, fake commitments).</li>
            </ul>
            <p className="mt-3">
              We can suspend or terminate accounts that violate these rules, with notice when reasonable.
            </p>
          </Section>

          <Section title="Who owns what">
            <p>
              <b>You own your data.</b> Coaches own the team data they enter. Athletes own their public profile content (highlights, photos, bio). Recruiters own their notes and lists. Anyone can export their own data at any time.
            </p>
            <p className="mt-3">
              <b>We own the product.</b> The Rostr software, design, brand, and aggregated non-identifying analytics about how people use the product are ours.
            </p>
            <p className="mt-3">
              By posting content to a public profile or program-shared space, you grant Rostr a non-exclusive, royalty-free license to display that content within Rostr to authorized viewers. We do not use it for advertising or to train external models.
            </p>
          </Section>

          <Section title="NCAA compliance">
            <p>
              Pre-junior-year messages between recruiters and athletes are routed through the head coach by product design. We don&apos;t replace your school&apos;s compliance officer; coaches and recruiters remain individually responsible for following NCAA, NJCAA, NAIA, and state-association rules.
            </p>
          </Section>

          <Section title="Service availability">
            <p>
              We aim for 99.9% uptime but we&apos;re a small startup and can&apos;t promise that. We&apos;ll post incidents at a status page (linked from the help center) and notify pilot programs of planned maintenance windows. There is <b>no SLA</b> during pilot phase. If the service goes down during a game, the live scoring data you&apos;ve already entered is durable in our database and will be there when we&apos;re back up.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              Either side can end the relationship at any time:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>You can delete your account from Settings → Account at any time. Your data is purged within 30 days.</li>
              <li>We can suspend an account for violation of these terms. We&apos;ll attempt to reach you first unless the violation is severe.</li>
              <li>We can shut down the service at any time. If we do, we&apos;ll give all active programs at least 60 days&apos; notice and a way to export their data.</li>
            </ul>
          </Section>

          <Section title="Disclaimer of warranties">
            <p>
              Rostr is provided <b>as-is</b>. We don&apos;t warrant that the service will be uninterrupted, error-free, or that AI-generated suggestions will be correct. Coaches retain full discretion over lineup decisions, roster cuts, and any decision affecting an athlete&apos;s playing time or recruitment.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the fullest extent allowed by law, Rostr&apos;s total liability for any claim arising from your use of the service is limited to the fees you paid us in the 12 months before the claim arose (which during pilot phase is $0). We are not liable for indirect, incidental, consequential, or punitive damages — including lost recruiting opportunities, lost games, or lost season records.
            </p>
          </Section>

          <Section title="Schools + districts">
            <p>
              For school districts adopting Rostr at the institution level, the standard data-processing addendum at <Link href="mailto:legal@rostr.app" className="text-red font-semibold underline">legal@rostr.app</Link> supersedes the conflicting provisions of these terms for users at that district. Reach out to start that conversation.
            </p>
          </Section>

          <Section title="Governing law + disputes">
            <p>
              These terms are governed by the laws of the state of Texas, USA, without regard to conflict-of-law principles. Disputes will be resolved in the state or federal courts located in Travis County, Texas. We&apos;ll always try email first — most issues resolve in one reply.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We&apos;ll post material changes at this URL and email every coach on file. Continued use after the effective date of a change means you accept it; if you don&apos;t, you can delete your account before the effective date and we&apos;ll honor that exit.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Email <Link href="mailto:legal@rostr.app" className="text-red font-semibold underline">legal@rostr.app</Link> for anything in this document. We aim to respond within two business days.
            </p>
          </Section>

          <p className="text-[12.5px] text-ink-3 mt-10 pt-6 border-t border-hair">
            Pilot-phase note: Rostr is in early access. The statements above are the operative terms today. They aren&apos;t lawyer-vetted boilerplate — they&apos;re an honest description of the relationship. Sub-processor list, data-handling specifics, and the longer-form school-district MSA live in the <Link href="/legal/privacy" className="text-red font-semibold underline">Privacy policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-[20px] font-semibold text-ink tracking-tight mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

const LAST_UPDATED = "April 2026";
