import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Aula {
  id: string;
  titulo: string;
  descricao: string | null;
  duracao_segundos: number;
  sort_order: number;
  thumbnail_url: string | null;
  concluido: boolean;
}

function sanitizarTitulo(titulo: string): string {
  return titulo.replace(/\.(mp4|mkv|avi|mov|flv|webm|m4v)$/i, "").trim();
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function CursoDetailPage() {
  const { cursoId } = useParams<{ cursoId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cursoTitle, setCursoTitle] = useState("");
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cursoId || !user?.id) return;

    const fetch = async () => {
      const [cursoRes, aulasRes, progressoRes] = await Promise.all([
        supabase.from("cursos").select("titulo").eq("id", cursoId).maybeSingle(),
        supabase
          .from("aulas")
          .select("id, titulo, descricao, duracao_segundos, sort_order, thumbnail_url")
          .eq("curso_id", cursoId)
          .eq("is_published", true)
          .order("titulo", { ascending: true }),
        supabase
          .from("progresso")
          .select("aula_id, concluido")
          .eq("user_id", user.id)
          .eq("curso_id", cursoId),
      ]);

      setCursoTitle(cursoRes.data?.titulo ?? "");
      const completedSet = new Set(
        (progressoRes.data ?? []).filter((p) => p.concluido).map((p) => p.aula_id)
      );

      setAulas(
        (aulasRes.data ?? [])
          .map((a) => ({
            ...a,
            concluido: completedSet.has(a.id),
          }))
          .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR', { numeric: true }))
      );
      setLoading(false);
    };

    fetch();
  }, [cursoId, user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cursos")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl text-foreground">{cursoTitle}</h1>
      </div>

      {aulas.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhuma aula publicada neste curso.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {aulas.map((aula) => (
            <button
              key={aula.id}
              onClick={() => navigate(`/cursos/${cursoId}/aula/${aula.id}`)}
              className="rounded-lg border border-border overflow-hidden hover:border-accent/40 hover:shadow-sm transition-all text-left"
            >
              <div
                className="relative aspect-video bg-muted bg-cover bg-center"
                style={aula.thumbnail_url ? { backgroundImage: `url(${aula.thumbnail_url})` } : undefined}
              >
                {aula.concluido && (
                  <div className="absolute top-2 right-2 bg-accent rounded-full p-0.5">
                    <CheckCircle2 className="h-4 w-4 text-accent-foreground" />
                  </div>
                )}
              </div>
              <div className="p-3 space-y-1 bg-card">
                <p className="font-medium text-sm text-foreground line-clamp-2">{sanitizarTitulo(aula.titulo)}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(aula.duracao_segundos)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
