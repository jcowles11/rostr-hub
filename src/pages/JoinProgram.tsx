import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { joinProgramByCode, insertPlayer } from "@/services/playerService";
import rostrLogo from "@/assets/rostr-logo.png";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, Loader2 } from "lucide-react";

export default function JoinProgram() {
  const { code } = useParams<{ code: string }>();
  const { user, playerInfo, refreshPlayer } = useAuth();
  const navigate = useNavigate();
  const [programName, setProgramName] = useState<string | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!code) return;
    const fetchProgram = async () => {
      const { data } = await supabase
        .from("programs")
        .select("id, name, school_name")
        .eq("registration_code", code)
        .maybeSingle();
      if (data) {
        setProgramName(`${data.name} — ${data.school_name}`);
        setProgramId(data.id);
      }
      setLoading(false);
    };
    fetchProgram();
  }, [code]);

  const handleJoin = async () => {
    if (!user || !programId) return;
    setJoining(true);

    if (playerInfo) {
      // Already has a player record — update program_id
      const { error } = await joinProgramByCode(playerInfo.id, programId);

      if (error) {
        toast.error("Failed to join program. You may not have permission.");
        setJoining(false);
        return;
      }
    } else {
      // No player record yet — create one
      const meta = user.user_metadata;
      const firstName = meta?.full_name?.split(" ")[0] || "Player";
      const lastName = meta?.full_name?.split(" ").slice(1).join(" ") || "";
      const { error } = await insertPlayer({
        program_id: programId,
        first_name: firstName,
        last_name: lastName,
        user_id: user.id,
      });

      if (error) {
        toast.error("Failed to join program");
        setJoining(false);
        return;
      }
    }

    await refreshPlayer();
    setJoined(true);
    setJoining(false);
    toast.success("Successfully joined the program!");
  };

  if (!user) {
    return (
      <div className="auth-bg">
        <Card className="w-full max-w-md text-center shadow-elevated border-0">
          <CardContent className="py-12">
            <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover" />
            <h2 className="text-xl font-bold mb-2">Sign in to Join</h2>
            <p className="text-muted-foreground text-sm mb-4">You need an account to join a program.</p>
            <Button onClick={() => navigate("/auth")} className="gradient-primary border-0 shadow-glow">
              Sign In / Sign Up
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!programId) {
    return (
      <div className="auth-bg">
        <Card className="w-full max-w-md text-center shadow-elevated border-0">
          <CardContent className="py-12">
            <h2 className="text-xl font-bold mb-2">Invalid Link</h2>
            <p className="text-muted-foreground text-sm">This invite link is not valid or has expired.</p>
            <Button variant="outline" onClick={() => navigate("/player-dashboard")} className="mt-4">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="auth-bg">
        <Card className="w-full max-w-md text-center shadow-elevated border-0 animate-bounce-in">
          <CardContent className="py-12">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
              <CheckCircle className="h-10 w-10 text-accent" />
            </div>
            <h2 className="text-2xl font-extrabold mb-2">You're In!</h2>
            <p className="text-muted-foreground mb-4">You've joined <strong>{programName}</strong>. Your existing profile data has been preserved.</p>
            <Button onClick={() => navigate("/player-dashboard")} className="gradient-primary border-0 shadow-glow">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-6">
          <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-16 w-16 rounded-2xl shadow-glow object-cover" />
          <h1 className="text-2xl font-extrabold tracking-tight">Join Program</h1>
        </div>

        <Card className="shadow-elevated border-0">
          <CardContent className="pt-6 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">You've been invited to join:</p>
            <p className="text-lg font-bold">{programName}</p>
            {playerInfo?.program_id && (
              <p className="text-xs text-amber-500 font-medium">
                ⚠️ This will move you from your current program to this one.
              </p>
            )}
            <Button
              onClick={handleJoin}
              disabled={joining}
              className="w-full tap-target h-12 text-base font-bold rounded-xl gradient-primary border-0 shadow-glow"
            >
              {joining ? "Joining..." : "Join This Program"}
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)} className="w-full text-muted-foreground">
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
