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
import { Plus, Pencil, Trash2, Wine, Loader2, Link2, Upload, Download, Search } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import CsvImportDialog, { type CsvColumn, type CsvImportResult } from "./CsvImportDialog";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { exportToCsv } from "@/lib/exportCsv";

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
  drink_or_cellar: string;
  website_url: string;
  audio_url: string;
}

const emptyForm: WineForm = {
  name: "", producer: "", vintage: "", grape: "", type: "Tinto",
  country: "", region: "", importer: "", price_range: "", image_url: "",
  tasting_notes: "", description: "", rating: "", status: "curadoria",
  drink_or_cellar: "", website_url: "", audio_url: "",
};

function wineToForm(w: WineRow): WineForm {
  return {
    name: w.name, producer: w.producer ?? "", vintage: w.vintage?.toString() ?? "",
    grape: w.grape ?? "", type: w.type ?? "Tinto", country: w.country ?? "",
    region: w.region ?? "", importer: w.importer ?? "", price_range: w.price_range ?? "",
    image_url: w.image_url ?? "", tasting_notes: w.tasting_notes ?? "",
    description: w.description ?? "", rating: w.rating?.toString() ?? "",
    status: (w as any).status ?? (w.is_published ? "curadoria" : "rascunho"),
    drink_or_cellar: (w as any).drink_or_cellar ?? "",
    website_url: (w as any).website_url ?? "",
    audio_url: (w as any).audio_url ?? "",
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
  const [wineSearch, setWineSearch] = useState("");
  const [wineTypeFilter, setWineTypeFilter] = useState("all");
  const [wineCountryFilter, setWineCountryFilter] = useState("all");
  const [wineStatusFilter, setWineStatusFilter] = useState("all");

  const wineColumns: CsvColumn[] = [
    { key: "vinho", label: "VINHO", required: true },
    { key: "vinicola", label: "VINÍCOLA" },
    { key: "uva", label: "Uva" },
    { key: "safra", label: "SAFRA", transform: (v) => { if (!v || String(v).trim() === "" || String(v).trim().toUpperCase() === "NV") return null; const n = parseInt(String(v).trim()); return isNaN(n) ? null : n; } },
    { key: "tipo", label: "TIPO" },
    { key: "preco", label: "PREÇO" },
    { key: "radar", label: "RADAR" },
    { key: "comentario", label: "COMENTÁRIO" },
    { key: "guardar_ou_beber", label: "GUARDAR OU BEBER?" },
    { key: "para_quem", label: "Para quem é este vinho?" },
    { key: "categoria_vinho", label: "Categoria Vinho" },
    { key: "volume", label: "Volume" },
    { key: "url", label: "URL" },
    { key: "importadora", label: "IMPORTADORA" },
    { key: "pais", label: "PAÍS" },
    { key: "regiao", label: "REGIÃO" },
    { key: "status", label: "STATUS", validate: (v) => v && !["curadoria", "acervo", "rascunho"].includes(v.toLowerCase()) ? "Status inválido (curadoria/acervo/rascunho)" : null },
    { key: "imagem", label: "IMAGEM" },
    { key: "audio", label: "AUDIO" },
    { key: "id_col", label: "ID" },
  ];

  // Extract Google Drive file ID from any Drive URL format
  const extractDriveFileId = (url: string): string | null => {
    const trimmed = url.trim();
    const match = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    const match2 = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2) return match2[1];
    const match3 = trimmed.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
    if (match3) return match3[1];
    return null;
  };

  // Rehost a Google Drive file to Supabase Storage via edge function
  const rehostDriveFile = async (url: string | null, bucket: string, type: "image" | "audio"): Promise<string | null> => {
    if (!url) return null;
    const fileId = extractDriveFileId(url);
    if (!fileId) return url.trim(); // Not a Drive URL, keep as-is

    // Check if already a Supabase storage URL
    if (url.includes("supabase.co/storage")) return url.trim();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rehost-drive-file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ fileId, bucket, type }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        console.error(`Rehost failed for ${fileId}:`, err);
        return null;
      }

      const { url: publicUrl } = await response.json();
      return publicUrl;
    } catch (err) {
      console.error(`Rehost error for ${fileId}:`, err);
      return null;
    }
  };

  // Lookup seal by name (case-insensitive, accent-insensitive)
  const normalizeSealName = (s: string) =>
    s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const findSealId = (name: string | null): string | null => {
    if (!name || !seals) return null;
    const normalized = normalizeSealName(name);
    const found = seals.find((s) => normalizeSealName(s.name) === normalized);
    return found?.id ?? null;
  };

  // Parse a CSV cell that may contain multiple seal names (comma, /, or ; separated)
  const parseSealNames = (value: string | null): string[] => {
    if (!value) return [];
    return value.split(/[,;/]/).map((s) => s.trim()).filter(Boolean);
  };

  const handleCsvImport = async (rows: Record<string, any>[]): Promise<CsvImportResult> => {
    let success = 0;
    let skipped = 0;
    const skippedNames: string[] = [];
    const errors: CsvImportResult["errors"] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const wineName = (row.vinho || "").trim();
      if (!wineName) {
        errors.push({ row: i + 2, field: "vinho", message: "Nome do vinho vazio" });
        continue;
      }

      try {
        // Check for duplicate by website_url (not name — same wine can appear with different links/prices)
        const rawWebsiteUrl = (row.url || "").trim();
        let existing: { id: string } | null = null;
        if (rawWebsiteUrl) {
          const { data } = await supabase
            .from("wines")
            .select("id")
            .eq("website_url", rawWebsiteUrl)
            .maybeSingle();
          existing = data;
        }

        // Normalize type from CSV — DB constraint requires lowercase
        const rawType = (row.tipo || "").trim();
        let type: string | null = null;
        if (/tinto/i.test(rawType)) type = "tinto";
        else if (/branco/i.test(rawType)) type = "branco";
        else if (/ros[eé]/i.test(rawType)) type = "rosé";
        else if (/espumante/i.test(rawType)) type = "espumante";
        else if (/sobremesa|doce/i.test(rawType)) type = "sobremesa";
        else if (/laranja/i.test(rawType)) type = "laranja";
        else if (/fortificado/i.test(rawType)) type = "fortificado";
        else if (rawType) type = rawType.toLowerCase();

        const status = (row.status || "curadoria").toLowerCase();

        // COMENTÁRIO → description (Comentário do Jovem)
        // para_quem / categoria_vinho → selos (wine_seals association)
        // Rehost Drive files to Supabase Storage
        const imageUrl = await rehostDriveFile(row.imagem, "wine-images", "image");
        const websiteUrl = row.url || null;
        const audioUrl = await rehostDriveFile(row.audio, "wine-audio", "audio");

        const payload = {
          name: wineName,
          producer: row.vinicola || null,
          vintage: row.safra ? parseInt(row.safra) : null,
          grape: row.uva || null,
          type,
          country: row.pais || null,
          region: row.regiao || null,
          importer: row.importadora || null,
          price_range: row.preco || null,
          image_url: imageUrl,
          tasting_notes: null as string | null,
          description: row.comentario || null,
          drink_or_cellar: row.guardar_ou_beber || null,
          status,
          is_published: status !== "rascunho",
          rating: null as number | null,
          website_url: websiteUrl,
          audio_url: audioUrl,
        };

        let wineId: string;

        if (existing) {
          const { error } = await supabase.from("wines").update(payload).eq("id", existing.id);
          if (error) throw error;
          wineId = existing.id;
          skipped++;
          skippedNames.push(wineName);
        } else {
          const { data: inserted, error } = await supabase.from("wines").insert(payload).select("id").single();
          if (error) throw error;
          wineId = inserted.id;
          success++;
        }

        // Associate seals (para_quem → Perfil Cliente, categoria_vinho → Perfil Vinho)
        const sealNames = [row.para_quem, row.categoria_vinho].filter(Boolean);
        if (sealNames.length > 0) {
          // Remove existing seals for this wine first to avoid duplicates
          await supabase.from("wine_seals").delete().eq("wine_id", wineId);
          const sealInserts = sealNames
            .map((name: string) => findSealId(name))
            .filter(Boolean)
            .map((sealId) => ({ wine_id: wineId, seal_id: sealId! }));
          if (sealInserts.length > 0) {
            await supabase.from("wine_seals").insert(sealInserts);
          }
        }
      } catch (err: any) {
        errors.push({ row: i + 2, field: "geral", message: err.message });
      }
    }

    queryClient.invalidateQueries({ queryKey: ["admin-wines"] });
    queryClient.invalidateQueries({ queryKey: ["admin-wine-seals"] });
    return { success, errors, skipped, skippedNames };
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

  const { data: wineVotes } = useQuery({
    queryKey: ["admin-wine-votes"],
    queryFn: async () => {
      const { data } = await supabase.from("wine_votes").select("wine_id, vote");
      return data ?? [];
    },
  });

  const { data: wineCommentCounts } = useQuery({
    queryKey: ["admin-wine-comment-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("wine_comments").select("wine_id");
      return data ?? [];
    },
  });

  const likesMap = new Map<string, number>();
  const dislikesMap = new Map<string, number>();
  (wineVotes ?? []).forEach((v) => {
    if (v.vote === "recommend") likesMap.set(v.wine_id, (likesMap.get(v.wine_id) || 0) + 1);
    else if (v.vote === "not_recommend") dislikesMap.set(v.wine_id, (dislikesMap.get(v.wine_id) || 0) + 1);
  });

  const commentsMap = new Map<string, number>();
  (wineCommentCounts ?? []).forEach((c) => {
    commentsMap.set(c.wine_id, (commentsMap.get(c.wine_id) || 0) + 1);
  });

  const sealNamesForWine = (wineId: string) => {
    const sealIds = sealsForWine(wineId);
    return sealIds.map((sid) => seals?.find((s) => s.id === sid)?.name).filter(Boolean).join(", ");
  };

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
        drink_or_cellar: form.drink_or_cellar.trim() || null,
        website_url: form.website_url.trim() || null,
        audio_url: form.audio_url.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("wines").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        // Check if a wine with the same website_url already exists — upsert if so
        const urlToCheck = payload.website_url;
        if (urlToCheck) {
          const { data: existing } = await supabase
            .from("wines")
            .select("id")
            .eq("website_url", urlToCheck)
            .maybeSingle();
          if (existing) {
            const { error } = await supabase.from("wines").update(payload).eq("id", existing.id);
            if (error) throw error;
            toast({ title: "Vinho existente atualizado", description: "Já existia um vinho com esse link. Os dados foram atualizados." });
            return "updated_existing";
          }
        }
        const { error } = await supabase.from("wines").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-wines"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      if (result !== "updated_existing") {
        toast({ title: editing ? "Vinho atualizado" : "Vinho criado" });
      }
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

  // Unique values for filters
  const allWineTypes = [...new Set(wines?.map((w) => w.type).filter(Boolean) ?? [])].sort();
  const allCountries = [...new Set(wines?.map((w) => w.country).filter(Boolean) ?? [])].sort();

  const filteredWines = (wines ?? []).filter((w) => {
    if (wineStatusFilter !== "all" && (w as any).status !== wineStatusFilter) return false;
    if (wineTypeFilter !== "all" && w.type !== wineTypeFilter) return false;
    if (wineCountryFilter !== "all" && w.country !== wineCountryFilter) return false;
    if (wineSearch) {
      const q = wineSearch.toLowerCase();
      if (!w.name.toLowerCase().includes(q) && !w.producer?.toLowerCase().includes(q) && !w.grape?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleExportWines = () => {
    const headers = ["Nome", "Produtor", "Safra", "Uva", "Tipo", "País", "Região", "Importadora", "Preço", "Status", "Likes", "Dislikes", "Comentários", "Selos"];
    const rows = filteredWines.map((w) => [
      w.name, w.producer || "", w.vintage?.toString() || "", w.grape || "",
      w.type || "", w.country || "", w.region || "", w.importer || "",
      w.price_range || "", (w as any).status || "",
      String(likesMap.get(w.id) || 0),
      String(dislikesMap.get(w.id) || 0),
      String(commentsMap.get(w.id) || 0),
      sealNamesForWine(w.id),
    ]);
    exportToCsv(`vinhos-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Vinhos ({filteredWines.length}{filteredWines.length !== (wines?.length ?? 0) ? ` / ${wines?.length}` : ""})</h2>
        <div className="flex gap-2">
          <Button onClick={handleExportWines} variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button onClick={() => setCsvOpen(true)} variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
            <Upload className="h-4 w-4" /> Importar CSV
          </Button>
          <Button onClick={openNew} size="sm" className="gap-2 text-xs sm:text-sm"><Plus className="h-4 w-4" /> Novo Vinho</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, produtor, uva..." value={wineSearch} onChange={(e) => setWineSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={wineTypeFilter} onValueChange={setWineTypeFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {allWineTypes.map((t) => <SelectItem key={t!} value={t!}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={wineCountryFilter} onValueChange={setWineCountryFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="País" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os países</SelectItem>
            {allCountries.map((c) => <SelectItem key={c!} value={c!}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={wineStatusFilter} onValueChange={setWineStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="curadoria">Curadoria</SelectItem>
            <SelectItem value="acervo">Acervo</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
          </SelectContent>
        </Select>
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
                  <th className="px-4 py-3 font-medium hidden lg:table-cell text-center">👍</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell text-center">👎</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell text-center">💬</th>
                  <th className="px-4 py-3 font-medium hidden xl:table-cell">Selos</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredWines.map((w) => (
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
                    <td className="px-4 py-3 hidden lg:table-cell text-center text-muted-foreground">{likesMap.get(w.id) || 0}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-center text-muted-foreground">{dislikesMap.get(w.id) || 0}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-center text-muted-foreground">{commentsMap.get(w.id) || 0}</td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {sealsForWine(w.id).map((sid) => {
                          const seal = seals?.find((s) => s.id === sid);
                          return seal ? <Badge key={sid} variant="outline" className="text-xs">{seal.name}</Badge> : null;
                        })}
                      </div>
                    </td>
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
                {filteredWines.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">Nenhum vinho encontrado.</td></tr>
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
                <Label>URL do Vendedor</Label>
                <Input value={form.website_url} onChange={(e) => setField("website_url", e.target.value)} placeholder="https://loja.com/vinho" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>URL do Áudio</Label>
                <Input value={form.audio_url} onChange={(e) => setField("audio_url", e.target.value)} placeholder="https://..." />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Comentário do Thomas</Label>
                <Textarea value={form.tasting_notes} onChange={(e) => setField("tasting_notes", e.target.value)} rows={3} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label>Beber ou Guardar?</Label>
                <Select value={form.drink_or_cellar || "none"} onValueChange={(v) => setField("drink_or_cellar", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="Beber">Beber</SelectItem>
                    <SelectItem value="Guardar">Guardar</SelectItem>
                    <SelectItem value="Beber ou Guardar">Beber ou Guardar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
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
