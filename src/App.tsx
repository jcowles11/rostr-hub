import rostrLogo from "@/assets/rostr-logo.png";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import SocialPage from "@/pages/SocialPage";
import JoinProgram from "@/pages/JoinProgram";
import SearchPage from "@/pages/SearchPage";
import NotificationsPage from "@/pages/NotificationsPage";
import DemoTour from "@/pages/DemoTour";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

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

  // In demo mode with coach override, skip role redirects
  if (devRoleOverride === "coach") {
    if (coach) return <SessionProvider><AppLayout>{children}</AppLayout></SessionProvider>;
    // No coach record but demo override — still show layout
    return <SessionProvider><AppLayout>{children}</AppLayout></SessionProvider>;
  }

  if (userRole === "player") {
    return playerInfo ? <Navigate to="/social" replace /> : <Navigate to="/player-link" replace />;
  }

  if (userRole === "evaluator") {
    return <Navigate to="/evaluator" replace />;
  }

  if (userRole === "scout") {
    return <Navigate to="/scout" replace />;
  }

  if (!coach) return <Navigate to="/setup" replace />;

  return <SessionProvider><AppLayout>{children}</AppLayout></SessionProvider>;
}

function PlayerRoute({ children }: { children: React.ReactNode }) {
  const { user, userRole, playerInfo, loading, devRoleOverride } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  // Demo override bypasses guards
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

/** Social is accessible to all authenticated users — coaches stay in AppLayout, others use UnifiedNavShell */
function SocialRoute() {
  const { user, coach, userRole, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  // Coaches: render Social inside AppLayout (keeps coach header + bottom nav)
  if (userRole === "coach" || coach) {
    return (
      <SessionProvider>
        <AppLayout>
          <SocialPage />
        </AppLayout>
      </SessionProvider>
    );
  }

  // Everyone else: use UnifiedNavShell
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
  if (user && userRole === "player") return <Navigate to="/player-dashboard" replace />;
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
            <Route path="/search" element={<PlayerRoute><UnifiedNavShell><SearchPage /></UnifiedNavShell></PlayerRoute>} />
            <Route path="/player-link" element={<PlayerLinkPage />} />
            <Route path="/evaluator" element={<EvaluatorRoute><UnifiedNavShell><EvaluatorDashboard /></UnifiedNavShell></EvaluatorRoute>} />
            <Route path="/scout" element={<ScoutRoute><UnifiedNavShell><ScoutDashboard /></UnifiedNavShell></ScoutRoute>} />
            <Route path="/notifications" element={<UnifiedNavShell><NotificationsPage /></UnifiedNavShell>} />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
