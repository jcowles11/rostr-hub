import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentRecruiter } from "@/lib/services/recruiter";
import { RecruiterSetupForm } from "./setup-form";
import { LogoMark } from "@/components/atoms/logo";
import Link from "next/link";

/**
 * /scout/setup — recruiter onboarding.
 * First-run: collects org info, creates the recruiter record, drops
 * the user into /scout.
 * Already a recruiter: redirect to /scout.
 */
export default async function ScoutSetupPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/scout/setup");

  const existing = await getCurrentRecruiter();
  if (existing) redirect("/scout");

  const defaultName =
    (user.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-[520px]">
        <Link href="/" className="flex items-center gap-2.5 justify-center mb-8">
          <LogoMark size="md" variant="dark" />
          <span className="font-display text-[19px] font-bold">rostr</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-red bg-red/10 rounded-xs px-1.5 py-0.5">
            Scout
          </span>
        </Link>

        <div className="bg-card border border-hair rounded-lg p-8">
          <div className="type-label !text-red mb-2">Welcome, recruiter</div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight leading-tight">
            Set up your recruiting profile.
          </h1>
          <p className="mt-2 text-[13.5px] text-ink-3 leading-relaxed">
            This is the org you&apos;re recruiting for. Coaches see it when you view
            their players, and athletes see it on their &quot;who viewed my
            profile&quot; card. Takes about 30 seconds.
          </p>

          <RecruiterSetupForm defaultFullName={defaultName} />
        </div>

        <div className="mt-5 text-center text-[13px] text-ink-3">
          Not a recruiter?{" "}
          <Link href="/app/setup" className="text-red font-semibold hover:underline">
            Coach setup →
          </Link>
        </div>
      </div>
    </div>
  );
}
