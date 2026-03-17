import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, BookOpen, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CursoCard {
  id: string;
  titulo: string;
  descricao: string | null;
  nivel: string;
  capa_url: string | null;
  totalAulas: number;
  completedAulas: number;
}

interface TrilhaGroup {
  id: string;
  titulo: string;
  cursos: CursoCard[];
}

export default function CursosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trilhas, setTrilhas] = useState<TrilhaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasGdb, setHasGdb] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      // Fetch GDB status
      const { data: membershipData } = await supabase
        .from("memberships")
        .select("gdb")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      setHasGdb(membershipData?.gdb ?? false);

      // 1. Fetch published trilhas ordered by sort_order
      const { data: trilhasData } = await supabase
        .from("trilhas")
        .select("id, titulo")
        .eq("is_published", true)
        .order("sort_order", { ascending: true });

      if (!trilhasData || trilhasData.length === 0) {
        setTrilhas([]);
        setLoading(false);
        return;
      }

      const trilhaIds = trilhasData.map((t) => t.id);

      // 2. Fetch trilha_cursos ordered by sort_order
      const { data: tcData } = await supabase
        .from("trilha_cursos")
        .select("trilha_id, curso_id, sort_order")
        .in("trilha_id", trilhaIds)
        .order("sort_order", { ascending: true });

      if (!tcData || tcData.length === 0) {
        setTrilhas([]);
        setLoading(false);
        return;
      }

      const cursoIds = [...new Set(tcData.map((tc) => tc.curso_id))];

      // 3. Fetch published cursos that are linked to trilhas
      const { data: cursosData } = await supabase
        .from("cursos")
        .select("id, titulo, descricao, nivel, capa_url")
        .eq("is_published", true)
        .in("id", cursoIds);

      if (!cursosData) {
        setTrilhas([]);
        setLoading(false);
        return;
      }

      const cursosMap = new Map(cursosData.map((c) => [c.id, c]));

      // 4. Fetch aulas + progresso for progress calculation
      const publishedCursoIds = cursosData.map((c) => c.id);

      const [aulasRes, progressoRes] = await Promise.all([
        supabase
          .from("aulas")
          .select("id, curso_id")
          .eq("is_published", true)
          .in("curso_id", publishedCursoIds),
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

      // 5. Build trilha groups
      const groups: TrilhaGroup[] = trilhasData
        .map((t) => {
          const tcForTrilha = tcData
            .filter((tc) => tc.trilha_id === t.id)
            .sort((a, b) => a.sort_order - b.sort_order);

          const cursos: CursoCard[] = tcForTrilha
            .map((tc) => {
              const c = cursosMap.get(tc.curso_id);
              if (!c) return null;
              const aulaIds = aulasPerCurso[c.id] ?? [];
              return {
                ...c,
                totalAulas: aulaIds.length,
                completedAulas: aulaIds.filter((id) => completedSet.has(id)).length,
              };
            })
            .filter(Boolean) as CursoCard[];

          return { id: t.id, titulo: t.titulo, cursos };
        })
        .filter((g) => g.cursos.length > 0);

      setTrilhas(groups);
      setLoading(false);
    };

    fetchData();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-accent" />
        <h1 className="font-display text-2xl text-foreground">Cursos</h1>
      </div>

      {trilhas.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum curso disponível no momento.</p>
      ) : (
        trilhas.map((trilha) => (
          <section key={trilha.id} className="space-y-3">
            <h2 className="font-display text-lg text-foreground border-b border-border pb-2">{trilha.titulo}</h2>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {trilha.cursos.map((curso) => {
                const pct = curso.totalAulas > 0 ? Math.round((curso.completedAulas / curso.totalAulas) * 100) : 0;
                const isGdbTrilha = trilha.titulo === "Guia Definitivo Borgonha";
                const isLocked = isGdbTrilha && !hasGdb;
                return (
                  <button
                    key={curso.id}
                    onClick={() => {
                      if (isLocked) {
                        window.open("https://pay.hub.la/6PFtjLOp0SUVmQvr9ym1?utm_source=item-bloqueado-app", "_blank");
                      } else {
                        navigate(`/cursos/${curso.id}`);
                      }
                    }}
                    className="relative text-left rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md hover:border-accent/40 transition-all"
                    style={{
                      aspectRatio: "500 / 834",
                      backgroundColor: curso.capa_url ? undefined : "hsl(var(--muted))",
                    }}
                  >
                    {curso.capa_url && (
                      <img
                        src={curso.capa_url}
                        alt={curso.titulo}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    {!curso.capa_url && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
                      </div>
                    )}
                    {/* Lock overlay only for GDB trilha when user has no access */}
                    {isLocked && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
                        <Lock className="h-10 w-10 text-white/80 mb-2" />
                        <span className="text-xs text-white/70 font-medium">Bloqueado</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 space-y-2">
                      <h3 className="font-display text-sm text-white leading-tight line-clamp-2">{curso.titulo}</h3>
                      {curso.descricao && (
                        <p className="text-[10px] text-white/70 line-clamp-2">{curso.descricao}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-white/80">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{curso.totalAulas} aulas</span>
                        <span className="ml-auto font-medium text-white">{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}