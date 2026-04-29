import { redirect } from "next/navigation";
import {
  Search,
  BookmarkCheck,
  Heart,
  TrendingUp,
  Settings,
  MessageSquarePlus,
} from "lucide-react";
import { ScoutSidebar } from "@/components/organisms/scout-sidebar";
import { ScoutMobileBar } from "@/components/organisms/scout-mobile-bar";
import { getSessionUser, initialsFrom } from "@/lib/auth";
import {
  getCurrentRecruiter,
  fetchLists,
  type RecruiterContext,
  type RecruiterList,
} from "@/lib/services/recruiter";

/**
 * /scout shell — authenticated recruiter workspace.
 *
 * If the signed-in user has no recruiter record, we render the children
 * WITHOUT the sidebar/mobile bar so the setup page can take over the
 * whole viewport. This avoids the redirect-loop we'd hit if the layout
 * forced a redirect to /scout/setup (server layouts run for /scout/setup
 * too, so a redirect there would loop).
 */

export default async function ScoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, recruiter] = await Promise.all([
    getSessionUser(),
    getCurrentRecruiter(),
  ]);

  if (!user) redirect("/login?next=/scout");

  // No recruiter yet: render raw children. Most pages under /scout
  // redirect themselves to /scout/setup in that case; /scout/setup
  // renders the onboarding form directly without a shell.
  if (!recruiter) {
    return <div className="min-h-screen bg-paper">{children}</div>;
  }

  const lists = await fetchLists(recruiter.id);

  return (
    <div className="flex lg:grid lg:grid-cols-[260px_1fr] h-screen bg-paper">
      <div className="hidden lg:block">
        <ScoutSidebar
          recruiter={recruiter}
          lists={lists}
          user={{
            name: recruiter.fullName,
            role: recruiter.title ?? "Recruiter",
            initials: initialsFrom(recruiter.fullName),
          }}
          primaryNav={[
            { label: "Search", href: "/scout", icon: <Search className="w-4 h-4" /> },
            { label: "Saved searches", href: "/scout/searches", icon: <BookmarkCheck className="w-4 h-4" /> },
            { label: "Lists", href: "/scout/lists", icon: <Heart className="w-4 h-4" /> },
            { label: "Outreach", href: "/scout/outreach", icon: <MessageSquarePlus className="w-4 h-4" /> },
            { label: "Recent views", href: "/scout/history", icon: <TrendingUp className="w-4 h-4" /> },
            { label: "Settings", href: "/scout/settings", icon: <Settings className="w-4 h-4" /> },
          ]}
        />
      </div>

      <main className="flex-1 lg:flex-initial flex flex-col overflow-hidden min-w-0">
        <ScoutMobileBar
          recruiter={recruiter}
          lists={lists}
          user={{
            name: recruiter.fullName,
            role: recruiter.title ?? "Recruiter",
            initials: initialsFrom(recruiter.fullName),
          }}
        />
        {children}
      </main>
    </div>
  );
}
