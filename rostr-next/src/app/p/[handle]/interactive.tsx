"use client";

import { useState } from "react";
import { UserPlus, MessageSquare, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import { comingSoon } from "@/lib/coming-soon";

/**
 * Interactive pieces of /p/[handle] — kept in a "use client" island
 * so the surrounding page stays an async Server Component.
 */
export function PlayerProfileTabs() {
  const tabs = [
    { name: "Overview" },
    { name: "Stats", count: "4yr" },
    { name: "Highlights", count: "18" },
    { name: "Teams", count: "6" },
    { name: "Recruiting" },
    { name: "Academic" },
    { name: "Activity" },
  ];
  const [active, setActive] = useState("Overview");
  return (
    <div className="flex gap-1 border-b border-hair mt-8 overflow-x-auto">
      {tabs.map((t) => {
        const isActive = t.name === active;
        return (
          <button
            key={t.name}
            onClick={() => {
              setActive(t.name);
              if (t.name !== "Overview") {
                comingSoon(`${t.name} tab`, "Tab content wires up as each section's data model lands.");
              }
            }}
            className={cn(
              "px-[18px] py-3.5 text-[13.5px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors",
              isActive
                ? "text-ink border-red"
                : "text-ink-3 border-transparent hover:text-ink",
            )}
          >
            {t.name}
            {t.count && <span className="ml-1.5 font-mono text-[11px] text-ink-4">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PlayerProfileActions({
  handle,
  name,
}: {
  handle: string;
  name: string;
}) {
  const [following, setFollowing] = useState(false);

  const copyLink = async () => {
    const url = `${window.location.origin}/p/${handle}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: url });
    } catch {
      toast.error("Couldn't copy", { description: "Browser blocked clipboard access." });
    }
  };

  return (
    <div className="flex gap-2 pt-16 shrink-0">
      <Button
        variant={following ? "primary" : "secondary"}
        size="lg"
        onClick={() => {
          setFollowing((v) => !v);
          toast.success(following ? `Unfollowed ${name}` : `Following ${name}`);
        }}
      >
        {following ? (
          <>
            <Check className="w-[15px] h-[15px]" /> Following
          </>
        ) : (
          <>
            <UserPlus className="w-[15px] h-[15px]" /> Follow
          </>
        )}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        onClick={() => comingSoon("Message", "Recruiter-routed messaging wires up with NCAA compliance next.")}
      >
        <MessageSquare className="w-[15px] h-[15px]" /> Message
      </Button>
      <Button variant="primary" size="lg" onClick={copyLink}>
        <Share2 className="w-[15px] h-[15px]" /> Share profile
      </Button>
    </div>
  );
}
