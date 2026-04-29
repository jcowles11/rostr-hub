import Link from "next/link";
import { PublicNav } from "@/components/organisms/public-nav";

export const metadata = {
  title: "Privacy policy · Rostr",
  description:
    "How Rostr collects, uses, and protects coach + athlete data. Plain-English policy that reflects how the product actually works.",
};

/**
 * Substantive privacy policy. Not lawyer-vetted boilerplate — these
 * statements describe what the app actually does today (auth via
 * Supabase, AI calls to Anthropic, hosting on Vercel, public profiles
 * opt-in, etc.). When a pilot district asks for a privacy summary,
 * this is the document they receive.
 */
export default function PrivacyPage() {
  return (
    <div className="bg-paper min-h-screen">
      <PublicNav />
      <div className="max-w-[760px] mx-auto px-7 py-14">
        <div className="type-label !text-red mb-2">Legal</div>
        <h1 className="font-display text-[40px] font-semibold tracking-[-0.03em] leading-[1.05]">
          Privacy policy
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-2">Last updated {LAST_UPDATED}.</p>

        <div className="mt-10 space-y-8 text-[14.5px] leading-relaxed text-ink-2">

          <Section title="In one paragraph">
            <p>
              Rostr is a coaching tool for high school and club athletic
              programs. We collect the data your coach enters about your team
              and the data you choose to add to your public profile. We
              don&apos;t sell anything to anyone. Public profiles are
              opt-in. Athletes under 18 stay private by default until a
              parent or coach explicitly turns visibility on. You can
              delete your data any time and we&apos;ll honor that in 30 days.
            </p>
          </Section>

          <Section title="What we collect">
            <ul className="list-disc pl-5 space-y-2">
              <li><b>Account data</b> — name, email, role (coach / athlete / recruiter / parent), and the program you belong to.</li>
              <li><b>Roster data</b> — for each player on a coach&apos;s team: name, jersey number, grade, positions, batting/throwing handedness, availability status, and any notes the coach writes.</li>
              <li><b>Performance data</b> — game stats, practice at-bats, pitching outings, exit velocity / pitch velocity / 60-yard times and other tryout measurables, and any imported GameChanger / MaxPreps stat lines.</li>
              <li><b>Public profile data</b> — only what an athlete or their coach chooses to publish: avatar, header image, highlight video URL, commitment status / school, GPA / SAT (optional), and intended major.</li>
              <li><b>Messages</b> — content of in-app messages between coaches, athletes, parents, and recruiters. Stored on our servers; we do not read them except to investigate abuse reports or comply with a legal request.</li>
              <li><b>Operational logs</b> — IP address, browser, page visited, errors thrown. Retained 90 days for debugging and abuse prevention.</li>
            </ul>
          </Section>

          <Section title="What we never collect">
            <ul className="list-disc pl-5 space-y-2">
              <li>Social Security numbers, government IDs, or financial account numbers.</li>
              <li>Biometric data, device fingerprints, or location tracking.</li>
              <li>Anything you don&apos;t enter into the app yourself or authorize a coach / parent to enter on your behalf.</li>
            </ul>
          </Section>

          <Section title="How we use your data">
            <p>To run the product. Specifically:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Display your roster, schedule, stats, and messages to authorized people in your program.</li>
              <li>Send authentication emails (signup confirmation, password reset) and product notifications you opted into.</li>
              <li>Generate AI-assisted suggestions (lineup help, practice plans, etc.) when a coach explicitly asks. Those requests go to Anthropic with the minimum context needed; Anthropic is contractually prohibited from training on the data.</li>
              <li>Aggregate, non-identifying analytics so we can see which features get used. Never tied back to individual athletes.</li>
            </ul>
            <p className="mt-3">
              We <b>do not</b> sell your data, share it with advertisers, or use it to train any external machine-learning model.
            </p>
          </Section>

          <Section title="Public profiles + recruiting">
            <p>
              Athlete public profiles at <code className="font-mono text-[12.5px] bg-paper-deep px-1 rounded">rostr.app/p/[handle]</code> are <b>opt-in</b>. An athlete (or their coach + parent for minors) explicitly chooses to make a profile public. Until that switch is flipped, profiles are not searchable and not visible to recruiters.
            </p>
            <p className="mt-3">
              When a recruiter views a public profile, that view is logged and surfaced to the athlete (so they know who&apos;s looking). Recruiters can favorite profiles and send NCAA-compliant outreach messages, which are routed through the head coach for any athlete pre-junior-year.
            </p>
          </Section>

          <Section title="Athletes under 18">
            <p>
              For high-school-age athletes, the head coach controls roster entry and acts as the primary data steward on behalf of the program. Public profile visibility for any athlete under 18 requires explicit affirmative opt-in by both the athlete and a coach; parents may revoke this at any time by emailing <Link href="mailto:privacy@rostr.app" className="text-red font-semibold underline">privacy@rostr.app</Link>.
            </p>
            <p className="mt-3">
              Rostr is not designed for users under 13 (COPPA threshold). If we discover an account belongs to a child under 13, we delete it and any associated data within 14 days.
            </p>
          </Section>

          <Section title="Schools + FERPA">
            <p>
              When a school or district adopts Rostr as a school-related educational service, we operate as a <b>school official</b> under FERPA&apos;s &quot;legitimate educational interest&quot; exception. We use student data only to provide and improve the service, never for advertising or to train external models. We sign data-processing addenda with districts on request — email <Link href="mailto:privacy@rostr.app" className="text-red font-semibold underline">privacy@rostr.app</Link>.
            </p>
          </Section>

          <Section title="Where your data lives (sub-processors)">
            <p>Rostr runs on a small number of vendors who each see the minimum data needed:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><b>Supabase</b> (Postgres + Auth) — stores everything except AI prompts. US-hosted. Encrypted at rest.</li>
              <li><b>Vercel</b> (web hosting) — serves the app. Sees IP, user agent, and request paths. Logs retained 30 days.</li>
              <li><b>Anthropic</b> (AI Coach) — sees only the prompt context you trigger by clicking an AI feature. No training use; data retention per Anthropic&apos;s commercial terms.</li>
              <li><b>Email provider</b> — sends authentication and notification emails. Sees recipient address + message body.</li>
            </ul>
          </Section>

          <Section title="How long we keep things">
            <ul className="list-disc pl-5 space-y-2">
              <li><b>Active account data</b> — as long as you have an account.</li>
              <li><b>Operational logs</b> — 90 days, then purged.</li>
              <li><b>Deleted accounts</b> — fully purged within 30 days (immediate from the app; up to 30 days to clear from backups).</li>
              <li><b>Aggregate analytics</b> — retained indefinitely in non-identifying form.</li>
            </ul>
          </Section>

          <Section title="Your rights">
            <p>You can:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><b>See</b> what we have on you — request a data export via <Link href="mailto:privacy@rostr.app" className="text-red font-semibold underline">privacy@rostr.app</Link>. We respond within 14 days.</li>
              <li><b>Correct</b> anything that&apos;s wrong, directly in the app.</li>
              <li><b>Delete</b> your account from Settings → Account, or by email. Deletion is immediate from the app and complete within 30 days.</li>
              <li><b>Object</b> to any specific use you don&apos;t agree with — email and we&apos;ll either honor it or explain why we can&apos;t.</li>
            </ul>
          </Section>

          <Section title="Cookies + analytics">
            <p>
              We use one cookie for authentication (so you stay signed in). We do not use third-party advertising cookies or cross-site tracking pixels. Performance metrics are measured in aggregate via server logs; we do not load any external analytics scripts on athletes&apos; profiles.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We&apos;ll post material changes at this URL and email every coach + athlete on file. Pilot-phase users who find an updated policy unacceptable can request a full export and account deletion within 30 days of the change.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Email <Link href="mailto:privacy@rostr.app" className="text-red font-semibold underline">privacy@rostr.app</Link> for any privacy question, data request, or to file a complaint. We read every one and respond within two business days.
            </p>
          </Section>

          <p className="text-[12.5px] text-ink-3 mt-10 pt-6 border-t border-hair">
            Pilot-phase note: Rostr is in early access. The statements above are accurate as of {LAST_UPDATED} and reflect how the product actually works. We&apos;re a small team — if you spot something here that doesn&apos;t match what the app does, tell us and we&apos;ll fix it.
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
