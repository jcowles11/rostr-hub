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
  program_id: string | null;
  first_name: string;
  last_name: string;
  player_number: number | null;
  photo_url: string | null;
  program_name?: string;
}

export interface EvaluatorInfo {
  id: string;
  user_id: string;
  full_name: string;
  organization_name: string;
  title: string | null;
  sport: string;
  verified: boolean;
}

export interface ScoutInfo {
  id: string;
  user_id: string;
  full_name: string;
  organization_name: string;
  title: string | null;
}

type UserRole = "coach" | "player" | "evaluator" | "scout" | null;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  coach: CoachInfo | null;
  playerInfo: PlayerInfo | null;
  evaluatorInfo: EvaluatorInfo | null;
  scoutInfo: ScoutInfo | null;
  allCoaches: CoachInfo[];
  organizations: OrgInfo[];
  currentOrg: OrgInfo | null;
  userRole: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshCoach: () => Promise<void>;
  refreshPlayer: () => Promise<void>;
  refreshEvaluator: () => Promise<void>;
  refreshScout: () => Promise<void>;
  switchProgram: (coachId: string) => void;
  switchOrg: (orgId: string) => void;
  deleteProgram: (programId: string) => Promise<boolean>;
  devRoleOverride: UserRole;
  setDevRoleOverride: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  coach: null,
  playerInfo: null,
  evaluatorInfo: null,
  scoutInfo: null,
  allCoaches: [],
  organizations: [],
  currentOrg: null,
  userRole: null,
  loading: true,
  signOut: async () => {},
  refreshCoach: async () => {},
  refreshPlayer: async () => {},
  refreshEvaluator: async () => {},
  refreshScout: async () => {},
  switchProgram: () => {},
  switchOrg: () => {},
  deleteProgram: async () => false,
  devRoleOverride: null,
  setDevRoleOverride: () => {},
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
  const [evaluatorInfo, setEvaluatorInfo] = useState<EvaluatorInfo | null>(null);
  const [scoutInfo, setScoutInfo] = useState<ScoutInfo | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [devRoleOverride, setDevRoleOverride] = useState<UserRole>(null);

  const fetchCoaches = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("coaches")
        .select("id, program_id, full_name, role, color, programs(name, levels, logo_url, sport, organization_id, organizations(id, name, logo_url))")
        .eq("user_id", userId);

      if (error) {
        console.error("[AuthContext] fetchCoaches error:", error.message);
        return false;
      }

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

        const lastProgramId = localStorage.getItem(`rostr_active_program_${userId}`);
        const restored = coaches.find((c) => c.program_id === lastProgramId);
        const activeCoach = restored || coaches[0];
        setCoach(activeCoach);

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
    } catch (err) {
      console.error("[AuthContext] fetchCoaches unexpected error:", err);
      setAllCoaches([]);
      setOrganizations([]);
      setCurrentOrg(null);
      setCoach(null);
      return false;
    }
  };

  const fetchPlayer = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("players")
        .select("id, program_id, first_name, last_name, player_number, photo_url, programs(name)")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[AuthContext] fetchPlayer error:", error.message);
        return false;
      }

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
    } catch (err) {
      console.error("[AuthContext] fetchPlayer unexpected error:", err);
      setPlayerInfo(null);
      return false;
    }
  };

  const fetchEvaluator = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("evaluators")
        .select("id, user_id, full_name, organization_name, title, sport, verified")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[AuthContext] fetchEvaluator error:", error.message);
        return false;
      }

      if (data) {
        setEvaluatorInfo(data as EvaluatorInfo);
        return true;
      }
      setEvaluatorInfo(null);
      return false;
    } catch (err) {
      console.error("[AuthContext] fetchEvaluator unexpected error:", err);
      setEvaluatorInfo(null);
      return false;
    }
  };

  const fetchScout = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("scouts")
        .select("id, user_id, full_name, organization_name, title")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[AuthContext] fetchScout error:", error.message);
        return false;
      }

      if (data) {
        setScoutInfo(data as ScoutInfo);
        return true;
      }
      setScoutInfo(null);
      return false;
    } catch (err) {
      console.error("[AuthContext] fetchScout unexpected error:", err);
      setScoutInfo(null);
      return false;
    }
  };

  const fetchUserRole = async (userId: string) => {
    const isCoach = await fetchCoaches(userId);
    if (isCoach) {
      setUserRole("coach");
      return;
    }

    const isEvaluator = await fetchEvaluator(userId);
    if (isEvaluator) {
      setUserRole("evaluator");
      return;
    }

    const isScout = await fetchScout(userId);
    if (isScout) {
      setUserRole("scout");
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

        if (program_id) {
          // Program-linked registration: try to match existing player or create one
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
        } else {
          // Standalone registration: create player with no program
          await supabase.from("players").insert({
            first_name: firstName,
            last_name: lastName,
            user_id: userId,
            program_id: null,
          } as any);
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
    if (accountType === "evaluator") {
      setUserRole("evaluator");
      return;
    }
    if (accountType === "scout") {
      // Auto-create scout profile from stored setup info
      const scoutStored = localStorage.getItem(`rostr_scout_setup_${userId}`);
      if (scoutStored) {
        try {
          const { full_name, organization_name } = JSON.parse(scoutStored);
          await supabase.from("scouts").insert({
            user_id: userId,
            full_name,
            organization_name: organization_name || "",
          });
          localStorage.removeItem(`rostr_scout_setup_${userId}`);
          const linked = await fetchScout(userId);
          if (linked) {
            setUserRole("scout");
            return;
          }
        } catch {
          // Ignore
        }
      }
      setUserRole("scout");
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

  const refreshEvaluator = async () => {
    if (user) {
      const found = await fetchEvaluator(user.id);
      if (found) setUserRole("evaluator");
    }
  };

  const refreshScout = async () => {
    if (user) {
      const found = await fetchScout(user.id);
      if (found) setUserRole("scout");
    }
  };

  const switchProgram = (coachId: string) => {
    const target = allCoaches.find((c) => c.id === coachId);
    if (target && user) {
      setCoach(target);
      localStorage.setItem(`rostr_active_program_${user.id}`, target.program_id);
      const org = organizations.find((o) => o.id === target.organization_id);
      if (org) setCurrentOrg(org);
    }
  };

  const switchOrg = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      const firstCoach = allCoaches.find((c) => c.organization_id === orgId);
      if (firstCoach && user) {
        setCoach(firstCoach);
        localStorage.setItem(`rostr_active_program_${user.id}`, firstCoach.program_id);
      }
    }
  };

  // Auto-fetch role-specific data when dev override changes
  useEffect(() => {
    if (!user || !devRoleOverride) return;
    if (devRoleOverride === "scout" && !scoutInfo) {
      fetchScout(user.id);
    }
    if (devRoleOverride === "evaluator" && !evaluatorInfo) {
      fetchEvaluator(user.id);
    }
    if (devRoleOverride === "player" && !playerInfo) {
      fetchPlayer(user.id);
    }
  }, [devRoleOverride, user]);

  useEffect(() => {
    let initialLoad = true;
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (initialLoad || !mounted) return;
        // Show loading screen while we resolve the user's role
        if (session?.user) setLoading(true);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          try {
            await fetchUserRole(session.user.id);
          } catch (err) {
            console.error("[AuthContext] auth state change fetchUserRole error:", err);
          }
        } else {
          setCoach(null);
          setAllCoaches([]);
          setOrganizations([]);
          setCurrentOrg(null);
          setPlayerInfo(null);
          setEvaluatorInfo(null);
          setScoutInfo(null);
          setUserRole(null);
        }
        if (mounted) setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          await fetchUserRole(session.user.id);
        } catch (err) {
          console.error("[AuthContext] initial fetchUserRole error:", err);
        }
      }
      if (mounted) {
        setLoading(false);
        initialLoad = false;
      }
    }).catch((err) => {
      console.error("[AuthContext] getSession error:", err);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setCoach(null);
    setAllCoaches([]);
    setOrganizations([]);
    setCurrentOrg(null);
    setPlayerInfo(null);
    setEvaluatorInfo(null);
    setScoutInfo(null);
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
    await supabase.from("organization_members").delete().eq("program_id", programId);
    await supabase.from("teams").delete().eq("program_id", programId);

    const { error } = await supabase.from("programs").delete().eq("id", programId);
    if (error) return false;
    if (user) await fetchCoaches(user.id);
    return true;
  };

  // Demo mode: when entering coach demo, pick the program with the most players
  useEffect(() => {
    if (devRoleOverride !== "coach" || !user) return;

    (async () => {
      // Check if user already has coach records
      const { data: existingCoaches } = await supabase
        .from("coaches")
        .select("id, program_id, full_name, role, color, programs(name, levels, logo_url, sport, organization_id, organizations(id, name, logo_url))")
        .eq("user_id", user.id);

      const toCoachInfo = (c: any): CoachInfo => {
        const pd = c.programs as any;
        return {
          id: c.id, program_id: c.program_id,
          full_name: c.full_name, role: c.role, color: c.color,
          program_name: pd?.name, program_levels: pd?.levels, logo_url: pd?.logo_url,
          sport: pd?.sport, organization_id: pd?.organization_id, organization_name: pd?.organizations?.name,
        };
      };

      if (existingCoaches && existingCoaches.length > 0) {
        // Prefer a baseball program for demo, then fall back to most players
        let bestCoach = existingCoaches[0];
        const baseballCoaches = existingCoaches.filter((c) => (c.programs as any)?.sport === "baseball");
        const candidates = baseballCoaches.length > 0 ? baseballCoaches : existingCoaches;
        if (candidates.length > 1) {
          const counts = await Promise.all(
            candidates.map(async (c) => {
              const { count } = await supabase
                .from("players")
                .select("id", { count: "exact", head: true })
                .eq("program_id", c.program_id);
              return { coach: c, count: count || 0 };
            })
          );
          counts.sort((a, b) => b.count - a.count);
          bestCoach = counts[0].coach;
        } else {
          bestCoach = candidates[0];
        }
        setCoach(toCoachInfo(bestCoach));
        setAllCoaches(existingCoaches.map(toCoachInfo));
        return;
      }

      // No coach records — create one for demo
      const { data: anyProgram } = await supabase
        .from("programs")
        .select("id, organization_id")
        .limit(1)
        .maybeSingle();

      if (!anyProgram) return;

      const displayName = user.user_metadata?.full_name || user.email || "Demo Coach";

      const { data: newCoach, error } = await supabase
        .from("coaches")
        .insert({
          user_id: user.id,
          program_id: anyProgram.id,
          full_name: displayName,
          email: user.email || "",
          role: "head_coach" as const,
        })
        .select("id, program_id, full_name, role, color, programs(name, levels, logo_url, sport, organization_id, organizations(id, name, logo_url))")
        .single();

      if (!error && newCoach) {
        await supabase.from("organization_members").insert({
          user_id: user.id,
          organization_id: anyProgram.organization_id,
          program_id: anyProgram.id,
          email: user.email || "",
          full_name: displayName,
          role: "admin" as const,
        });
        setCoach(toCoachInfo(newCoach));
        setAllCoaches([toCoachInfo(newCoach)]);
      }
    })();
  }, [devRoleOverride, user]);

  // Demo mode: when entering player demo, provision a player record
  useEffect(() => {
    if (devRoleOverride !== "player" || !user) return;

    (async () => {
      // Check if user already has a player record
      const { data: existingPlayer } = await supabase
        .from("players")
        .select("id, program_id, first_name, last_name, player_number, photo_url, programs(name)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (existingPlayer) {
        const pd = existingPlayer.programs as unknown as { name: string } | null;
        setPlayerInfo({
          id: existingPlayer.id,
          program_id: existingPlayer.program_id,
          first_name: existingPlayer.first_name,
          last_name: existingPlayer.last_name,
          player_number: existingPlayer.player_number,
          photo_url: existingPlayer.photo_url,
          program_name: pd?.name,
        });
        return;
      }

      // No player record — pick a random existing player to "impersonate" for demo,
      // or create a standalone player profile
      const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Demo Player";
      const parts = displayName.split(" ");
      const firstName = parts[0] || "Demo";
      const lastName = parts.slice(1).join(" ") || "Player";

      // Try to find a program with players for a richer demo
      const { data: anyProgram } = await supabase
        .from("programs")
        .select("id")
        .limit(1)
        .maybeSingle();

      const { data: newPlayer, error } = await supabase
        .from("players")
        .insert({
          user_id: user.id,
          first_name: firstName,
          last_name: lastName,
          program_id: anyProgram?.id || null,
        } as any)
        .select("id, program_id, first_name, last_name, player_number, photo_url, programs(name)")
        .single();

      if (!error && newPlayer) {
        const pd = newPlayer.programs as unknown as { name: string } | null;
        setPlayerInfo({
          id: newPlayer.id,
          program_id: newPlayer.program_id,
          first_name: newPlayer.first_name,
          last_name: newPlayer.last_name,
          player_number: newPlayer.player_number,
          photo_url: newPlayer.photo_url,
          program_name: pd?.name,
        });
      }
    })();
  }, [devRoleOverride, user]);

  return (
    <AuthContext.Provider value={{ session, user, coach, playerInfo, evaluatorInfo, scoutInfo, allCoaches, organizations, currentOrg, userRole: devRoleOverride || userRole, loading, signOut, refreshCoach, refreshPlayer, refreshEvaluator, refreshScout, switchProgram, switchOrg, deleteProgram, devRoleOverride, setDevRoleOverride }}>
      {children}
    </AuthContext.Provider>
  );
}
