import { useState } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup-coach" | "signup-player";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [regCode, setRegCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        navigate("/");
      }
    } else if (mode === "signup-coach") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, account_type: "coach" },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) toast.error(error.message);
      else toast.success("Check your email to confirm your account!");
    } else if (mode === "signup-player") {
      // Verify registration code first
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

      // Create account
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, account_type: "player" },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        toast.error(error.message);
      } else if (authData.user) {
        // Check if there's an existing unlinked player with this name in the program
        // If not, we'll link after they confirm email and log in
        // Store the reg code so we can link on first login
        localStorage.setItem(`rostr_player_reg_${authData.user.id}`, JSON.stringify({
          program_id: program.id,
          full_name: fullName,
        }));
        toast.success("Check your email to confirm your account!");
      }
    }
    setLoading(false);
  };

  const isSignup = mode !== "login";

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8 animate-slide-up">
          <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-20 w-20 rounded-3xl shadow-glow object-cover" />
          <h1 className="text-3xl font-extrabold tracking-tight">Rostr</h1>
          <p className="mt-1 text-muted-foreground">
            {mode === "login" ? "Welcome back" : mode === "signup-coach" ? "Create your coaching account" : "Create your player account"}
          </p>
        </div>

        {/* Role selector for signup */}
        {isSignup && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode("signup-coach")}
              className={cn(
                "flex-1 rounded-xl py-3 text-sm font-bold transition-all",
                mode === "signup-coach"
                  ? "gradient-primary text-white shadow-glow"
                  : "bg-card border text-muted-foreground hover:text-foreground"
              )}
            >
              🏟️ Coach
            </button>
            <button
              onClick={() => setMode("signup-player")}
              className={cn(
                "flex-1 rounded-xl py-3 text-sm font-bold transition-all",
                mode === "signup-player"
                  ? "gradient-primary text-white shadow-glow"
                  : "bg-card border text-muted-foreground hover:text-foreground"
              )}
            >
              ⚾ Player
            </button>
          </div>
        )}

        <Card className="shadow-elevated border-0">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="fullName" className="text-sm font-semibold">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={mode === "signup-coach" ? "Coach Smith" : "John Smith"}
                    required
                    className="tap-target h-12 text-base rounded-xl"
                  />
                </div>
              )}
              {mode === "signup-player" && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="regCode" className="text-sm font-semibold">Registration Code</Label>
                  <Input
                    id="regCode"
                    value={regCode}
                    onChange={(e) => setRegCode(e.target.value)}
                    placeholder="Enter code from your coach"
                    required
                    className="tap-target h-12 text-base rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">Your coach will provide this code</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === "signup-coach" ? "coach@school.edu" : "player@email.com"}
                  required
                  className="tap-target h-12 text-base rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="tap-target h-12 text-base rounded-xl"
                />
              </div>
              <Button type="submit" className="w-full tap-target h-12 text-base font-bold rounded-xl gradient-primary border-0 shadow-glow hover:shadow-lg transition-all duration-200" disabled={loading}>
                {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
              </Button>
            </form>
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup-coach" : "login")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                <span className="text-primary font-semibold">{mode === "login" ? "Sign up" : "Sign in"}</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
