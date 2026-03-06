import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Lock, ShieldCheck } from "lucide-react";

export default function ForceChangePasswordPage() {
  const { user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo de 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas não coincidem", variant: "destructive" });
      return;
    }

    setSaving(true);

    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
    if (pwError) {
      toast({ title: "Erro ao trocar senha", description: pwError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({ must_change_password: false } as any)
      .eq("user_id", user!.id);

    toast({ title: "Senha criada com sucesso!" });
    await refreshProfile();
    setSaving(false);
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <ShieldCheck className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-xl font-display font-semibold text-foreground">
            Crie sua senha
          </h1>
          <p className="text-sm text-muted-foreground">
            Sua senha inicial é o seu email. Por segurança, crie uma nova senha para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar senha</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            Criar Senha
          </Button>
        </form>

        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => signOut()}>
          Sair
        </Button>
      </div>
    </div>
  );
}
