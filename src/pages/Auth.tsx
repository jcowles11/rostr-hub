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

type AuthMode = "login" | "signup-coach" | "signup-player" | "signup-evaluator" | "signup-scout";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [regCode, setRegCode] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const redirectTo = new URLSearchParams(window.location.search).get("redirect");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        navigate(redirectTo || "/");
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
      // If reg code provided, verify it
      let programId: string | null = null;
      if (regCode.trim()) {
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
        programId = program.id;
      }

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
        localStorage.setItem(`rostr_player_reg_${authData.user.id}`, JSON.stringify({
          program_id: programId,
          full_name: fullName,
        }));
        toast.success("Check your email to confirm your account!");
      }
    } else if (mode === "signup-evaluator") {
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, account_type: "evaluator" },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        toast.error(error.message);
      } else if (authData.user) {
        localStorage.setItem(`rostr_evaluator_setup_${authData.user.id}`, JSON.stringify({
          full_name: fullName,
          organization_name: orgName,
        }));
        toast.success("Check your email to confirm your account!");
      }
    } else if (mode === "signup-scout") {
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, account_type: "scout" },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        toast.error(error.message);
      } else if (authData.user) {
        localStorage.setItem(`rostr_scout_setup_${authData.user.id}`, JSON.stringify({
          full_name: fullName,
          organization_name: orgName,
        }));
        toast.success("Check your email to confirm your account!");
      }
    }
    setLoading(false);
  };

  const isSignup = mode !== "login";

  const getSubtitle = () => {
    switch (mode) {
      case "login": return "Welcome back";
      case "signup-coach": return "Create your coaching account";
      case "signup-player": return "Create your player account";
      case "signup-evaluator": return "Create your evaluator account";
      case "signup-scout": return "Create your scout account";
    }
  };

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8 animate-slide-up">
          <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-20 w-20 rounded-3xl shadow-glow object-cover" />
          <h1 className="text-3xl font-extrabold tracking-tight">Rostr</h1>
          <p className="mt-1 text-muted-foreground">{getSubtitle()}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Manage tryouts for baseball, football, basketball, soccer & more
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
            <button
              onClick={() => setMode("signup-evaluator")}
              className={cn(
                "flex-1 rounded-xl py-3 text-sm font-bold transition-all",
                mode === "signup-evaluator"
                  ? "gradient-primary text-white shadow-glow"
                  : "bg-card border text-muted-foreground hover:text-foreground"
              )}
            >
              📋 Evaluator
            </button>
            <button
              onClick={() => setMode("signup-scout")}
              className={cn(
                "flex-1 rounded-xl py-3 text-sm font-bold transition-all",
                mode === "signup-scout"
                  ? "gradient-primary text-white shadow-glow"
                  : "bg-card border text-muted-foreground hover:text-foreground"
              )}
            >
              🔍 Scout
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
                    placeholder={mode === "signup-coach" ? "Coach Smith" : mode === "signup-evaluator" ? "Coach Mike" : mode === "signup-scout" ? "Coach Johnson" : "John Smith"}
                    required
                    className="tap-target h-12 text-base rounded-xl"
                  />
                </div>
              )}
              {(mode === "signup-evaluator" || mode === "signup-scout") && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="orgName" className="text-sm font-semibold">Organization / Business Name</Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder={mode === "signup-scout" ? "University of Texas Baseball" : "Elite Pitching Academy"}
                    required
                    className="tap-target h-12 text-base rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    {mode === "signup-scout" ? "Your organization name will be visible on your profile" : "Your org name will appear on verified evaluations"}
                  </p>
                </div>
              )}
              {mode === "signup-player" && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="regCode" className="text-sm font-semibold">Registration Code (optional)</Label>
                  <Input
                    id="regCode"
                    value={regCode}
                    onChange={(e) => setRegCode(e.target.value)}
                    placeholder="Enter code from your coach (if you have one)"
                    className="tap-target h-12 text-base rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">Have a code from your coach? Enter it here. Otherwise, you can create a standalone profile.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === "signup-coach" ? "coach@school.edu" : mode === "signup-evaluator" ? "mike@academy.com" : mode === "signup-scout" ? "scout@university.edu" : "player@email.com"}
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
