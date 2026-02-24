import { useState, useEffect } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Search, Loader2, X } from "lucide-react";

type AuthMode = "login" | "signup-coach" | "signup-player" | "signup-evaluator" | "signup-scout";

interface ProgramResult {
  id: string;
  name: string;
  school_name: string;
  sport: string;
  logo_url: string | null;
}

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [regCode, setRegCode] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const redirectTo = new URLSearchParams(window.location.search).get("redirect");

  // Program search state for player signup
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProgramResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<ProgramResult | null>(null);
  const [joinMethod, setJoinMethod] = useState<"code" | "search">("search");

  // Search programs
  useEffect(() => {
    if (joinMethod !== "search" || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("programs")
        .select("id, name, school_name, sport, logo_url")
        .or(`school_name.ilike.%${searchQuery.trim()}%,name.ilike.%${searchQuery.trim()}%`)
        .limit(10);
      setSearchResults(data || []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery, joinMethod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          console.error("[Auth] Sign in error:", error.message);
          setErrorMsg(error.message === "Invalid login credentials" ? "Incorrect email or password. Please try again." : error.message);
          toast.error(error.message);
          setLoading(false);
          return;
        }
        navigate(redirectTo || "/");
        return;
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
      let programId: string | null = null;
      if (joinMethod === "code" && regCode.trim()) {
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
      } else if (joinMethod === "search" && selectedProgram) {
        programId = selectedProgram.id;
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
          join_method: joinMethod === "search" && selectedProgram ? "request" : "code",
          requested_program_name: selectedProgram?.name || null,
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
    } catch (err: any) {
      console.error("[Auth] Unexpected error:", err);
      const msg = err?.message || "An unexpected error occurred. Please try again.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
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
            {(["signup-coach", "signup-player", "signup-evaluator", "signup-scout"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-xl py-3 text-sm font-bold transition-all",
                  mode === m
                    ? "gradient-primary text-white shadow-glow"
                    : "bg-card border text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "signup-coach" ? "🏟️ Coach" : m === "signup-player" ? "⚾ Player" : m === "signup-evaluator" ? "📋 Evaluator" : "🔍 Scout"}
              </button>
            ))}
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

              {/* Player: program join method */}
              {mode === "signup-player" && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setJoinMethod("search"); setRegCode(""); }}
                      className={cn(
                        "flex-1 rounded-lg py-2 text-xs font-semibold transition-all border",
                        joinMethod === "search"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                      )}
                    >
                      Find my school
                    </button>
                    <button
                      type="button"
                      onClick={() => { setJoinMethod("code"); setSelectedProgram(null); }}
                      className={cn(
                        "flex-1 rounded-lg py-2 text-xs font-semibold transition-all border",
                        joinMethod === "code"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                      )}
                    >
                      I have a code
                    </button>
                  </div>

                  {joinMethod === "code" && (
                    <div className="space-y-2">
                      <Label htmlFor="regCode" className="text-sm font-semibold">Registration Code (optional)</Label>
                      <Input
                        id="regCode"
                        value={regCode}
                        onChange={(e) => setRegCode(e.target.value)}
                        placeholder="Enter code from your coach"
                        className="tap-target h-12 text-base rounded-xl"
                      />
                      <p className="text-xs text-muted-foreground">No code? Switch to "Find my school" or skip to create a standalone profile.</p>
                    </div>
                  )}

                  {joinMethod === "search" && (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Search for your school or team</Label>
                      {selectedProgram ? (
                        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
                          {selectedProgram.logo_url ? (
                            <img src={selectedProgram.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                              {selectedProgram.school_name?.[0] || "?"}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{selectedProgram.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{selectedProgram.school_name}</p>
                          </div>
                          <button type="button" onClick={() => setSelectedProgram(null)} className="p-1 rounded-md hover:bg-muted">
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Type school or team name..."
                              className="tap-target h-12 text-base rounded-xl pl-10"
                            />
                          </div>
                          {searching && (
                            <div className="flex items-center justify-center py-2">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          {searchResults.length > 0 && (
                            <div className="space-y-1 max-h-48 overflow-y-auto rounded-xl border p-1.5">
                              {searchResults.map((program) => (
                                <button
                                  key={program.id}
                                  type="button"
                                  onClick={() => { setSelectedProgram(program); setSearchResults([]); setSearchQuery(""); }}
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                                >
                                  {program.logo_url ? (
                                    <img src={program.logo_url} alt="" className="h-7 w-7 rounded-md object-cover" />
                                  ) : (
                                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                                      {program.school_name?.[0] || "?"}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">{program.name}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{program.school_name} · {program.sport}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
                            <p className="text-xs text-center text-muted-foreground py-1">No programs found</p>
                          )}
                        </>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {selectedProgram
                          ? "A request will be sent to the coach for approval"
                          : "Search and select your program, or skip to create a standalone profile."}
                      </p>
                    </div>
                  )}
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
              {errorMsg && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive font-medium animate-fade-in">
                  {errorMsg}
                </div>
              )}
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
