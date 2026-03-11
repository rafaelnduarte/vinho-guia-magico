import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, BookOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CursoCard {
  id: string;
  titulo: string;
  descricao: string | null;
  nivel: string;
  totalAulas: number;
  completedAulas: number;
}

export default function CursosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cursos, setCursos] = useState<CursoCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchCursos = async () => {
      const { data: cursosData } = await supabase
        .from("cursos")
        .select("id, titulo, descricao, nivel")
        .eq("is_published", true)
        .order("titulo", { ascending: true });

      if (!cursosData) {
        setLoading(false);
        return;
      }

      const cursoIds = cursosData.map((c) => c.id);

      const [aulasRes, progressoRes] = await Promise.all([
        supabase
          .from("aulas")
          .select("id, curso_id")
          .eq("is_published", true)
          .in("curso_id", cursoIds),
        supabase
          .from("progresso")
          .select("aula_id, concluido")
          .eq("user_id", user.id)
          .eq("concluido", true),
      ]);

      const aulasPerCurso: Record<string, string[]> = {};
      (aulasRes.data ?? []).forEach((a) => {
        if (!aulasPerCurso[a.curso_id]) aulasPerCurso[a.curso_id] = [];
        aulasPerCurso[a.curso_id].push(a.id);
      });

      const completedSet = new Set((progressoRes.data ?? []).map((p) => p.aula_id));

      setCursos(
        cursosData.map((c) => {
          const aulaIds = aulasPerCurso[c.id] ?? [];
          return {
            ...c,
            totalAulas: aulaIds.length,
            completedAulas: aulaIds.filter((id) => completedSet.has(id)).length,
          };
        })
      );
      setLoading(false);
    };

    fetchCursos();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-accent" />
        <h1 className="font-display text-2xl text-foreground">Cursos</h1>
      </div>

      {cursos.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum curso disponível no momento.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cursos.map((curso) => {
            const pct = curso.totalAulas > 0 ? Math.round((curso.completedAulas / curso.totalAulas) * 100) : 0;
            return (
              <button
                key={curso.id}
                onClick={() => navigate(`/cursos/${curso.id}`)}
                className="text-left rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-accent/40 transition-all space-y-3"
              >
                <h2 className="font-display text-lg text-foreground leading-tight">{curso.titulo}</h2>
                {curso.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{curso.descricao}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{curso.totalAulas} aulas</span>
                  <span className="ml-auto font-medium text-accent-foreground">{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
