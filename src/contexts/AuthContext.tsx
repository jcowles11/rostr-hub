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
  program_levels?: string[];
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
  deleteProgram: (programId: string) => Promise<boolean>;
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
  deleteProgram: async () => false,
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
      .select("id, program_id, full_name, role, color, programs(name, levels)")
      .eq("user_id", userId);

    if (data && data.length > 0) {
      const coaches: CoachInfo[] = data.map((d) => {
        const programData = d.programs as unknown as { name: string; levels: string[] } | null;
        return {
          id: d.id,
          program_id: d.program_id,
          full_name: d.full_name,
          role: d.role,
          color: d.color,
          program_name: programData?.name,
          program_levels: programData?.levels,
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

  const deleteProgram = async (programId: string): Promise<boolean> => {
    // Delete all related data, then the program itself
    const tables = ["evaluations", "player_notes", "roster_assignments", "session_attendance", "tryout_sessions", "players", "metrics", "coaches"] as const;
    for (const table of tables) {
      if (table === "session_attendance") {
        // session_attendance links via tryout_sessions, delete by session ids
        const { data: sessions } = await supabase.from("tryout_sessions").select("id").eq("program_id", programId);
        if (sessions && sessions.length > 0) {
          const sessionIds = sessions.map((s) => s.id);
          await supabase.from("session_attendance").delete().in("session_id", sessionIds);
        }
      } else {
        await supabase.from(table).delete().eq("program_id", programId);
      }
    }
    const { error } = await supabase.from("programs").delete().eq("id", programId);
    if (error) return false;

    // Refresh coach list
    if (user) {
      await fetchCoaches(user.id);
    }
    return true;
  };

  return (
    <AuthContext.Provider value={{ session, user, coach, allCoaches, loading, signOut, refreshCoach, switchProgram, deleteProgram }}>
      {children}
    </AuthContext.Provider>
  );
}
