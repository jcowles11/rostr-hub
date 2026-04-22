import { PublicNav } from "@/components/organisms/public-nav";

export const metadata = {
  title: "Privacy policy · Rostr",
};

export default function PrivacyPage() {
  return (
    <div className="bg-paper min-h-screen">
      <PublicNav />
      <div className="max-w-[720px] mx-auto px-7 py-16">
        <div className="type-label !text-red mb-2">Legal</div>
        <h1 className="font-display text-[40px] font-semibold tracking-[-0.03em] leading-[1.05]">
          Privacy policy
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-2">Last updated April 2026.</p>

        <div className="prose prose-ink mt-10 space-y-6 text-[14.5px] leading-relaxed text-ink-2">
          <p>
            Rostr is built for high school and club athletic programs. This document
            summarizes how we collect, use, and protect data. A full legal policy lands
            before pilot launch — this summary is intentionally plain-English.
          </p>
          <h2 className="font-display text-[20px] font-semibold text-ink tracking-tight mt-8">
            What we collect
          </h2>
          <p>
            Coach + athlete names, emails, measurables, highlight reels, and game stats.
            Athletes under 18 require parent consent before any data goes public.
          </p>
          <h2 className="font-display text-[20px] font-semibold text-ink tracking-tight">
            What we never sell
          </h2>
          <p>
            We don&apos;t sell athlete data. Recruiter subscriptions are paid access to
            search; athletes choose what their public profile exposes.
          </p>
          <h2 className="font-display text-[20px] font-semibold text-ink tracking-tight">
            What you can delete
          </h2>
          <p>
            Everything. Athletes can delete their account at any time. Coaches retain
            archived records for their own program&apos;s history.
          </p>
          <p className="text-[12.5px] text-ink-3 mt-10">
            Questions? Email{" "}
            <a className="text-red underline" href="mailto:privacy@rostr.app">
              privacy@rostr.app
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
