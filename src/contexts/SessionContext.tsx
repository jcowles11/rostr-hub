import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { fetchTryoutSessions, deleteTryoutSession, type TryoutSession } from "@/services/sessionService";
import { track } from "@/services/analyticsService";

export type { TryoutSession };

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

    const loadSessions = async () => {
      try {
        const { data, error } = await fetchTryoutSessions(coach.program_id);
        if (error) {
          console.error("[SessionContext] fetchSessions error:", error);
        }
        // Service returns ascending by date; reverse for context (newest first)
        const list = [...data].reverse();
        setSessions(list);
        if (isDemo && list.length > 0) {
          setSelectedSessionId(list[0].id);
        } else {
          setSelectedSessionId("all");
        }
      } catch (err) {
        console.error("[SessionContext] fetchSessions unexpected error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
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
    if (coach) track("session_create", coach.program_id, coach.id, { source: "context" });
    return newSession;
  }, [coach]);

  const deleteSession = useCallback(async (id: string): Promise<boolean> => {
    if (!coach) return false;
    // Use unified service function for safe cascade delete
    const { error } = await deleteTryoutSession(id);
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
