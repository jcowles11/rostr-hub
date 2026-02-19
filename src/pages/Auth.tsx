import { useState } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        navigate("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Check your email to confirm your account!");
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md animate-scale-in">
        {/* Logo & branding */}
        <div className="text-center mb-8 animate-slide-up">
          <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-20 w-20 rounded-3xl shadow-glow object-cover" />
          <h1 className="text-3xl font-extrabold tracking-tight">Rostr</h1>
          <p className="mt-1 text-muted-foreground">
            {isLogin ? "Welcome back, coach" : "Start managing your tryouts"}
          </p>
        </div>

        <Card className="shadow-elevated border-0">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="fullName" className="text-sm font-semibold">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Coach Smith"
                    required={!isLogin}
                    className="tap-target h-12 text-base rounded-xl"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="coach@school.edu"
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
                {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <span className="text-primary font-semibold">{isLogin ? "Sign up" : "Sign in"}</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
