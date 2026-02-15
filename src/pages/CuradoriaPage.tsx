import { useMemo } from "react";
import { GlassWater, Search, Loader2, ArrowUpDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import WineCard from "@/components/curadoria/WineCard";
import { useFilterParams } from "@/hooks/useFilterParams";

const PAGE_SIZE = 9;

const SORT_OPTIONS = [
  { value: "newest", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "name_asc", label: "Nome A-Z" },
  { value: "name_desc", label: "Nome Z-A" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
];

export default function CuradoriaPage() {
  const { get, getNum, set } = useFilterParams();

  const search = get("q");
  const typeFilter = get("tipo", "all");
  const countryFilter = get("pais", "all");
  const sort = get("ordem", "newest");
  const page = getNum("page", 1);

  const { data: wines, isLoading } = useQuery({
    queryKey: ["curadoria-wines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: wineSealsData } = useQuery({
    queryKey: ["curadoria-wine-seals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wine_seals")
        .select("wine_id, seal_id, seals(name, category, icon)");
      return data ?? [];
    },
  });

  const allTypes = useMemo(
    () => [...new Set(wines?.map((w) => w.type).filter(Boolean) ?? [])].sort(),
    [wines]
  );
  const allCountries = useMemo(
    () => [...new Set(wines?.map((w) => w.country).filter(Boolean) ?? [])].sort(),
    [wines]
  );

  const filtered = useMemo(() => {
    let result = (wines ?? []).filter((w) => {
      const s = search.toLowerCase();
      const matchSearch =
        !search ||
        w.name.toLowerCase().includes(s) ||
        w.producer?.toLowerCase().includes(s) ||
        w.grape?.toLowerCase().includes(s);
      const matchType = typeFilter === "all" || w.type === typeFilter;
      const matchCountry = countryFilter === "all" || w.country === countryFilter;
      return matchSearch && matchType && matchCountry;
    });

    // Sort
    result = [...result].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "price_asc":
          return parsePrice(a.price_range) - parsePrice(b.price_range);
        case "price_desc":
          return parsePrice(b.price_range) - parsePrice(a.price_range);
        default: // newest
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [wines, search, typeFilter, countryFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasActiveFilters = search || typeFilter !== "all" || countryFilter !== "all";

  const getSealsForWine = (wineId: string) => {
    const entries = wineSealsData?.filter((ws) => ws.wine_id === wineId) ?? [];
    const wineType = entries.find((e) => (e.seals as any)?.category === "perfil_vinho");
    const drinkerType = entries.find((e) => (e.seals as any)?.category === "perfil_bebedor");
    return {
      seal_wine_type: wineType
        ? `${(wineType.seals as any)?.icon ?? ""} ${(wineType.seals as any)?.name}`.trim()
        : "",
      seal_drinker_type: drinkerType
        ? `${(drinkerType.seals as any)?.icon ?? ""} ${(drinkerType.seals as any)?.name}`.trim()
        : "",
    };
  };

  return (
    <div className="animate-fade-in px-6 py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <GlassWater className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-sans font-bold text-foreground">Curadoria</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Explore os vinhos selecionados pelo Radar do Jovem.
      </p>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-2">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar vinho, produtor ou uva..."
              value={search}
              onChange={(e) => set({ q: e.target.value })}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => set({ tipo: v })}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {allTypes.map((t) => (
                <SelectItem key={t!} value={t!}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={countryFilter} onValueChange={(v) => set({ pais: v })}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="País" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os países</SelectItem>
              {allCountries.map((c) => (
                <SelectItem key={c!} value={c!}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => set({ ordem: v })}>
            <SelectTrigger className="w-full sm:w-48">
              <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active filters summary */}
        <div className="flex items-center gap-2 min-h-[28px]">
          {hasActiveFilters && (
            <>
              <span className="text-xs text-muted-foreground">
                {filtered.length} vinho{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => set({ q: null, tipo: null, pais: null })}
              >
                <X className="h-3 w-3" /> Limpar filtros
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paginated.length > 0 ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.map((wine) => {
              const seals = getSealsForWine(wine.id);
              return (
                <WineCard
                  key={wine.id}
                  wine={{
                    id: wine.id,
                    name: wine.name,
                    producer: wine.producer ?? "",
                    vintage: wine.vintage ?? 0,
                    grape: wine.grape ?? "",
                    type: wine.type ?? "",
                    country: wine.country ?? "",
                    importer: wine.importer ?? "",
                    price: wine.price_range ?? "",
                    image_url: wine.image_url ?? "",
                    tasting_notes: wine.tasting_notes ?? "",
                    seal_wine_type: seals.seal_wine_type,
                    seal_drinker_type: seals.seal_drinker_type,
                  }}
                />
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => set({ page: safePage - 1 })}
              >
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={p === safePage ? "default" : "ghost"}
                    size="sm"
                    className="w-9 h-9"
                    onClick={() => set({ page: p })}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => set({ page: safePage + 1 })}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          Nenhum vinho encontrado com os filtros selecionados.
        </div>
      )}
    </div>
  );
}

function parsePrice(price: string | null): number {
  if (!price) return 0;
  const cleaned = price.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}
