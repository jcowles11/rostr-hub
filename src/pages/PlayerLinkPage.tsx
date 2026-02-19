import { useState, useEffect } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export default function PlayerLinkPage() {
  const { user, signOut, refreshPlayer } = useAuth();
  const navigate = useNavigate();
  const [regCode, setRegCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if we have stored reg info from signup
  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(`rostr_player_reg_${user.id}`);
    if (stored) {
      const { full_name } = JSON.parse(stored);
      const parts = full_name.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    }
  }, [user]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    // Find the program by reg code
    const { data: program } = await supabase
      .from("programs")
      .select("id")
      .eq("registration_code", regCode.trim())
      .single();

    if (!program) {
      toast.error("Invalid registration code");
      setLoading(false);
      return;
    }

    // Try to find an existing unlinked player with matching name
    const { data: existingPlayer } = await supabase
      .from("players")
      .select("id, user_id")
      .eq("program_id", program.id)
      .ilike("first_name", firstName.trim())
      .ilike("last_name", lastName.trim())
      .is("user_id", null)
      .limit(1)
      .maybeSingle();

    if (existingPlayer) {
      // Link existing player record
      const { error } = await supabase
        .from("players")
        .update({ user_id: user.id })
        .eq("id", existingPlayer.id);

      if (error) {
        toast.error("Failed to link account");
        setLoading(false);
        return;
      }
    } else {
      // Create new player record linked to this user
      const { error } = await supabase.from("players").insert({
        program_id: program.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        user_id: user.id,
      });

      if (error) {
        toast.error("Failed to create player profile");
        setLoading(false);
        return;
      }
    }

    // Clean up stored reg info
    localStorage.removeItem(`rostr_player_reg_${user.id}`);

    await refreshPlayer();
    toast.success("Account linked!");
    navigate("/player-dashboard");
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8 animate-slide-up">
          <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-20 w-20 rounded-3xl shadow-glow object-cover" />
          <h1 className="text-3xl font-extrabold tracking-tight">Link Your Account</h1>
          <p className="mt-1 text-muted-foreground">Enter your info to connect to your team</p>
        </div>

        <Card className="shadow-elevated border-0">
          <CardContent className="pt-6">
            <form onSubmit={handleLink} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Registration Code</Label>
                <Input
                  value={regCode}
                  onChange={(e) => setRegCode(e.target.value)}
                  placeholder="Enter code from your coach"
                  required
                  className="tap-target h-12 text-base rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">First Name</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="tap-target h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Last Name</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="tap-target h-12 rounded-xl"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Use the same name you registered with so we can match your tryout data.
              </p>
              <Button type="submit" className="w-full tap-target h-12 text-base font-bold rounded-xl gradient-primary border-0 shadow-glow" disabled={loading}>
                {loading ? "Linking..." : "Link Account"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
