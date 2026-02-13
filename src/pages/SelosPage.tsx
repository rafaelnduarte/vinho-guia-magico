import { Award } from "lucide-react";

export default function SelosPage() {
  return (
    <div className="animate-fade-in px-6 py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Award className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-display text-foreground">Selos do Jovem</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        Os selos ajudam você a identificar rapidamente o perfil de cada vinho e encontrar rótulos que combinam com seu paladar.
      </p>

      <div className="space-y-10">
        <section>
          <h2 className="font-display text-xl text-foreground mb-4">Perfil de Vinho</h2>
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            Em breve: selos de perfil de vinho.
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground mb-4">Perfil de Bebedor</h2>
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            Em breve: selos de perfil de bebedor.
          </div>
        </section>
      </div>
    </div>
  );
}
