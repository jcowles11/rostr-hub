import { redirect } from "next/navigation";
import { getSessionUser, displayName } from "@/lib/auth";
import { getCurrentCoach } from "@/lib/services/coach";
import { LogoMark } from "@/components/atoms/logo";
import { SetupForm } from "./setup-form";

/**
 * /app/setup — first-run onboarding.
 * Only reachable when the signed-in user has no coach record.
 * If they already have one, send them straight to /app.
 */
export default async function SetupPage() {
  const [user, coach] = await Promise.all([getSessionUser(), getCurrentCoach()]);
  if (!user) redirect("/login");
  if (coach) redirect("/app");

  const defaultName = displayName(user);
  const defaultProgram = (user.user_metadata?.program_name as string | undefined) ?? "";

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-8">
      <div className="w-full max-w-[560px]">
        <div className="flex items-center gap-2.5 justify-center mb-7">
          <LogoMark size="md" variant="dark" />
          <span className="font-display text-[19px] font-bold">rostr</span>
        </div>
        <div className="bg-card border border-hair rounded-lg p-8">
          <div className="type-label !text-red mb-2">Welcome, {defaultName || "Coach"}</div>
          <h1 className="font-display text-[32px] font-semibold tracking-[-0.03em] leading-[1.05]">
            Set up your program.
          </h1>
          <p className="text-[13.5px] text-ink-3 mt-2">
            Three fields. Takes 30 seconds. You can rename and reconfigure anything later
            from Settings.
          </p>
          <SetupForm defaultName={defaultName} defaultProgram={defaultProgram} />
        </div>
        <p className="text-center text-[12.5px] text-ink-4 mt-5">
          Need help? Email{" "}
          <a className="text-red" href="mailto:hello@rostr.app">
            hello@rostr.app
          </a>
        </p>
      </div>
    </div>
  );
}
