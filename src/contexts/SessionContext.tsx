import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

export interface TryoutSession {
  id: string;
  name: string;
  session_date: string;
  notes: string | null;
}

interface SessionContextType {
  sessions: TryoutSession[];
  selectedSessionId: string; // uuid or "all"
  setSession: (id: string) => void;
  createSession: (name: string) => Promise<TryoutSession | null>;
  deleteSession: (id: string) => Promise<boolean>;
  currentSession: TryoutSession | null;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType>({
  sessions: [],
  selectedSessionId: "all",
  setSession: () => {},
  createSession: async () => null,
  deleteSession: async () => false,
  currentSession: null,
  loading: true,
});

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { coach, devRoleOverride } = useAuth();
  const [sessions, setSessions] = useState<TryoutSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const isDemo = useMemo(() => !!devRoleOverride || !!sessionStorage.getItem("rostr_demo_mode"), [devRoleOverride]);

  useEffect(() => {
    if (!coach) {
      setSessions([]);
      setSelectedSessionId("all");
      setLoading(false);
      return;
    }

    const fetchSessions = async () => {
      const { data } = await supabase
        .from("tryout_sessions")
        .select("id, name, session_date, notes")
        .eq("program_id", coach.program_id)
        .order("session_date", { ascending: false });

      const list = data || [];
      setSessions(list);
      // In demo mode, auto-select the first session so Score Entry works immediately
      if (isDemo && list.length > 0) {
        setSelectedSessionId(list[0].id);
      } else {
        setSelectedSessionId("all");
      }
      setLoading(false);
    };

    fetchSessions();
  }, [coach?.program_id, isDemo]);

  const setSession = useCallback((id: string) => {
    setSelectedSessionId(id);
  }, []);

  const createSession = useCallback(async (name: string): Promise<TryoutSession | null> => {
    if (!coach) return null;
    const { data, error } = await supabase
      .from("tryout_sessions")
      .insert({ program_id: coach.program_id, name: name.trim() })
      .select()
      .single();

    if (error || !data) return null;

    const newSession: TryoutSession = data;
    setSessions((prev) => [newSession, ...prev]);
    setSelectedSessionId(newSession.id);
    return newSession;
  }, [coach]);

  const deleteSession = useCallback(async (id: string): Promise<boolean> => {
    if (!coach) return false;
    // Unassign evaluations from this session first
    await supabase
      .from("evaluations")
      .update({ session_id: null })
      .eq("session_id", id);
    // Delete attendance records
    await supabase.from("session_attendance").delete().eq("session_id", id);
    // Delete the session
    const { error } = await supabase.from("tryout_sessions").delete().eq("id", id);
    if (error) return false;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (selectedSessionId === id) setSelectedSessionId("all");
    return true;
  }, [coach, selectedSessionId]);

  const currentSession = sessions.find((s) => s.id === selectedSessionId) || null;

  return (
    <SessionContext.Provider value={{ sessions, selectedSessionId, setSession, createSession, deleteSession, currentSession, loading }}>
      {children}
    </SessionContext.Provider>
  );
}
