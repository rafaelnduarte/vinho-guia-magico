import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
// Switch removed - replaced by status select
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Wine, Loader2, Link2, Upload } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import CsvImportDialog, { type CsvColumn, type CsvImportResult } from "./CsvImportDialog";
import { supabase as supabaseClient } from "@/integrations/supabase/client";

type WineRow = Tables<"wines">;

interface WineForm {
  name: string;
  producer: string;
  vintage: string;
  grape: string;
  type: string;
  country: string;
  region: string;
  importer: string;
  price_range: string;
  image_url: string;
  tasting_notes: string;
  description: string;
  rating: string;
  status: string;
}

const emptyForm: WineForm = {
  name: "", producer: "", vintage: "", grape: "", type: "Tinto",
  country: "", region: "", importer: "", price_range: "", image_url: "",
  tasting_notes: "", description: "", rating: "", status: "curadoria",
};

function wineToForm(w: WineRow): WineForm {
  return {
    name: w.name, producer: w.producer ?? "", vintage: w.vintage?.toString() ?? "",
    grape: w.grape ?? "", type: w.type ?? "Tinto", country: w.country ?? "",
    region: w.region ?? "", importer: w.importer ?? "", price_range: w.price_range ?? "",
    image_url: w.image_url ?? "", tasting_notes: w.tasting_notes ?? "",
    description: w.description ?? "", rating: w.rating?.toString() ?? "",
    status: (w as any).status ?? (w.is_published ? "curadoria" : "rascunho"),
  };
}

