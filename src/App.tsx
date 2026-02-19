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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, coach, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-3xl text-primary-foreground animate-pulse">⚾</div>
          <p className="text-muted-foreground">Loading...</p>
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/setup" element={<ProgramSetup />} />
            <Route path="/register/:code" element={<PlayerRegister />} />
            <Route path="/" element={<ProtectedRoute><Roster /></ProtectedRoute>} />
            <Route path="/score" element={<ProtectedRoute><ScoreEntry /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
