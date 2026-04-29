import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Inbox, Sparkles } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchInbox } from "@/lib/services/messaging";
import { PublicNav } from "@/components/organisms/public-nav";
import { AthleteInboxView } from "./athlete-inbox-view";

/**
 * /me/messages — athlete inbox.
 * Split into two tabs:
 *   - Messages: DMs + announcements + accepted recruiter threads
 *   - Requests: pending recruiter outreach awaiting accept/decline
 */
export default async function AthleteMessagesPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me/messages");

  const threads = await fetchInbox();

  return (
    <div className="bg-paper min-h-screen">
      <PublicNav />
      <div className="max-w-layout-marketing mx-auto px-4 sm:px-6 lg:px-7 py-6 sm:py-8">
        <Link
          href="/me"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to my profile
        </Link>
        <div className="flex items-center gap-2 mb-5">
          <Inbox className="w-5 h-5 text-ink-3" />
          <h1 className="font-display text-[26px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
            Messages
          </h1>
        </div>
        <AthleteInboxView threads={threads} />
      </div>
    </div>
  );
}

void Sparkles;
