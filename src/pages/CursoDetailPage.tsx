import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Aula {
  id: string;
  titulo: string;
  descricao: string | null;
  duracao_segundos: number;
  sort_order: number;
  concluido: boolean;
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
          .select("id, titulo, descricao, duracao_segundos, sort_order")
          .eq("curso_id", cursoId)
          .eq("is_published", true)
          .order("sort_order"),
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
        (aulasRes.data ?? []).map((a) => ({
          ...a,
          concluido: completedSet.has(a.id),
        }))
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
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cursos")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl text-foreground">{cursoTitle}</h1>
      </div>

      {aulas.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhuma aula publicada neste curso.</p>
      ) : (
        <div className="space-y-2">
          {aulas.map((aula, i) => (
            <button
              key={aula.id}
              onClick={() => navigate(`/cursos/${cursoId}/aula/${aula.id}`)}
              className="w-full flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-accent/40 hover:shadow-sm transition-all text-left"
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-secondary text-secondary-foreground text-sm font-bold shrink-0">
                {aula.concluido ? (
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                ) : (
                  <span>{String(i + 1).padStart(2, "0")}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{aula.titulo}</p>
                {aula.descricao && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{aula.descricao}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(aula.duracao_segundos)}
              </div>
              <PlayCircle className="h-5 w-5 text-accent shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
