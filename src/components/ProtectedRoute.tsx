import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRef } from "react";
import { Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, membershipLoading, membershipActive, mustChangePassword, signOut } = useAuth();

  // Once we've rendered children successfully, never go back to a spinner.
  // This prevents the app tree from being unmounted during silent token refreshes
  // or background revalidation.
  const wasAuthenticated = useRef(false);

  const isBootstrapping = loading || membershipLoading;

  if (isBootstrapping && !wasAuthenticated.current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If we're still loading but were previously authenticated, show children
  // to avoid unmounting the app tree. The auth context will redirect to login
  // if the session is actually invalid.
  if (isBootstrapping && wasAuthenticated.current) {
    return <>{children}</>;
  }

  if (!user) {
    wasAuthenticated.current = false;
    return <Navigate to="/login" replace />;
  }

  if (!membershipActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm space-y-4">
          <ShieldX className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Acesso bloqueado</h1>
          <p className="text-sm text-muted-foreground">
            Sua assinatura não está ativa. Entre em contato com o suporte ou renove sua assinatura para acessar o portal.
          </p>
          <Button variant="outline" onClick={() => signOut()}>Sair</Button>
        </div>
      </div>
    );
  }

  if (mustChangePassword) {
    return <Navigate to="/trocar-senha" replace />;
  }

  // Mark as authenticated — from now on, never show spinner again
  wasAuthenticated.current = true;

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role !== "admin") {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