export default function AdminWines() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<WineForm>(emptyForm);
  const [sealDialogWineId, setSealDialogWineId] = useState<string | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);

  const wineColumns: CsvColumn[] = [
    { key: "name", label: "Nome", required: true },
    { key: "producer", label: "Produtor" },
    { key: "vintage", label: "Safra", validate: (v) => v && isNaN(Number(v)) ? "Deve ser um número" : null, transform: (v) => v ? parseInt(v) : null },
    { key: "grape", label: "Uva" },
    { key: "type", label: "Tipo", validate: (v) => v && !["Tinto","Branco","Rosé","Espumante","Sobremesa"].includes(v) ? "Tipo inválido" : null },
    { key: "country", label: "País" },
    { key: "region", label: "Região" },
    { key: "importer", label: "Importadora" },
    { key: "price_range", label: "Preço" },
    { key: "rating", label: "Nota", validate: (v) => v && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100) ? "Nota entre 0 e 100" : null, transform: (v) => v ? parseFloat(v) : null },
    { key: "image_url", label: "URL Imagem" },
    { key: "tasting_notes", label: "Notas de Degustação" },
    { key: "description", label: "Descrição" },
    { key: "status", label: "Status", validate: (v) => v && !["curadoria", "acervo", "rascunho"].includes(v) ? "Status inválido (curadoria/acervo/rascunho)" : null },
  ];

  const handleCsvImport = async (rows: Record<string, any>[]): Promise<CsvImportResult> => {
    let success = 0;
    let skipped = 0;
    const errors: CsvImportResult["errors"] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Check for existing wine by name + vintage for upsert
        const { data: existing } = await supabase
          .from("wines")
          .select("id")
          .eq("name", row.name)
          .maybeSingle();

        const payload = {
          name: row.name,
          producer: row.producer || null,
          vintage: row.vintage,
          grape: row.grape || null,
          type: row.type || "Tinto",
          country: row.country || null,
          region: row.region || null,
          importer: row.importer || null,
          price_range: row.price_range || null,
          rating: row.rating,
          image_url: row.image_url || null,
          tasting_notes: row.tasting_notes || null,
          description: row.description || null,
          status: row.status || "curadoria",
          is_published: (row.status || "curadoria") !== "rascunho",
        };

        if (existing) {
          const { error } = await supabase.from("wines").update(payload).eq("id", existing.id);
          if (error) throw error;
          skipped++;
        } else {
          const { error } = await supabase.from("wines").insert(payload);
          if (error) throw error;
          success++;
        }
      } catch (err: any) {
        errors.push({ row: i + 2, field: "geral", message: err.message });
      }
    }

    queryClient.invalidateQueries({ queryKey: ["admin-wines"] });
    return { success, errors, skipped };
  };

  const { data: wines, isLoading } = useQuery({
    queryKey: ["admin-wines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: seals } = useQuery({
    queryKey: ["admin-seals-list"],
    queryFn: async () => {
      const { data } = await supabase.from("seals").select("*").order("category");
      return data ?? [];
    },
  });

  const { data: wineSeals } = useQuery({
    queryKey: ["admin-wine-seals"],
    queryFn: async () => {
      const { data } = await supabase.from("wine_seals").select("*");
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      const payload = {
        name: form.name.trim(),
        producer: form.producer.trim() || null,
        vintage: form.vintage ? parseInt(form.vintage) : null,
        grape: form.grape.trim() || null,
        type: form.type || null,
        country: form.country.trim() || null,
        region: form.region.trim() || null,
        importer: form.importer.trim() || null,
        price_range: form.price_range.trim() || null,
        image_url: form.image_url.trim() || null,
        tasting_notes: form.tasting_notes.trim() || null,
        description: form.description.trim() || null,
        rating: form.rating ? parseFloat(form.rating) : null,
        status: form.status,
        is_published: form.status !== "rascunho",
      };
      if (editing) {
        const { error } = await supabase.from("wines").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wines").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wines"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Vinho atualizado" : "Vinho criado" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wines"] });
      toast({ title: "Vinho removido" });
    },
    onError: (e) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const toggleSealMutation = useMutation({
    mutationFn: async ({ wineId, sealId, linked }: { wineId: string; sealId: string; linked: boolean }) => {
      if (linked) {
        await supabase.from("wine_seals").delete().eq("wine_id", wineId).eq("seal_id", sealId);
      } else {
        await supabase.from("wine_seals").insert({ wine_id: wineId, seal_id: sealId });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-wine-seals"] }),
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const openEdit = (w: WineRow) => {
    setForm(wineToForm(w));
    setEditing(w.id);
    setOpen(true);
  };

  const openNew = () => {
    setForm(emptyForm);
    setEditing(null);
    setOpen(true);
  };

  const setField = (key: keyof WineForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const sealsForWine = (wineId: string) =>
    wineSeals?.filter((ws) => ws.wine_id === wineId).map((ws) => ws.seal_id) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Vinhos ({wines?.length ?? 0})</h2>
        <div className="flex gap-2">
          <Button onClick={() => setCsvOpen(true)} variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
            <Upload className="h-4 w-4" /> Importar CSV
          </Button>
          <Button onClick={openNew} size="sm" className="gap-2 text-xs sm:text-sm"><Plus className="h-4 w-4" /> Novo Vinho</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Vinho</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Tipo</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">País</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Preço</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {wines?.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {w.image_url ? (
                          <img src={w.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <Wine className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{w.name}</p>
                          <p className="text-xs text-muted-foreground">{w.producer} · {w.vintage}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{w.type}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{w.country}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{w.price_range}</td>
                    <td className="px-4 py-3">
                      <Badge variant={
                        (w as any).status === "curadoria" ? "default" :
                        (w as any).status === "acervo" ? "outline" : "secondary"
                      }>
                        {(w as any).status === "curadoria" ? "Curadoria" :
                         (w as any).status === "acervo" ? "Acervo" : "Rascunho"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setSealDialogWineId(w.id)} title="Selos">
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(w)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover este vinho?")) deleteMutation.mutate(w.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {wines?.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum vinho cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Wine Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Vinho" : "Novo Vinho"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setField("name", e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Produtor</Label>
                <Input value={form.producer} onChange={(e) => setField("producer", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Safra</Label>
                <Input type="number" value={form.vintage} onChange={(e) => setField("vintage", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Uva</Label>
                <Input value={form.grape} onChange={(e) => setField("grape", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setField("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tinto">Tinto</SelectItem>
                    <SelectItem value="Branco">Branco</SelectItem>
                    <SelectItem value="Rosé">Rosé</SelectItem>
                    <SelectItem value="Espumante">Espumante</SelectItem>
                    <SelectItem value="Sobremesa">Sobremesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>País</Label>
                <Input value={form.country} onChange={(e) => setField("country", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Região</Label>
                <Input value={form.region} onChange={(e) => setField("region", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Importadora</Label>
                <Input value={form.importer} onChange={(e) => setField("importer", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Preço</Label>
                <Input value={form.price_range} onChange={(e) => setField("price_range", e.target.value)} placeholder="R$ 179,90" />
              </div>
              <div className="space-y-1">
                <Label>Nota (0-100)</Label>
                <Input type="number" min="0" max="100" value={form.rating} onChange={(e) => setField("rating", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>URL da Imagem</Label>
                <Input value={form.image_url} onChange={(e) => setField("image_url", e.target.value)} placeholder="https://..." />
                {form.image_url && (
                  <img src={form.image_url} alt="Preview" className="mt-2 h-32 w-auto rounded object-cover border border-border" />
                )}
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Comentário do Thomas</Label>
                <Textarea value={form.tasting_notes} onChange={(e) => setField("tasting_notes", e.target.value)} rows={3} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={2} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="curadoria">Curadoria</SelectItem>
                    <SelectItem value="acervo">Acervo</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editing ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Seal Link Dialog */}
      <Dialog open={!!sealDialogWineId} onOpenChange={() => setSealDialogWineId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Vincular Selos</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {seals?.map((seal) => {
              const linked = sealDialogWineId ? sealsForWine(sealDialogWineId).includes(seal.id) : false;
              return (
                <button
                  key={seal.id}
                  onClick={() => sealDialogWineId && toggleSealMutation.mutate({ wineId: sealDialogWineId, sealId: seal.id, linked })}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors ${
                    linked ? "bg-primary/10 border-primary text-foreground" : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span>{seal.icon} {seal.name}</span>
                  <Badge variant={linked ? "default" : "outline"} className="text-xs">
                    {seal.category === "perfil_vinho" ? "Vinho" : "Bebedor"}
                  </Badge>
                </button>
              );
            })}
            {(!seals || seals.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">Cadastre selos primeiro.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CsvImportDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        title="Importar Vinhos via CSV"
        columns={wineColumns}
        onImport={handleCsvImport}
        templateFileName="vinhos-template.csv"
      />
    </div>
  );
}
