import { GlassWater, Handshake, Award, Wine } from "lucide-react";
import { Link } from "react-router-dom";

const shortcuts = [
  {
    to: "/curadoria",
    icon: GlassWater,
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
  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="px-6 py-16 md:py-24 max-w-4xl mx-auto text-center">
        <Wine className="h-14 w-14 text-primary mx-auto mb-6" />
        <h1 className="text-3xl md:text-5xl font-display text-foreground mb-4">
          Bem-vindo ao Radar do Jovem
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          O Radar é a sua curadoria exclusiva de vinhos. Aqui você encontra seleções criteriosas,
          condições especiais com parceiros e um sistema de selos que facilita sua escolha.
        </p>
      </section>

      {/* Shortcuts */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
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
      <section className="px-6 pb-16 max-w-3xl mx-auto">
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
