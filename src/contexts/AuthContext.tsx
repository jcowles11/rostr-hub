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
  allCoaches: CoachInfo[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshCoach: () => Promise<void>;
  switchProgram: (coachId: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  coach: null,
  allCoaches: [],
  loading: true,
  signOut: async () => {},
  refreshCoach: async () => {},
  switchProgram: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [coach, setCoach] = useState<CoachInfo | null>(null);
  const [allCoaches, setAllCoaches] = useState<CoachInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCoaches = async (userId: string) => {
    const { data } = await supabase
      .from("coaches")
      .select("id, program_id, full_name, role, color, programs(name)")
      .eq("user_id", userId);

    if (data && data.length > 0) {
      const coaches: CoachInfo[] = data.map((d) => {
        const programData = d.programs as unknown as { name: string } | null;
        return {
          id: d.id,
          program_id: d.program_id,
          full_name: d.full_name,
          role: d.role,
          color: d.color,
          program_name: programData?.name,
        };
      });
      setAllCoaches(coaches);

      // Restore last selected program or default to first
      const lastProgramId = localStorage.getItem(`rostr_active_program_${userId}`);
      const restored = coaches.find((c) => c.program_id === lastProgramId);
      setCoach(restored || coaches[0]);
    } else {
      setAllCoaches([]);
      setCoach(null);
    }
  };

  const refreshCoach = async () => {
    if (user) await fetchCoaches(user.id);
  };

  const switchProgram = (coachId: string) => {
    const target = allCoaches.find((c) => c.id === coachId);
    if (target && user) {
      setCoach(target);
      localStorage.setItem(`rostr_active_program_${user.id}`, target.program_id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchCoaches(session.user.id);
        } else {
          setCoach(null);
          setAllCoaches([]);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await fetchCoaches(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setCoach(null);
    setAllCoaches([]);
  };

  return (
    <AuthContext.Provider value={{ session, user, coach, allCoaches, loading, signOut, refreshCoach, switchProgram }}>
      {children}
    </AuthContext.Provider>
  );
}
