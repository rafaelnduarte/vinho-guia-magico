import { Settings } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="animate-fade-in px-6 py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-display text-foreground">Painel Admin</h1>
      </div>
      <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
        Em breve: dashboard de métricas, CRUD e gestão de membros.
      </div>
    </div>
  );
}
