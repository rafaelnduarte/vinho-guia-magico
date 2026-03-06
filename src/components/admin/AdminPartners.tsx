import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Upload, X, Image } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type PartnerRow = Tables<"partners">;

const CATEGORY_OPTIONS = [
  { value: "importadoras", label: "Importadoras" },
  { value: "lojas", label: "Lojas de Vinho" },
  { value: "produtores", label: "Produtores" },
  { value: "restaurantes", label: "Experiências" },
  { value: "acessorios", label: "Acessórios" },
];

interface PartnerForm {
  name: string;
  logo_url: string;
  website_url: string;
  coupon_code: string;
  discount: string;
  conditions: string;
  is_active: boolean;
  category: string;
}

const emptyForm: PartnerForm = {
  name: "", logo_url: "", website_url: "", coupon_code: "", conditions: "", is_active: true, category: "importadoras",
};

export default function AdminPartners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: partners, isLoading } = useQuery({
    queryKey: ["admin-partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const uploadLogo = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const fileName = `${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("partner-logos")
      .upload(fileName, file, { contentType: file.type, upsert: true });

    if (error) throw new Error(`Erro no upload: ${error.message}`);

    const { data: urlData } = supabase.storage
      .from("partner-logos")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem (PNG, JPG, WEBP, SVG).", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo grande demais", description: "O logo deve ter no máximo 2MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const url = await uploadLogo(file);
      setForm((f) => ({ ...f, logo_url: url }));
      setPreviewUrl(URL.createObjectURL(file));
      toast({ title: "Logo enviado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      const payload = {
        name: form.name.trim(),
        logo_url: form.logo_url.trim() || null,
        website_url: form.website_url.trim() || null,
        coupon_code: form.coupon_code.trim() || null,
        conditions: form.conditions.trim() || null,
        is_active: form.is_active,
        category: form.category,
      };
      if (editing) {
        const { error } = await supabase.from("partners").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("partners").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setPreviewUrl(null);
      toast({ title: editing ? "Parceiro atualizado" : "Parceiro criado" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
      toast({ title: "Parceiro removido" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const openEdit = (p: PartnerRow) => {
    setForm({
      name: p.name, logo_url: p.logo_url ?? "", website_url: p.website_url ?? "",
      coupon_code: p.coupon_code ?? "", conditions: p.conditions ?? "", is_active: p.is_active,
      category: p.category ?? "importadoras",
    });
    setEditing(p.id);
    setPreviewUrl(p.logo_url || null);
    setOpen(true);
  };

  const openNew = () => {
    setForm(emptyForm);
    setEditing(null);
    setPreviewUrl(null);
    setOpen(true);
  };

  const setField = (key: keyof PartnerForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const currentLogoUrl = previewUrl || form.logo_url;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Parceiros ({partners?.length ?? 0})</h2>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Parceiro
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {partners?.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {p.logo_url ? (
                    <img src={p.logo_url} alt={p.name} className="h-10 w-10 rounded object-contain bg-muted flex-shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Image className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{p.name}</p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{CATEGORY_OPTIONS.find(c => c.value === p.category)?.label ?? p.category}</Badge>
                      {p.coupon_code && <Badge variant="secondary" className="text-[10px]">{p.coupon_code}</Badge>}
                    </div>
                  </div>
                </div>
                <Badge variant={p.is_active ? "default" : "outline"} className="flex-shrink-0">{p.is_active ? "Ativo" : "Inativo"}</Badge>
              </div>
              {p.conditions && <p className="text-xs text-muted-foreground">{p.conditions}</p>}
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(p.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {partners?.length === 0 && (
            <div className="col-span-full rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
              Nenhum parceiro cadastrado.
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} required />
            </div>

            <div className="space-y-1">
              <Label>Categoria *</Label>
              <Select value={form.category} onValueChange={(v) => setField("category", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Logo upload area */}
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-start gap-3">
                {/* Preview */}
                <div className="h-20 w-20 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {currentLogoUrl ? (
                    <img src={currentLogoUrl} alt="Preview" className="h-full w-full object-contain p-1" />
                  ) : (
                    <Image className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  {/* Upload button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Enviando..." : "Enviar logo"}
                  </Button>

                  {/* Clear logo */}
                  {currentLogoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 text-destructive hover:text-destructive"
                      onClick={() => { setForm((f) => ({ ...f, logo_url: "" })); setPreviewUrl(null); }}
                    >
                      <X className="h-4 w-4" /> Remover logo
                    </Button>
                  )}

                  {/* Or paste URL */}
                  <Input
                    value={form.logo_url}
                    onChange={(e) => { setField("logo_url", e.target.value); setPreviewUrl(e.target.value || null); }}
                    placeholder="ou cole uma URL..."
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Website</Label>
              <Input value={form.website_url} onChange={(e) => setField("website_url", e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label>Cupom</Label>
              <Input value={form.coupon_code} onChange={(e) => setField("coupon_code", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Condições</Label>
              <Textarea value={form.conditions} onChange={(e) => setField("conditions", e.target.value)} rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setField("is_active", v)} id="active" />
              <Label htmlFor="active">Ativo</Label>
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
