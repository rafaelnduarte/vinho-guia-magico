import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, Video, CheckCircle2, Clock, Download, ArrowLeft, RefreshCw, XCircle, Loader2, Trash2, Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Curso {
  id: string;
  titulo: string;
  descricao: string | null;
  is_published: boolean;
  panda_folder_id: string | null;
  sort_order: number;
  aulas_count?: number;
  capa_url: string | null;
}

interface Aula {
  id: string;
  titulo: string;
  duracao_segundos: number;
  is_published: boolean;
  panda_video_id: string | null;
  sort_order: number;
  created_at: string;
  thumbnail_url: string | null;
  status: string;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
}

export default function AdminCursos() {
  const [selectedCurso, setSelectedCurso] = useState<Curso | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingCurso, setSyncingCurso] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [togglingAulaId, setTogglingAulaId] = useState<string | null>(null);
  const [confirmDeleteCurso, setConfirmDeleteCurso] = useState<Curso | null>(null);
  const [confirmDeleteAula, setConfirmDeleteAula] = useState<Aula | null>(null);
  const [deletingCursoId, setDeletingCursoId] = useState<string | null>(null);
  const [deletingAulaId, setDeletingAulaId] = useState<string | null>(null);
  const [uploadingCapaId, setUploadingCapaId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadCursoRef = useRef<Curso | null>(null);
  const queryClient = useQueryClient();

  const { data: cursos, isLoading } = useQuery({
    queryKey: ["admin-cursos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, titulo, descricao, is_published, panda_folder_id, sort_order, created_at, capa_url")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const { data: counts } = await supabase.from("aulas").select("curso_id");
      const countMap: Record<string, number> = {};
      (counts || []).forEach((a) => { countMap[a.curso_id] = (countMap[a.curso_id] || 0) + 1; });
      const result = (data || []).map((c) => ({ ...c, aulas_count: countMap[c.id] || 0 })) as Curso[];
      return result.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true, sensitivity: "base" }));
    },
  });

  const { data: aulas, isLoading: aulasLoading } = useQuery({
    queryKey: ["admin-aulas", selectedCurso?.id],
    enabled: !!selectedCurso,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aulas")
        .select("id, titulo, duracao_segundos, is_published, panda_video_id, sort_order, created_at, thumbnail_url, status")
        .eq("curso_id", selectedCurso!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data || []) as Aula[]).sort((a, b) =>
        a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true, sensitivity: "base" })
      );
    },
  });

  async function handlePandaSync(folderId?: string) {
    if (folderId) {
      setSyncingCurso(true);
    } else {
      setSyncing(true);
    }

    toast({ title: "Sincronizando dados do Panda..." });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      const body: Record<string, any> = {};
      if (folderId) body.folder_id = folderId;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/panda-sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro na sincronização");

      if (folderId) {
        toast({ title: `${result.videos_synced} vídeos sincronizados!` });
        queryClient.invalidateQueries({ queryKey: ["admin-aulas", selectedCurso?.id] });
      } else {
        toast({ title: `${result.folders_synced} cursos e ${result.videos_synced} aulas sincronizados!` });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-cursos"] });
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
      setSyncingCurso(false);
    }
  }

  async function handleToggleCurso(curso: Curso) {
    const newValue = !curso.is_published;
    setTogglingId(curso.id);
    try {
      const { error } = await supabase.from("cursos").update({ is_published: newValue }).eq("id", curso.id);
      if (error) throw error;
      toast({
        title: newValue
          ? "Curso publicado. Todas as aulas foram publicadas."
          : "Curso despublicado. Todas as aulas foram despublicadas.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-cursos"] });
      queryClient.invalidateQueries({ queryKey: ["admin-aulas", curso.id] });
      if (selectedCurso?.id === curso.id) {
        setSelectedCurso({ ...curso, is_published: newValue });
      }
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleToggleAula(aula: Aula) {
    const newValue = !aula.is_published;
    const cursoBefore = selectedCurso?.is_published;
    setTogglingAulaId(aula.id);
    try {
      const { error } = await supabase.from("aulas").update({ is_published: newValue }).eq("id", aula.id);
      if (error) throw error;

      const { data: cursoRow } = await supabase
        .from("cursos")
        .select("is_published")
        .eq("id", selectedCurso!.id)
        .single();

      const cursoAfter = cursoRow?.is_published ?? cursoBefore;
      const cascaded = cursoAfter !== cursoBefore;

      if (newValue && cascaded) {
        toast({ title: "Aula publicada. Curso republicado automaticamente." });
      } else if (!newValue && cascaded) {
        toast({ title: "Aula despublicada. Curso despublicado automaticamente." });
      } else {
        toast({ title: newValue ? "Aula publicada!" : "Aula despublicada." });
      }

      if (selectedCurso && cursoAfter !== undefined) {
        setSelectedCurso({ ...selectedCurso, is_published: cursoAfter });
      }

      queryClient.invalidateQueries({ queryKey: ["admin-aulas", selectedCurso?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-cursos"] });
    } catch (err: any) {
      toast({ title: "Erro ao atualizar aula", description: err.message, variant: "destructive" });
    } finally {
      setTogglingAulaId(null);
    }
  }

  async function handleDeleteCurso(curso: Curso) {
    if (curso.is_published) return;
    setDeletingCursoId(curso.id);
    try {
      // Delete aulas first (explicit cascade)
      const { error: aulasError } = await supabase.from("aulas").delete().eq("curso_id", curso.id);
      if (aulasError) throw aulasError;

      const { error } = await supabase.from("cursos").delete().eq("id", curso.id);
      if (error) throw error;

      toast({ title: "Curso excluído com sucesso." });
      if (selectedCurso?.id === curso.id) setSelectedCurso(null);
      queryClient.invalidateQueries({ queryKey: ["admin-cursos"] });
    } catch (err: any) {
      toast({ title: "Erro ao excluir curso", description: err.message, variant: "destructive" });
    } finally {
      setDeletingCursoId(null);
      setConfirmDeleteCurso(null);
    }
  }

  async function handleDeleteAula(aula: Aula) {
    if (aula.is_published) return;
    setDeletingAulaId(aula.id);
    try {
      const { error } = await supabase.from("aulas").delete().eq("id", aula.id);
      if (error) throw error;

      toast({ title: "Aula excluída com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["admin-aulas", selectedCurso?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-cursos"] });
    } catch (err: any) {
      toast({ title: "Erro ao excluir aula", description: err.message, variant: "destructive" });
    } finally {
      setDeletingAulaId(null);
      setConfirmDeleteAula(null);
    }
  }

  function handleCloseModal() {
    setSelectedCurso(null);
    queryClient.invalidateQueries({ queryKey: ["admin-cursos"] });
  }

  function triggerUploadCapa(curso: Curso) {
    uploadCursoRef.current = curso;
    fileInputRef.current?.click();
  }

  async function handleCapaFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const curso = uploadCursoRef.current;
    if (!file || !curso) return;
    e.target.value = "";

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${curso.id}.${ext}`;

    setUploadingCapaId(curso.id);
    try {
      const { error: upErr } = await supabase.storage
        .from("course-covers")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("course-covers")
        .getPublicUrl(path);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from("cursos")
        .update({ capa_url: publicUrl })
        .eq("id", curso.id);
      if (dbErr) throw dbErr;

      toast({ title: "Capa atualizada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["admin-cursos"] });
    } catch (err: any) {
      toast({ title: "Erro ao enviar capa", description: err.message, variant: "destructive" });
    } finally {
      setUploadingCapaId(null);
    }
  }

  const cursoList = cursos || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">
          CURSOS {cursoList.length > 0 && `(${cursoList.length})`}
        </h2>
        <Button variant="outline" size="sm" onClick={() => handlePandaSync()} disabled={syncing}>
          <Download className="h-4 w-4 mr-1" />
          {syncing ? "Sincronizando..." : "Sincronizar Panda"}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      ) : cursoList.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum curso encontrado. Sincronize com o Panda.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cursoList.map((curso) => (
            <Card key={curso.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <FolderOpen className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{curso.titulo}</p>
                    <Badge variant="secondary" className="text-xs mt-1.5">
                      <Video className="h-3 w-3 mr-1" />
                      {curso.aulas_count} aulas
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <Switch
                      checked={curso.is_published}
                      disabled={togglingId === curso.id}
                      onCheckedChange={() => handleToggleCurso(curso)}
                    />
                    Publicado
                  </label>
                  {curso.is_published ? (
                    <Badge className="text-xs bg-green-600/20 text-green-400 border-green-600/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
                    </Badge>
                  ) : (
                    <Badge className="text-xs bg-yellow-600/20 text-yellow-400 border-yellow-600/30">
                      <Clock className="h-3 w-3 mr-1" /> Rascunho
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelectedCurso(curso)}>
                    Ver Vídeos
                  </Button>
                  {!curso.is_published && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={deletingCursoId === curso.id}
                      onClick={() => setConfirmDeleteCurso(curso)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de aulas */}
      <Dialog open={!!selectedCurso} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 w-full">
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleCloseModal}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                <DialogTitle className="truncate">{selectedCurso?.titulo}</DialogTitle>
                {aulas && (
                  <Badge variant="secondary" className="ml-1 shrink-0">{aulas.length} aulas</Badge>
                )}
              </div>
              {selectedCurso?.panda_folder_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handlePandaSync(selectedCurso.panda_folder_id!)}
                  disabled={syncingCurso}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${syncingCurso ? "animate-spin" : ""}`} />
                  {syncingCurso ? "Sincronizando..." : "Sincronizar"}
                </Button>
              )}
              {selectedCurso && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer shrink-0">
                  <Switch
                    checked={selectedCurso.is_published}
                    disabled={togglingId === selectedCurso.id}
                    onCheckedChange={() => handleToggleCurso(selectedCurso)}
                  />
                  Publicado
                </label>
              )}
            </div>
          </DialogHeader>

          {aulasLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !aulas || aulas.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma aula neste curso.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {aulas.map((aula, idx) => (
                <div key={aula.id} className="rounded-lg border border-border overflow-hidden">
                  {/* Thumbnail */}
                  <div
                    className="aspect-video"
                    style={{
                      backgroundImage: aula.thumbnail_url
                        ? `url(${aula.thumbnail_url})`
                        : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundColor: aula.thumbnail_url ? undefined : "hsl(var(--muted))",
                    }}
                  />
                  {/* Info below card */}
                  <div className="p-3 space-y-2 bg-card">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-mono text-muted-foreground shrink-0">#{idx + 1}</span>
                      <p className="font-semibold text-sm leading-tight line-clamp-2 text-foreground">
                        {aula.titulo || "Sem título"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {aula.duracao_segundos ? (
                        <span>{formatDuration(aula.duracao_segundos)}</span>
                      ) : (
                        <span>—</span>
                      )}
                      <StatusIcon status={aula.status || "processing"} />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <Switch
                          checked={aula.is_published}
                          disabled={togglingAulaId === aula.id}
                          onCheckedChange={() => handleToggleAula(aula)}
                        />
                        <span>Publicado</span>
                      </label>
                      {!aula.is_published && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          disabled={deletingAulaId === aula.id}
                          onClick={() => setConfirmDeleteAula(aula)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação excluir curso */}
      <AlertDialog open={!!confirmDeleteCurso} onOpenChange={(open) => { if (!open) setConfirmDeleteCurso(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir curso?</AlertDialogTitle>
            <AlertDialogDescription>
              O curso <strong>"{confirmDeleteCurso?.titulo}"</strong> e todas as suas aulas serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingCursoId === confirmDeleteCurso?.id}
              onClick={() => confirmDeleteCurso && handleDeleteCurso(confirmDeleteCurso)}
            >
              {deletingCursoId ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação excluir aula */}
      <AlertDialog open={!!confirmDeleteAula} onOpenChange={(open) => { if (!open) setConfirmDeleteAula(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aula?</AlertDialogTitle>
            <AlertDialogDescription>
              A aula <strong>"{confirmDeleteAula?.titulo}"</strong> será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingAulaId === confirmDeleteAula?.id}
              onClick={() => confirmDeleteAula && handleDeleteAula(confirmDeleteAula)}
            >
              {deletingAulaId ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
