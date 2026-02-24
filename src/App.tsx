import { useEffect } from "react";
import rostrLogo from "@/assets/rostr-logo.png";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SessionProvider } from "@/contexts/SessionContext";
import AppLayout from "@/components/AppLayout";
import UnifiedNavShell from "@/components/UnifiedNavShell";
import DevRoleSwitcher from "@/components/DevRoleSwitcher";
import Auth from "@/pages/Auth";
import ProgramSetup from "@/pages/ProgramSetup";
import Roster from "@/pages/Roster";
import ScoreEntry from "@/pages/ScoreEntry";
import Dashboard from "@/pages/Dashboard";
import SettingsPage from "@/pages/SettingsPage";
import TryoutPlanner from "@/pages/TryoutPlanner";
import PlayerRegister from "@/pages/PlayerRegister";
import PlayerDetail from "@/pages/PlayerDetail";
import RosterBoard from "@/pages/RosterBoard";
import ExportPage from "@/pages/ExportPage";
import PlayerDashboard from "@/pages/PlayerDashboard";
import PlayerLinkPage from "@/pages/PlayerLinkPage";
import PublicProfile from "@/pages/PublicProfile";
import EvaluatorDashboard from "@/pages/EvaluatorDashboard";
import EvaluatorProfile from "@/pages/EvaluatorProfile";
import ScoutDashboard from "@/pages/ScoutDashboard";
import ScoutProfilePage from "@/pages/ScoutProfilePage";
import ScoutSavedProspects from "@/pages/ScoutSavedProspects";
import ScoutListsPage from "@/pages/ScoutListsPage";
import ScoutMessagesPage from "@/pages/ScoutMessagesPage";
import PlayerMessagesPage from "@/pages/PlayerMessagesPage";
import SocialPage from "@/pages/SocialPage";
import JoinProgram from "@/pages/JoinProgram";
import SearchPage from "@/pages/SearchPage";
import NotificationsPage from "@/pages/NotificationsPage";
import DemoTour from "@/pages/DemoTour";
import ReadinessChecklist from "@/pages/ReadinessChecklist";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

function GlobalErrorBoundary() {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("[Rostr] Unhandled promise rejection:", event.reason);
      // Prevent the browser from showing a generic error / crashing the page
      event.preventDefault();
    };

    const handleError = (event: ErrorEvent) => {
      console.error("[Rostr] Uncaught error:", event.error);
    };

    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  return null;
}
function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center animate-scale-in">
        <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-20 w-20 rounded-3xl shadow-glow animate-pulse-soft object-cover" />
        <p className="text-muted-foreground font-medium">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, coach, userRole, playerInfo, loading, devRoleOverride } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  const effectiveRole = devRoleOverride || userRole;

  if (effectiveRole === "coach") {
    return <SessionProvider><AppLayout>{children}</AppLayout></SessionProvider>;
  }

  if (effectiveRole === "player") {
    return playerInfo ? <Navigate to="/social" replace /> : <Navigate to="/player-link" replace />;
  }
  if (effectiveRole === "evaluator") return <Navigate to="/evaluator" replace />;
  if (effectiveRole === "scout") return <Navigate to="/scout" replace />;

  if (!coach) return <Navigate to="/setup" replace />;

  return <SessionProvider><AppLayout>{children}</AppLayout></SessionProvider>;
}

function PlayerRoute({ children }: { children: React.ReactNode }) {
  const { user, userRole, playerInfo, loading, devRoleOverride } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  if (devRoleOverride === "player") return <>{children}</>;

  if (userRole === "player" && playerInfo) return <>{children}</>;
  if (userRole === null && !loading) return <Navigate to="/player-link" replace />;
  if (userRole === "coach") return <Navigate to="/" replace />;
  if (userRole === "evaluator") return <Navigate to="/evaluator" replace />;
  if (userRole === "scout") return <Navigate to="/scout" replace />;

  return <Navigate to="/player-link" replace />;
}

function EvaluatorRoute({ children }: { children: React.ReactNode }) {
  const { user, userRole, loading, devRoleOverride } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (devRoleOverride === "evaluator") return <>{children}</>;
  if (userRole === "evaluator") return <>{children}</>;
  if (userRole === "coach") return <Navigate to="/" replace />;
  if (userRole === "player") return <Navigate to="/player-dashboard" replace />;
  if (userRole === "scout") return <Navigate to="/scout" replace />;

  return <Navigate to="/auth" replace />;
}

function ScoutRoute({ children }: { children: React.ReactNode }) {
  const { user, userRole, loading, devRoleOverride } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (devRoleOverride === "scout") return <>{children}</>;
  if (userRole === "scout") return <>{children}</>;
  if (userRole === "coach") return <Navigate to="/" replace />;
  if (userRole === "player") return <Navigate to="/player-dashboard" replace />;
  if (userRole === "evaluator") return <Navigate to="/evaluator" replace />;

  return <Navigate to="/auth" replace />;
}

