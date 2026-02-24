import { Wine, Handshake, Award } from "lucide-react";
import logoJovem from "@/assets/logo-jovem-do-vinho.png";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const shortcuts = [
  {
    to: "/curadoria",
    icon: Wine,
    title: "Curadoria",
    desc: "Vinhos selecionados pelo Radar do Jovem",
  },
  {
    to: "/parceiros",
    icon: Handshake,
    title: "Parceiros",
    desc: "Condições exclusivas para membros",
  },
  {
    to: "/selos",
    icon: Award,
    title: "Selos",
    desc: "Entenda os perfis de cada vinho",
  },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function HomePage() {
  const { user } = useAuth();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [membershipType, setMembershipType] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const fetchData = async () => {
      const [profileRes, membershipRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
        supabase.from("memberships").select("membership_type").eq("user_id", user.id).eq("status", "active").maybeSingle(),
      ]);
      setProfileName(profileRes.data?.full_name ?? null);
      setMembershipType(membershipRes.data?.membership_type ?? "comunidade");
    };
    fetchData();
  }, [user?.id]);

  const firstName = profileName?.split(" ")[0] || user?.email?.split("@")[0] || "";

  const badgeLabel =
    membershipType === "radar" ? "Radar" :
    membershipType === "admin" ? "Admin" :
    "Comunidade";

  return (
    <div className="animate-fade-in">
      {/* Greeting Banner */}
      <section className="px-4 sm:px-6 pt-6 pb-2 max-w-5xl mx-auto">
        <div className="rounded-xl bg-gradient-to-r from-accent to-accent/70 px-5 py-3 flex items-center gap-3">
          <span className="text-accent-foreground font-medium text-base sm:text-lg">
            {getGreeting()}, <strong>{firstName}</strong>
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent-foreground/10 border border-accent-foreground/20 px-3 py-1 text-xs font-bold text-accent-foreground uppercase tracking-wide">
            {badgeLabel}
          </span>
        </div>
      </section>

      {/* Hero */}
      <section className="px-4 sm:px-6 py-10 md:py-20 max-w-4xl mx-auto text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src={logoJovem} alt="Jovem do Vinho" className="h-14 w-14 sm:h-16 sm:w-16" />
          <h1 className="text-3xl md:text-5xl font-display text-foreground">
            Radar do Jovem
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed font-bold">
          Bem-vindo ao Radar: sua curadoria de vinhos para beber melhor, com menos dúvida. Você tem seleções criteriosas, vantagens com parceiros e selos que resumem o estilo e o momento ideal de cada garrafa.
        </p>
      </section>

      {/* Shortcuts */}
      <section className="px-4 sm:px-6 pb-12 sm:pb-16 max-w-5xl mx-auto">
        <div className="grid gap-6 sm:grid-cols-3">
          {shortcuts.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="group rounded-xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              <s.icon className="h-8 w-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="font-display text-lg text-foreground mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="px-4 sm:px-6 pb-12 sm:pb-16 max-w-3xl mx-auto">
        <div className="rounded-xl bg-card border border-border p-8">
          <h2 className="font-display text-2xl text-foreground mb-4">Como usar o Radar</h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">Curadoria:</strong> Navegue pelo catálogo de vinhos,
              filtre por país, tipo, safra ou importadora. Cada vinho possui selos que indicam
              perfil de sabor e estilo de bebedor.
            </p>
            <p>
              <strong className="text-foreground">Parceiros:</strong> Aproveite códigos exclusivos e
              condições especiais nas melhores importadoras e lojas.
            </p>
            <p>
              <strong className="text-foreground">Selos:</strong> Entenda o sistema de classificação
              para escolher vinhos alinhados ao seu paladar.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
