import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, AdminRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import ForceChangePasswordPage from "@/pages/ForceChangePasswordPage";
import HomePage from "@/pages/HomePage";
import CuradoriaPage from "@/pages/CuradoriaPage";
import WineDetailPage from "@/pages/WineDetailPage";
import ParceirosPage from "@/pages/ParceirosPage";
import SelosPage from "@/pages/SelosPage";
import SommelierPage from "@/pages/SommelierPage";
import AdminPage from "@/pages/AdminPage";
import MyAccountPage from "@/pages/MyAccountPage";
import RankingPage from "@/pages/RankingPage";
import CursosPage from "@/pages/CursosPage";
import CursoDetailPage from "@/pages/CursoDetailPage";
import AulaPage from "@/pages/AulaPage";
import NotFound from "@/pages/NotFound";
import SommelierTestPage from "@/pages/SommelierTestPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/trocar-senha" element={<ForceChangePasswordPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="home" element={<HomePage />} />
              <Route path="/curadoria" element={<CuradoriaPage />} />
              <Route path="/curadoria/:id" element={<WineDetailPage />} />
              <Route path="/sommelier" element={<SommelierPage />} />
              <Route path="/parceiros" element={<ParceirosPage />} />
              <Route path="/selos" element={<SelosPage />} />
              <Route path="/minha-conta" element={<MyAccountPage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/cursos" element={<CursosPage />} />
              <Route path="/cursos/:cursoId" element={<CursoDetailPage />} />
              <Route path="/cursos/:cursoId/aula/:aulaId" element={<AulaPage />} />
              <Route path="/sommelier-test" element={<AdminRoute><SommelierTestPage /></AdminRoute>} />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminPage />
                  </AdminRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
