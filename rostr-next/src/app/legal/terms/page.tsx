import { PublicNav } from "@/components/organisms/public-nav";

export const metadata = {
  title: "Terms of service · Rostr",
};

export default function TermsPage() {
  return (
    <div className="bg-paper min-h-screen">
      <PublicNav />
      <div className="max-w-[720px] mx-auto px-7 py-16">
        <div className="type-label !text-red mb-2">Legal</div>
        <h1 className="font-display text-[40px] font-semibold tracking-[-0.03em] leading-[1.05]">
          Terms of service
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-2">Last updated April 2026.</p>

        <div className="prose prose-ink mt-10 space-y-6 text-[14.5px] leading-relaxed text-ink-2">
          <p>
            Rostr provides a platform for coaches, athletes, and college recruiters. By
            using Rostr you agree to the following plain-English terms. A full legal
            terms-of-service document lands before pilot launch.
          </p>
          <h2 className="font-display text-[20px] font-semibold text-ink tracking-tight mt-8">
            Who can use Rostr
          </h2>
          <p>
            Coaches at real programs. Athletes on those programs&apos; rosters. College
            recruiters with a paid seat. Parents with a linked athlete. No anonymous
            access to non-public data.
          </p>
          <h2 className="font-display text-[20px] font-semibold text-ink tracking-tight">
            What we own vs. what you own
          </h2>
          <p>
            You own your data. We own the product. You grant us license to display your
            public profile on Rostr and to include aggregated, non-identifying analytics
            in our product.
          </p>
          <h2 className="font-display text-[20px] font-semibold text-ink tracking-tight">
            NCAA compliance
          </h2>
          <p>
            Pre-junior-year messaging between recruiters and athletes is always routed
            through the head coach. Rostr enforces this at the product level.
          </p>
          <p className="text-[12.5px] text-ink-3 mt-10">
            Questions? Email{" "}
            <a className="text-red underline" href="mailto:legal@rostr.app">
              legal@rostr.app
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
