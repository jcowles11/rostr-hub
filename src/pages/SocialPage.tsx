import { useState } from "react";
import SocialHome from "@/pages/SocialHome";
import { useAuth } from "@/contexts/AuthContext";
import rostrLogo from "@/assets/rostr-logo.png";
import { Button } from "@/components/ui/button";
import { User, Search, ChevronRight, Sparkles } from "lucide-react";

function PlayerOnboardingSplash({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background animate-fade-in">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-6">
          <div className="absolute -inset-4 rounded-full bg-primary/10 animate-pulse-soft" />
          <img
            src={rostrLogo}
            alt="Rostr"
            className="relative h-24 w-24 rounded-3xl shadow-glow object-cover"
          />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight mb-2">
          Welcome to Rostr
        </h1>
        <p className="text-muted-foreground text-sm max-w-xs mb-8">
          Your athlete profile, stats, highlights, and recruiting — all in one place.
        </p>

        {/* Feature cards */}
        <div className="w-full max-w-sm space-y-3 mb-10">
          {[
            {
              icon: Sparkles,
              title: "Share Highlights",
              desc: "Post your best plays, workouts, and milestones",
            },
            {
              icon: Search,
              title: "Get Discovered",
              desc: "Scouts and coaches can find and follow your profile",
            },
            {
              icon: User,
              title: "Track Your Stats",
              desc: "View evaluations and build your recruiting resume",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">{f.title}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-10 space-y-3">
        <Button
          onClick={onContinue}
          className="w-full h-14 text-base font-bold rounded-2xl gradient-primary border-0 shadow-glow"
        >
          Create My Account
          <ChevronRight className="h-5 w-5 ml-1" />
        </Button>
        <button
          onClick={onContinue}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Skip — Browse the feed first
        </button>
      </div>
    </div>
  );
}

export default function SocialPage() {
  const { devRoleOverride, userRole } = useAuth();
  const effectiveRole = devRoleOverride || userRole;

  // Show onboarding splash once per session for any player (demo or real)
  const [showSplash, setShowSplash] = useState(() => {
    if (effectiveRole !== "player") return false;
    const seen = sessionStorage.getItem("rostr_player_onboard_seen");
    return !seen;
  });

  const dismissSplash = () => {
    sessionStorage.setItem("rostr_player_onboard_seen", "1");
    setShowSplash(false);
  };

  return (
    <>
      {showSplash && <PlayerOnboardingSplash onContinue={dismissSplash} />}
      <div className="mx-auto max-w-xl px-4 pt-4 pb-8">
        <SocialHome />
      </div>
    </>
  );
}
