import { Handshake } from "lucide-react";

export default function ParceirosPage() {
  return (
    <div className="animate-fade-in px-6 py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Handshake className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-display text-foreground">Parceiros</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        Parceiros com condições exclusivas para membros do Radar.
      </p>
      <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
        Em breve: grid de parceiros com códigos e condições.
      </div>
    </div>
  );
}
