import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Route,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Download,
} from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Checkbox } from "@/components/ui/checkbox";

/* ─── types ─── */
interface Trilha {
  id: string;
  titulo: string;
  descricao: string | null;
  is_published: boolean;
  sort_order: number;
  capa_url: string | null;
}

interface TrilhaCurso {
  id: string;
  curso_id: string;
  sort_order: number;
  curso_titulo?: string;
  curso_capa_url?: string | null;
}

interface Curso {
  id: string;
  titulo: string;
  capa_url: string | null;
}

/* ─── component ─── */
export default function AdminTrilhas() {
  const qc = useQueryClient();

  /* state */
  const [creating, setCreating] = useState(false);
  const [newTitulo, setNewTitulo] = useState("");
  const [newDescricao, setNewDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<Trilha | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Trilha | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* add-cursos dialog */
  const [addingCursos, setAddingCursos] = useState(false);
  const [checkedCursos, setCheckedCursos] = useState<Set<string>>(new Set());
  const [savingCursos, setSavingCursos] = useState(false);

  /* ─── queries ─── */
  const { data: trilhas, isLoading } = useQuery({
    queryKey: ["admin-trilhas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trilhas")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as Trilha[];
    },
  });

  const { data: trilhaCursos, isLoading: cursosLoading } = useQuery({
    queryKey: ["admin-trilha-cursos", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trilha_cursos")
        .select("id, curso_id, sort_order")
        .eq("trilha_id", selected!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;

      // enrich with curso info
      const cursoIds = (data || []).map((tc: any) => tc.curso_id);
      if (cursoIds.length === 0) return [];

      const { data: cursos } = await supabase
        .from("cursos")
        .select("id, titulo, capa_url")
        .in("id", cursoIds);

      const cursoMap: Record<string, Curso> = {};
      (cursos || []).forEach((c: any) => { cursoMap[c.id] = c; });

      return (data || []).map((tc: any) => ({
        ...tc,
        curso_titulo: cursoMap[tc.curso_id]?.titulo || "Curso removido",
        curso_capa_url: cursoMap[tc.curso_id]?.capa_url || null,
      })) as TrilhaCurso[];
    },
  });

  const { data: allCursos } = useQuery({
    queryKey: ["admin-all-cursos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, titulo, capa_url")
        .order("titulo", { ascending: true });
      if (error) throw error;
      return (data || []) as Curso[];
    },
  });

  /* ─── handlers ─── */
  async function handleCreate() {
    if (!newTitulo.trim()) return;
    setSaving(true);
    try {
      const maxOrder = (trilhas || []).reduce((m, t) => Math.max(m, t.sort_order), -1) + 1;
      const { error } = await supabase
        .from("trilhas")
        .insert({ titulo: newTitulo.trim(), descricao: newDescricao.trim() || null, sort_order: maxOrder });
      if (error) throw error;
      toast({ title: "Trilha criada!" });
      setNewTitulo("");
      setNewDescricao("");
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["admin-trilhas"] });
    } catch (err: any) {
      toast({ title: "Erro ao criar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(trilha: Trilha) {
    setDeleting(true);
    try {
      const { error } = await supabase.from("trilhas").delete().eq("id", trilha.id);
      if (error) throw error;
      toast({ title: "Trilha excluída." });
      if (selected?.id === trilha.id) setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-trilhas"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  async function handleTogglePublish(trilha: Trilha) {
    setTogglingId(trilha.id);
    try {
      const { error } = await supabase
        .from("trilhas")
        .update({ is_published: !trilha.is_published })
        .eq("id", trilha.id);
      if (error) throw error;
      toast({ title: trilha.is_published ? "Trilha despublicada." : "Trilha publicada!" });
      qc.invalidateQueries({ queryKey: ["admin-trilhas"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  }

  /* ─── curso association ─── */
  function openAddCursos() {
    const alreadyLinked = new Set((trilhaCursos || []).map((tc) => tc.curso_id));
    setCheckedCursos(new Set());
    setAddingCursos(true);
  }

  async function handleAddCursos() {
    if (checkedCursos.size === 0 || !selected) return;
    setSavingCursos(true);
    try {
      const maxOrder = (trilhaCursos || []).reduce((m, tc) => Math.max(m, tc.sort_order), -1) + 1;
      const rows = Array.from(checkedCursos).map((curso_id, i) => ({
        trilha_id: selected.id,
        curso_id,
        sort_order: maxOrder + i,
      }));
      const { error } = await supabase.from("trilha_cursos").insert(rows);
      if (error) throw error;
      toast({ title: `${rows.length} curso(s) adicionado(s)!` });
      setAddingCursos(false);
      qc.invalidateQueries({ queryKey: ["admin-trilha-cursos", selected.id] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingCursos(false);
    }
  }

  async function handleRemoveCurso(tcId: string) {
    try {
      const { error } = await supabase.from("trilha_cursos").delete().eq("id", tcId);
      if (error) throw error;
      toast({ title: "Curso removido da trilha." });
      qc.invalidateQueries({ queryKey: ["admin-trilha-cursos", selected?.id] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  }

  async function handleMoveCurso(tcId: string, direction: "up" | "down") {
    if (!trilhaCursos) return;
    const idx = trilhaCursos.findIndex((tc) => tc.id === tcId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= trilhaCursos.length) return;

    const a = trilhaCursos[idx];
    const b = trilhaCursos[swapIdx];

    try {
      await Promise.all([
        supabase.from("trilha_cursos").update({ sort_order: b.sort_order }).eq("id", a.id),
        supabase.from("trilha_cursos").update({ sort_order: a.sort_order }).eq("id", b.id),
      ]);
      qc.invalidateQueries({ queryKey: ["admin-trilha-cursos", selected?.id] });
    } catch (err: any) {
      toast({ title: "Erro ao reordenar", description: err.message, variant: "destructive" });
    }
  }

  /* derived */
  const linkedCursoIds = new Set((trilhaCursos || []).map((tc) => tc.curso_id));
  const availableCursos = (allCursos || []).filter((c) => !linkedCursoIds.has(c.id));

  /* ─── render ─── */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">
          TRILHAS {trilhas && trilhas.length > 0 && `(${trilhas.length})`}
        </h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Trilha
        </Button>
      </div>

      {/* list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : !trilhas || trilhas.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhuma trilha cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {trilhas.map((trilha) => (
            <div
              key={trilha.id}
              className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow"
            >
              <Route className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{trilha.titulo}</p>
                {trilha.descricao && (
                  <p className="text-xs text-muted-foreground truncate">{trilha.descricao}</p>
                )}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer shrink-0">
                <Switch
                  checked={trilha.is_published}
                  disabled={togglingId === trilha.id}
                  onCheckedChange={() => handleTogglePublish(trilha)}
                />
                Publicada
              </label>
              <Badge
                variant="secondary"
                className={
                  trilha.is_published
                    ? "bg-green-600/20 text-green-400 border-green-600/30"
                    : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                }
              >
                {trilha.is_published ? "Ativa" : "Rascunho"}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setSelected(trilha)}>
                Gerenciar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              {!trilha.is_published && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(trilha)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── create dialog ─── */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Trilha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Título *</label>
              <Input value={newTitulo} onChange={(e) => setNewTitulo(e.target.value)} placeholder="Ex: Trilha Iniciante" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Descrição</label>
              <Textarea value={newDescricao} onChange={(e) => setNewDescricao(e.target.value)} placeholder="Descrição opcional..." rows={3} />
            </div>
            <Button className="w-full" disabled={!newTitulo.trim() || saving} onClick={handleCreate}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Criar Trilha
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── manage dialog ─── */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Route className="h-5 w-5 text-primary" />
              <DialogTitle className="truncate">{selected?.titulo}</DialogTitle>
              {trilhaCursos && (
                <Badge variant="secondary">{trilhaCursos.length} cursos</Badge>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={openAddCursos} disabled={availableCursos.length === 0}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Cursos
              </Button>
            </div>

            {cursosLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : !trilhaCursos || trilhaCursos.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum curso associado. Clique em "Adicionar Cursos".</p>
            ) : (
              <div className="space-y-2">
                {trilhaCursos.map((tc, idx) => (
                  <div
                    key={tc.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground w-6">#{idx + 1}</span>
                    {tc.curso_capa_url ? (
                      <div
                        className="h-10 w-7 rounded bg-cover bg-center shrink-0"
                        style={{ backgroundImage: `url(${tc.curso_capa_url})` }}
                      />
                    ) : (
                      <div className="h-10 w-7 rounded bg-muted shrink-0" />
                    )}
                    <p className="flex-1 text-sm font-medium text-foreground truncate">
                      {tc.curso_titulo}
                    </p>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={idx === 0}
                        onClick={() => handleMoveCurso(tc.id, "up")}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={idx === trilhaCursos.length - 1}
                        onClick={() => handleMoveCurso(tc.id, "down")}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveCurso(tc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── add cursos dialog ─── */}
      <Dialog open={addingCursos} onOpenChange={setAddingCursos}>
        <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Cursos à Trilha</DialogTitle>
          </DialogHeader>
          {availableCursos.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">Todos os cursos já foram adicionados.</p>
          ) : (
            <div className="space-y-2">
              {availableCursos.map((curso) => (
                <label
                  key={curso.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={checkedCursos.has(curso.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(checkedCursos);
                      if (checked) next.add(curso.id);
                      else next.delete(curso.id);
                      setCheckedCursos(next);
                    }}
                  />
                  {curso.capa_url ? (
                    <div
                      className="h-10 w-7 rounded bg-cover bg-center shrink-0"
                      style={{ backgroundImage: `url(${curso.capa_url})` }}
                    />
                  ) : (
                    <div className="h-10 w-7 rounded bg-muted shrink-0" />
                  )}
                  <span className="text-sm font-medium text-foreground truncate">{curso.titulo}</span>
                </label>
              ))}
            </div>
          )}
          <Button
            className="w-full mt-2"
            disabled={checkedCursos.size === 0 || savingCursos}
            onClick={handleAddCursos}
          >
            {savingCursos ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Adicionar {checkedCursos.size > 0 ? `(${checkedCursos.size})` : ""}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ─── delete confirm ─── */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir trilha?</AlertDialogTitle>
            <AlertDialogDescription>
              A trilha <strong>"{confirmDelete?.titulo}"</strong> e todas as associações com cursos serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
