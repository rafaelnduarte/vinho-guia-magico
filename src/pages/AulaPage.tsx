import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import PandaPlayer from "@/components/cursos/PandaPlayer";

interface AulaData {
  id: string;
  titulo: string;
  descricao: string | null;
  duracao_segundos: number;
  panda_video_id: string | null;
  sort_order: number;
}

function sanitizarTitulo(titulo: string): string {
  return titulo.replace(/\.(mp4|mkv|avi|mov|flv|webm|m4v)$/i, "").trim();
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export default function AulaPage() {
  const { cursoId, aulaId } = useParams<{ cursoId: string; aulaId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [aula, setAula] = useState<AulaData | null>(null);
  const [prevAulaId, setPrevAulaId] = useState<string | null>(null);
  const [nextAulaId, setNextAulaId] = useState<string | null>(null);
  const [startAt, setStartAt] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const lastSaveRef = useRef(0);

  // Fetch aula data + progress + siblings
  useEffect(() => {
    if (!cursoId || !aulaId || !user?.id) return;
    setLoading(true);
    setCompleted(false);
    setCurrentTime(0);
    setDuration(0);
    setPrevAulaId(null);
    setNextAulaId(null);
    lastSaveRef.current = 0;

    const fetchAll = async () => {
      const [aulaRes, siblingsRes, progressoRes] = await Promise.all([
        supabase
          .from("aulas")
          .select("id, titulo, descricao, duracao_segundos, panda_video_id, sort_order")
          .eq("id", aulaId)
          .maybeSingle(),
        supabase
          .from("aulas")
          .select("id, titulo")
          .eq("curso_id", cursoId)
          .eq("is_published", true),
        supabase
          .from("progresso")
          .select("posicao_segundos, concluido")
          .eq("user_id", user.id)
          .eq("aula_id", aulaId)
          .maybeSingle(),
      ]);

      setAula(aulaRes.data as AulaData | null);
      setStartAt(progressoRes.data?.posicao_segundos ?? 0);
      setCompleted(progressoRes.data?.concluido ?? false);

      if (siblingsRes.data && aulaRes.data) {
        const siblings = (siblingsRes.data as { id: string; titulo: string }[])
          .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR', { numeric: true }));
        const idx = siblings.findIndex((s) => s.id === aulaId);
        console.log('[NAV] Siblings ordenados:', siblings.map(s => s.titulo));
        console.log('[NAV] Aula atual:', aulaId, 'Index:', idx);
        if (idx > 0) console.log('[NAV] Anterior:', siblings[idx - 1].titulo);
        if (idx < siblings.length - 1) console.log('[NAV] Próxima:', siblings[idx + 1].titulo);
        setPrevAulaId(idx > 0 ? siblings[idx - 1].id : null);
        setNextAulaId(idx < siblings.length - 1 ? siblings[idx + 1].id : null);
      }

      setLoading(false);
    };

    fetchAll();
  }, [cursoId, aulaId, user?.id]);

  // Upsert progress
  const saveProgress = useCallback(
    async (seconds: number, done: boolean) => {
      if (!user?.id || !aulaId || !cursoId) return;
      await supabase.from("progresso").upsert(
        {
          user_id: user.id,
          aula_id: aulaId,
          curso_id: cursoId,
          posicao_segundos: Math.floor(seconds),
          concluido: done,
          ...(done ? { concluido_at: new Date().toISOString() } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,aula_id" }
      );
    },
    [user?.id, aulaId, cursoId]
  );

  // Save on unmount
  useEffect(() => {
    return () => {
      if (currentTime > 0) {
        saveProgress(currentTime, completed);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProgress = useCallback(
    (ct: number, dur: number) => {
      setCurrentTime(ct);
      if (dur > 0) setDuration(dur);

      // Save every 30s
      const bucket = Math.floor(ct / 30);
      if (bucket > lastSaveRef.current) {
        lastSaveRef.current = bucket;
        saveProgress(ct, false);
      }
    },
    [saveProgress]
  );

  const handleComplete = useCallback(() => {
    if (completed) return;
    setCompleted(true);
    saveProgress(duration || currentTime, true);
    toast.success("Parabéns! Aula concluída. 🎉");
  }, [completed, duration, currentTime, saveProgress]);

  const pct = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!aula) {
    return <p className="text-center py-12 text-muted-foreground">Aula não encontrada.</p>;
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Button variant="ghost" size="sm" onClick={() => navigate(`/cursos/${cursoId}`)}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao curso
      </Button>

      {/* Player */}
      {aula.panda_video_id ? (
        <PandaPlayer
          pandaVideoId={aula.panda_video_id}
          startAt={startAt}
          userId={user?.id}
          aulaId={aulaId}
          cursoId={cursoId}
          onProgress={handleProgress}
          onComplete={handleComplete}
        />
      ) : (
        <div
          className="w-full rounded-xl bg-secondary flex items-center justify-center text-muted-foreground"
          style={{ aspectRatio: "16/9" }}
        >
          Vídeo não disponível
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Assistido: {formatTime(currentTime)} / {formatTime(duration || aula.duracao_segundos)}
          </span>
          <span>{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
        {completed && (
          <div className="flex items-center gap-1.5 text-sm text-accent-foreground font-medium mt-2">
            <CheckCircle2 className="h-4 w-4 text-accent" /> Aula concluída!
          </div>
        )}
      </div>

      {/* Aula info */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-1">
        <h2 className="font-display text-lg text-foreground">{sanitizarTitulo(aula.titulo)}</h2>
        {aula.descricao && <p className="text-sm text-muted-foreground">{aula.descricao}</p>}
      </div>

      {/* Navigation */}
      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          disabled={!prevAulaId}
          onClick={() => prevAulaId && navigate(`/cursos/${cursoId}/aula/${prevAulaId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        <Button
          disabled={!nextAulaId}
          onClick={() => nextAulaId && navigate(`/cursos/${cursoId}/aula/${nextAulaId}`)}
        >
          Próxima <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