/** Search accessible to players, scouts, and evaluators */
function SearchRoute() {
  const { user, userRole, loading, devRoleOverride } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  const effectiveRole = devRoleOverride || userRole;
  if (effectiveRole === "player" || effectiveRole === "scout" || effectiveRole === "evaluator") {
    return <UnifiedNavShell><SearchPage /></UnifiedNavShell>;
  }
  return <Navigate to="/" replace />;
}

/** Notifications accessible to all authenticated non-coach roles via UnifiedNavShell, coaches via AppLayout */
function NotificationsRoute() {
  const { user, coach, userRole, loading, devRoleOverride } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  const effectiveRole = devRoleOverride || userRole;
  if (effectiveRole === "coach" && coach) {
    return <SessionProvider><AppLayout><NotificationsPage /></AppLayout></SessionProvider>;
  }
  return <UnifiedNavShell><NotificationsPage /></UnifiedNavShell>;
}

/** Social is accessible to all authenticated users */
function SocialRoute() {
  const { user, coach, userRole, loading, devRoleOverride } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  const effectiveRole = devRoleOverride || userRole;

  if (effectiveRole === "coach" && coach) {
    return (
      <SessionProvider>
        <AppLayout>
          <SocialPage />
        </AppLayout>
      </SessionProvider>
    );
  }

  return (
    <UnifiedNavShell>
      <SocialPage />
    </UnifiedNavShell>
  );
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, coach, userRole, loading } = useAuth();
  const redirectTo = new URLSearchParams(window.location.search).get("redirect");
  if (loading) return null;
  if (user && redirectTo) return <Navigate to={redirectTo} replace />;
  if (user && userRole === "player") return <Navigate to="/social" replace />;
  if (user && userRole === "evaluator") return <Navigate to="/evaluator" replace />;
  if (user && userRole === "scout") return <Navigate to="/scout" replace />;
  if (user && coach) return <Navigate to="/" replace />;
  if (user && !coach && userRole !== "player" && userRole !== "evaluator" && userRole !== "scout") return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

function SetupRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <ProgramSetup />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GlobalErrorBoundary />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DevRoleSwitcher />
          <Routes>
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/setup" element={<SetupRoute />} />
            <Route path="/demo" element={<DemoTour />} />
            <Route path="/join/:code" element={<JoinProgram />} />
            <Route path="/register/:code" element={<PlayerRegister />} />
            <Route path="/player-dashboard" element={<PlayerRoute><UnifiedNavShell><PlayerDashboard /></UnifiedNavShell></PlayerRoute>} />
            <Route path="/player/messages" element={<PlayerRoute><UnifiedNavShell><PlayerMessagesPage /></UnifiedNavShell></PlayerRoute>} />
            <Route path="/search" element={<SearchRoute />} />
            <Route path="/player-link" element={<PlayerLinkPage />} />
            <Route path="/evaluator" element={<EvaluatorRoute><UnifiedNavShell><EvaluatorDashboard /></UnifiedNavShell></EvaluatorRoute>} />
            <Route path="/scout" element={<ScoutRoute><UnifiedNavShell><ScoutDashboard /></UnifiedNavShell></ScoutRoute>} />
            <Route path="/scout/profile" element={<ScoutRoute><UnifiedNavShell><ScoutProfilePage /></UnifiedNavShell></ScoutRoute>} />
            <Route path="/scout/prospects" element={<ScoutRoute><UnifiedNavShell><ScoutSavedProspects /></UnifiedNavShell></ScoutRoute>} />
            <Route path="/scout/lists" element={<ScoutRoute><UnifiedNavShell><ScoutListsPage /></UnifiedNavShell></ScoutRoute>} />
            <Route path="/scout/messages" element={<ScoutRoute><UnifiedNavShell><ScoutMessagesPage /></UnifiedNavShell></ScoutRoute>} />
            <Route path="/notifications" element={<NotificationsRoute />} />
            <Route path="/social" element={<SocialRoute />} />
            <Route path="/p/:slug" element={<PublicProfile />} />
            <Route path="/evaluator/:id" element={<EvaluatorProfile />} />
            <Route path="/" element={<ProtectedRoute><Roster /></ProtectedRoute>} />
            <Route path="/score" element={<ProtectedRoute><ScoreEntry /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/roster-board" element={<ProtectedRoute><RosterBoard /></ProtectedRoute>} />
            <Route path="/export" element={<ProtectedRoute><ExportPage /></ProtectedRoute>} />
            <Route path="/player/:id" element={<ProtectedRoute><PlayerDetail /></ProtectedRoute>} />
            <Route path="/plan" element={<ProtectedRoute><TryoutPlanner /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/readiness" element={<ProtectedRoute><ReadinessChecklist /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
