import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface OrgInfo {
  id: string;
  name: string;
  logo_url: string | null;
}

interface CoachInfo {
  id: string;
  program_id: string;
  full_name: string;
  role: "head_coach" | "assistant_coach";
  color: string;
  program_name?: string;
  program_levels?: string[];
  logo_url?: string | null;
  sport?: string;
  organization_id?: string;
  organization_name?: string;
}

interface PlayerInfo {
  id: string;
  program_id: string;
  first_name: string;
  last_name: string;
  player_number: number | null;
  photo_url: string | null;
  program_name?: string;
}

type UserRole = "coach" | "player" | null;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  coach: CoachInfo | null;
  playerInfo: PlayerInfo | null;
  allCoaches: CoachInfo[];
  organizations: OrgInfo[];
  currentOrg: OrgInfo | null;
  userRole: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshCoach: () => Promise<void>;
  refreshPlayer: () => Promise<void>;
  switchProgram: (coachId: string) => void;
  switchOrg: (orgId: string) => void;
  deleteProgram: (programId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  coach: null,
  playerInfo: null,
  allCoaches: [],
  organizations: [],
  currentOrg: null,
  userRole: null,
  loading: true,
  signOut: async () => {},
  refreshCoach: async () => {},
  refreshPlayer: async () => {},
  switchProgram: () => {},
  switchOrg: () => {},
  deleteProgram: async () => false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [coach, setCoach] = useState<CoachInfo | null>(null);
  const [allCoaches, setAllCoaches] = useState<CoachInfo[]>([]);
  const [organizations, setOrganizations] = useState<OrgInfo[]>([]);
  const [currentOrg, setCurrentOrg] = useState<OrgInfo | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchCoaches = async (userId: string) => {
    // Fetch coaches with program and org info
    const { data } = await supabase
      .from("coaches")
      .select("id, program_id, full_name, role, color, programs(name, levels, logo_url, sport, organization_id, organizations(id, name, logo_url))")
      .eq("user_id", userId);

    if (data && data.length > 0) {
      const coaches: CoachInfo[] = data.map((d) => {
        const programData = d.programs as unknown as {
          name: string; levels: string[]; logo_url: string | null; sport: string;
          organization_id: string; organizations: { id: string; name: string; logo_url: string | null } | null;
        } | null;
        return {
          id: d.id,
          program_id: d.program_id,
          full_name: d.full_name,
          role: d.role,
          color: d.color,
          program_name: programData?.name,
          program_levels: programData?.levels,
          logo_url: programData?.logo_url,
          sport: programData?.sport,
          organization_id: programData?.organization_id,
          organization_name: programData?.organizations?.name,
        };
      });
      setAllCoaches(coaches);

      // Build unique orgs list
      const orgMap = new Map<string, OrgInfo>();
      coaches.forEach((c) => {
        if (c.organization_id) {
          const programData = data.find((d) => d.id === c.id)?.programs as any;
          const orgData = programData?.organizations;
          if (orgData) {
            orgMap.set(c.organization_id, { id: orgData.id, name: orgData.name, logo_url: orgData.logo_url });
          }
        }
      });
      const orgs = Array.from(orgMap.values());
      setOrganizations(orgs);

      // Restore active program
      const lastProgramId = localStorage.getItem(`rostr_active_program_${userId}`);
      const restored = coaches.find((c) => c.program_id === lastProgramId);
      const activeCoach = restored || coaches[0];
      setCoach(activeCoach);

      // Set current org
      const activeOrg = orgs.find((o) => o.id === activeCoach.organization_id) || orgs[0] || null;
      setCurrentOrg(activeOrg);

      return true;
    } else {
      setAllCoaches([]);
      setOrganizations([]);
      setCurrentOrg(null);
      setCoach(null);
      return false;
    }
  };

  const fetchPlayer = async (userId: string) => {
    const { data } = await supabase
      .from("players")
      .select("id, program_id, first_name, last_name, player_number, photo_url, programs(name)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (data) {
      const programData = data.programs as unknown as { name: string } | null;
      setPlayerInfo({
        id: data.id,
        program_id: data.program_id,
        first_name: data.first_name,
        last_name: data.last_name,
        player_number: data.player_number,
        photo_url: data.photo_url,
        program_name: programData?.name,
      });
      return true;
    }
    setPlayerInfo(null);
    return false;
  };

  const fetchUserRole = async (userId: string) => {
    const isCoach = await fetchCoaches(userId);
    if (isCoach) {
      setUserRole("coach");
      return;
    }
    const isPlayer = await fetchPlayer(userId);
    if (isPlayer) {
      setUserRole("player");
      return;
    }

    // Check if there's stored registration info to auto-link
    const stored = localStorage.getItem(`rostr_player_reg_${userId}`);
    if (stored) {
      try {
        const { program_id, full_name } = JSON.parse(stored);
        const parts = full_name.split(" ");
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(" ") || "";

        const { data: existingPlayer } = await supabase
          .from("players")
          .select("id")
          .eq("program_id", program_id)
          .ilike("first_name", firstName)
          .ilike("last_name", lastName)
          .is("user_id", null)
          .limit(1)
          .maybeSingle();

        if (existingPlayer) {
          await supabase.from("players").update({ user_id: userId }).eq("id", existingPlayer.id);
        } else {
          await supabase.from("players").insert({
            program_id,
            first_name: firstName,
            last_name: lastName,
            user_id: userId,
          });
        }

        localStorage.removeItem(`rostr_player_reg_${userId}`);
        const linked = await fetchPlayer(userId);
        if (linked) {
          setUserRole("player");
          return;
        }
      } catch {
        // Ignore parse errors
      }
    }

    const accountType = (await supabase.auth.getUser()).data.user?.user_metadata?.account_type;
    if (accountType === "player") {
      setUserRole("player");
      return;
    }

    setUserRole(null);
  };

  const refreshCoach = async () => {
    if (user) await fetchCoaches(user.id);
  };

  const refreshPlayer = async () => {
    if (user) {
      const found = await fetchPlayer(user.id);
      if (found) setUserRole("player");
    }
  };

  const switchProgram = (coachId: string) => {
    const target = allCoaches.find((c) => c.id === coachId);
    if (target && user) {
      setCoach(target);
      localStorage.setItem(`rostr_active_program_${user.id}`, target.program_id);
      // Also update current org
      const org = organizations.find((o) => o.id === target.organization_id);
      if (org) setCurrentOrg(org);
    }
  };

  const switchOrg = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      // Switch to first program in this org
      const firstCoach = allCoaches.find((c) => c.organization_id === orgId);
      if (firstCoach && user) {
        setCoach(firstCoach);
        localStorage.setItem(`rostr_active_program_${user.id}`, firstCoach.program_id);
      }
    }
  };

  useEffect(() => {
    let initialLoad = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (initialLoad) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserRole(session.user.id);
        } else {
          setCoach(null);
          setAllCoaches([]);
          setOrganizations([]);
          setCurrentOrg(null);
          setPlayerInfo(null);
          setUserRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await fetchUserRole(session.user.id);
      setLoading(false);
      initialLoad = false;
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setCoach(null);
    setAllCoaches([]);
    setOrganizations([]);
    setCurrentOrg(null);
    setPlayerInfo(null);
    setUserRole(null);
  };

  const deleteProgram = async (programId: string): Promise<boolean> => {
    const tables = ["evaluations", "player_notes", "roster_assignments", "session_attendance", "tryout_sessions", "players", "metrics", "coaches"] as const;
    for (const table of tables) {
      if (table === "session_attendance") {
        const { data: sessions } = await supabase.from("tryout_sessions").select("id").eq("program_id", programId);
        if (sessions && sessions.length > 0) {
          const sessionIds = sessions.map((s) => s.id);
          await supabase.from("session_attendance").delete().in("session_id", sessionIds);
        }
      } else {
        await supabase.from(table).delete().eq("program_id", programId);
      }
    }
    // Also clean up organization_members for this program
    await supabase.from("organization_members").delete().eq("program_id", programId);
    // Delete teams
    await supabase.from("teams").delete().eq("program_id", programId);

    const { error } = await supabase.from("programs").delete().eq("id", programId);
    if (error) return false;
    if (user) await fetchCoaches(user.id);
    return true;
  };

  return (
    <AuthContext.Provider value={{ session, user, coach, playerInfo, allCoaches, organizations, currentOrg, userRole, loading, signOut, refreshCoach, refreshPlayer, switchProgram, switchOrg, deleteProgram }}>
      {children}
    </AuthContext.Provider>
  );
}
