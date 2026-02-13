import { GlassWater } from "lucide-react";

export default function CuradoriaPage() {
  return (
    <div className="animate-fade-in px-6 py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <GlassWater className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-display text-foreground">Curadoria</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        Explore os vinhos selecionados pelo Radar do Jovem. Use os filtros para encontrar o rótulo ideal.
      </p>
      <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
        Em breve: catálogo completo com filtros e detalhes.
      </div>
    </div>
  );
}
