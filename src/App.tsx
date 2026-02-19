import rostrLogo from "@/assets/rostr-logo.png";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import ProgramSetup from "@/pages/ProgramSetup";
import Roster from "@/pages/Roster";
import ScoreEntry from "@/pages/ScoreEntry";
import Dashboard from "@/pages/Dashboard";
import SettingsPage from "@/pages/SettingsPage";
import PlayerRegister from "@/pages/PlayerRegister";
import PlayerDetail from "@/pages/PlayerDetail";
import RosterBoard from "@/pages/RosterBoard";
import ExportPage from "@/pages/ExportPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, coach, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center animate-scale-in">
          <img src={rostrLogo} alt="Rostr" className="mx-auto mb-4 h-20 w-20 rounded-3xl shadow-glow animate-pulse-soft object-cover" />
          <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!coach) return <Navigate to="/setup" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, coach, loading } = useAuth();
  if (loading) return null;
  if (user && coach) return <Navigate to="/" replace />;
  if (user && !coach) return <Navigate to="/setup" replace />;
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
          <Routes>
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/setup" element={<SetupRoute />} />
            <Route path="/register/:code" element={<PlayerRegister />} />
            <Route path="/" element={<ProtectedRoute><Roster /></ProtectedRoute>} />
            <Route path="/score" element={<ProtectedRoute><ScoreEntry /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/roster-board" element={<ProtectedRoute><RosterBoard /></ProtectedRoute>} />
            <Route path="/export" element={<ProtectedRoute><ExportPage /></ProtectedRoute>} />
            <Route path="/player/:id" element={<ProtectedRoute><PlayerDetail /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
