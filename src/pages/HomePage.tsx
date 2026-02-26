import { Wine, Handshake, Award, Target, Trophy } from "lucide-react";
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


export default function HomePage() {
  const { user } = useAuth();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [membershipType, setMembershipType] = useState<string | null>(null);
  const [rankPosition, setRankPosition] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const fetchData = async () => {
      const [profileRes, membershipRes, rankingRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
        supabase.from("memberships").select("membership_type").eq("user_id", user.id).eq("status", "active").maybeSingle(),
        supabase.rpc("get_rankings", { period: "month" }),
      ]);
      setProfileName(profileRes.data?.full_name ?? null);
      setMembershipType(membershipRes.data?.membership_type ?? "comunidade");
      if (rankingRes.data) {
        const idx = rankingRes.data.findIndex((r: any) => r.user_id === user.id);
        setRankPosition(idx >= 0 ? idx + 1 : null);
      }
    };
    fetchData();
  }, [user?.id]);

  const firstName = profileName?.split(" ")[0] || user?.email?.split("@")[0] || "";

  const badgeLabel =
    membershipType === "radar" ? "Radar" :
    membershipType === "admin" ? "Admin" :
    "Comunidade";

  const BadgeIcon = membershipType === "radar" ? Target : Wine;

  return (
    <div className="animate-fade-in">
      {/* Greeting Banner */}
      <section className="px-4 sm:px-6 pt-6 pb-2 max-w-5xl mx-auto">
        <div className="relative overflow-hidden rounded-xl bg-secondary px-6 py-4 flex items-center justify-between shadow-lg">
          {/* Subtle gold accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-accent/20 border border-accent/40">
              <BadgeIcon className="h-5 w-5 text-accent" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-accent text-[10px] uppercase tracking-[0.2em] font-semibold">
                {badgeLabel}
              </span>
              <span className="text-secondary-foreground font-display text-lg sm:text-xl">
                {firstName}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Trophy className="h-4 w-4 text-accent" />
            <span className="text-secondary-foreground font-display text-lg sm:text-xl">
              {rankPosition != null ? `#${rankPosition}` : "-"}
            </span>
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Ranking</span>
          </div>
        </div>
      </section>

      {/* Hero */}
      <section className="px-4 sm:px-6 py-10 md:py-20 max-w-4xl mx-auto text-center">
        <h1 className="text-3xl md:text-5xl font-display text-foreground mb-6">
          Radar do Jovem
        </h1>
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
