import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, membershipActive, signOut } = useAuth();

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
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
