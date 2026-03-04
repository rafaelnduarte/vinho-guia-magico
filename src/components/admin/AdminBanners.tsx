import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";

interface Banner {
  id: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState("");

  async function fetchBanners() {
    const { data, error } = await supabase
      .from("home_banners")
      .select("*")
      .order("sort_order");
    if (error) {
      toast.error("Erro ao carregar banners");
    } else {
      setBanners(data || []);
    }
    setLoading(false);
  }

  useEffect(() => { fetchBanners(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `banners/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("wine-images")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro no upload: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("wine-images").getPublicUrl(path);
    const maxOrder = banners.length > 0 ? Math.max(...banners.map(b => b.sort_order)) + 1 : 0;

    const { error: insertError } = await supabase.from("home_banners").insert({
      image_url: urlData.publicUrl,
      link_url: newLinkUrl || null,
      sort_order: maxOrder,
    });

    if (insertError) {
      toast.error("Erro ao salvar banner");
    } else {
      toast.success("Banner adicionado!");
      setNewLinkUrl("");
      fetchBanners();
    }
    setUploading(false);
    e.target.value = "";
  }

  async function toggleActive(id: string, current: boolean) {
    const { error } = await supabase.from("home_banners").update({ is_active: !current }).eq("id", id);
    if (error) toast.error("Erro ao atualizar");
    else fetchBanners();
  }

  async function deleteBanner(id: string) {
    const { error } = await supabase.from("home_banners").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Banner excluído");
      fetchBanners();
    }
  }

  async function moveBanner(id: string, direction: "up" | "down") {
    const idx = banners.findIndex(b => b.id === id);
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === banners.length - 1)) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const a = banners[idx];
    const b = banners[swapIdx];

    await Promise.all([
      supabase.from("home_banners").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("home_banners").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    fetchBanners();
  }

  async function updateLinkUrl(id: string, url: string) {
    const { error } = await supabase.from("home_banners").update({ link_url: url || null }).eq("id", id);
    if (error) toast.error("Erro ao atualizar link");
  }

  if (loading) return <p className="text-muted-foreground text-sm">Carregando...</p>;

  return (
    <div className="space-y-6">
      {/* Add new banner */}
      <Card className="p-4 sm:p-6 space-y-4">
        <h3 className="font-semibold text-foreground">Adicionar Banner</h3>
        <p className="text-xs text-muted-foreground">
          Dimensão recomendada: <strong>1200 × 500 px</strong> (proporção 12:5). JPG ou WebP.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Link (opcional)</Label>
            <Input
              placeholder="https://..."
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
            />
          </div>
          <div>
            <Label>Imagem</Label>
            <Input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />
          </div>
        </div>
        {uploading && <p className="text-xs text-muted-foreground">Enviando...</p>}
      </Card>

      {/* Banner list */}
      <div className="space-y-3">
        {banners.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum banner cadastrado.</p>
        )}
        {banners.map((b, idx) => (
          <Card key={b.id} className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <img
              src={b.image_url}
              alt="Banner"
              className="w-full sm:w-40 aspect-[4/5] object-cover rounded-lg"
            />
            <div className="flex-1 min-w-0 space-y-1.5 w-full">
              <Input
                defaultValue={b.link_url || ""}
                placeholder="Link (opcional)"
                className="text-xs"
                onBlur={(e) => updateLinkUrl(b.id, e.target.value)}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b.id, b.is_active)} />
                  <span className="text-xs text-muted-foreground">{b.is_active ? "Ativo" : "Inativo"}</span>
                </div>
                <span className="text-xs text-muted-foreground">Ordem: {b.sort_order}</span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => moveBanner(b.id, "up")} disabled={idx === 0}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => moveBanner(b.id, "down")} disabled={idx === banners.length - 1}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteBanner(b.id)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
