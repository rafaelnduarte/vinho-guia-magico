import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type SealRow = Tables<"seals">;

interface SealForm {
  name: string;
  category: string;
  icon: string;
  description: string;
}

const emptyForm: SealForm = { name: "", category: "perfil_vinho", icon: "", description: "" };

export default function AdminSeals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<SealForm>(emptyForm);

  const { data: seals, isLoading } = useQuery({
    queryKey: ["admin-seals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("seals").select("*").order("category").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      if (!form.category) throw new Error("Categoria é obrigatória");
      const payload = {
        name: form.name.trim(),
        category: form.category,
        icon: form.icon.trim() || null,
        description: form.description.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("seals").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("seals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seals"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Selo atualizado" : "Selo criado" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seals"] });
      toast({ title: "Selo removido" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const openEdit = (s: SealRow) => {
    setForm({ name: s.name, category: s.category, icon: s.icon ?? "", description: s.description ?? "" });
    setEditing(s.id);
    setOpen(true);
  };

  const setField = (key: keyof SealForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const wineSeals = seals?.filter((s) => s.category === "perfil_vinho") ?? [];
  const drinkerSeals = seals?.filter((s) => s.category === "perfil_bebedor") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Selos ({seals?.length ?? 0})</h2>
        <Button onClick={() => { setForm(emptyForm); setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Selo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6">
          {[{ title: "Perfil de Vinho", items: wineSeals }, { title: "Perfil de Bebedor", items: drinkerSeals }].map(({ title, items }) => (
            <div key={title}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">{title}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border bg-card p-4 flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{s.icon} {s.name}</p>
                      {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(s.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full">Nenhum selo nesta categoria.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Selo" : "Novo Selo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Categoria *</Label>
              <Select value={form.category} onValueChange={(v) => setField("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="perfil_vinho">Perfil de Vinho</SelectItem>
                  <SelectItem value="perfil_bebedor">Perfil de Bebedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ícone (emoji)</Label>
              <Input value={form.icon} onChange={(e) => setField("icon", e.target.value)} placeholder="🍷" />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={2} />
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
    </div>
  );
}
