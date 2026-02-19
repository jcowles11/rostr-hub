import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface CoachInfo {
  id: string;
  program_id: string;
  full_name: string;
  role: "head_coach" | "assistant_coach";
  color: string;
  program_name?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  coach: CoachInfo | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshCoach: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  coach: null,
  loading: true,
  signOut: async () => {},
  refreshCoach: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [coach, setCoach] = useState<CoachInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCoach = async (userId: string) => {
    const { data } = await supabase
      .from("coaches")
      .select("id, program_id, full_name, role, color, programs(name)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (data) {
      const programData = data.programs as unknown as { name: string } | null;
      setCoach({
        id: data.id,
        program_id: data.program_id,
        full_name: data.full_name,
        role: data.role,
        color: data.color,
        program_name: programData?.name,
      });
    } else {
      setCoach(null);
    }
  };

  const refreshCoach = async () => {
    if (user) await fetchCoach(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchCoach(session.user.id), 0);
        } else {
          setCoach(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchCoach(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setCoach(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, coach, loading, signOut, refreshCoach }}>
      {children}
    </AuthContext.Provider>
  );
}
