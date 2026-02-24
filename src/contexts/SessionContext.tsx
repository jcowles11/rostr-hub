import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
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
  currentSession: TryoutSession | null;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType>({
  sessions: [],
  selectedSessionId: "all",
  setSession: () => {},
  createSession: async () => null,
  currentSession: null,
  loading: true,
});

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { coach } = useAuth();
  const [sessions, setSessions] = useState<TryoutSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

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

      // Auto-select today's session if exists, otherwise "all"
      const today = format(new Date(), "yyyy-MM-dd");
      const todaySession = list.find((s) => s.session_date === today);
      if (todaySession) {
        setSelectedSessionId(todaySession.id);
      } else {
        setSelectedSessionId("all");
      }
      setLoading(false);
    };

    fetchSessions();
  }, [coach?.program_id]);

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

  const currentSession = sessions.find((s) => s.id === selectedSessionId) || null;

  return (
    <SessionContext.Provider value={{ sessions, selectedSessionId, setSession, createSession, currentSession, loading }}>
      {children}
    </SessionContext.Provider>
  );
}
