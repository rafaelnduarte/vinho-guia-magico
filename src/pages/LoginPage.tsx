import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import logoJovem from "@/assets/logo-jovem-do-vinho.png";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({
        title: "Erro ao entrar",
        description: error.message === "Invalid login credentials"
          ? "E-mail ou senha inválidos."
          : error.message,
        variant: "destructive",
      });
    } else {
      navigate("/home");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);

    // Always show same message to avoid email enumeration
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    toast({
      title: "Verifique seu e-mail",
      description: "Se uma conta com esse e-mail existir, você receberá um link para redefinir sua senha.",
    });
    setForgotLoading(false);
    setForgotMode(false);
    setForgotEmail("");
  };

  return (
    <div className="flex min-h-[100dvh]">
      {/* Left panel - decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-secondary items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-primary to-secondary opacity-80" />
        <div className="relative z-10 text-center px-12">
          <img src={logoJovem} alt="Jovem do Vinho" className="h-32 w-32 mx-auto mb-6 bg-white rounded-full p-2 shadow-lg" />
          <h1 className="text-4xl font-display font-normal text-primary-foreground mb-4">
            Radar do Jovem
          </h1>
          <p className="text-primary-foreground/80 text-lg">
            A maior curadoria independente do Brasil
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center lg:hidden">
            <img src={logoJovem} alt="Jovem do Vinho" className="h-20 w-20 mx-auto mb-3 drop-shadow-lg" />
            <h1 className="text-2xl font-display font-normal text-foreground">Radar do Jovem</h1>
          </div>

          {forgotMode ? (
            <>
              <div>
                <h2 className="text-2xl font-display text-foreground">Recuperar senha</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Informe seu e-mail para receber o link de redefinição.
                </p>
              </div>
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">E-mail</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={forgotLoading}>
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Enviar link
                </Button>
                <button
                  type="button"
                  onClick={() => setForgotMode(false)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Voltar ao login
                </button>
              </form>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-2xl font-display text-foreground">Entrar</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Primeiro acesso? Sua senha é o seu email de cadastro
                </p>
              </div>
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Entrar
                </Button>
                <button
                  type="button"
                  onClick={() => setForgotMode(true)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Esqueci minha senha
                </button>
                <a
                  href="https://pay.hub.la/EXHctuig5BkAD5oPYQUs?utm_source=login-plataforma"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Ainda não é membro? Inscreva-se aqui
                </a>
                <a
                  href="https://radar.dojovem.com.br/assine?utm_source=plataforma&utm_medium=social&utm_campaign=plataforma&utm_term=o-que-e-o-radar&utm_content=plataforma-o-que-e-o-radar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  O que é o Radar do Jovem?
                </a>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
