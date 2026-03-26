import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { Wine as WineIcon, Search, Loader2, ArrowUpDown, X, ThumbsUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import WineCard from "@/components/curadoria/WineCard";
import { useFilterParams } from "@/hooks/useFilterParams";
import { useAnalytics } from "@/hooks/useAnalytics";

const PAGE_SIZE = 50;

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
  const { trackFilterUsed } = useAnalytics();
  const prevFilters = useRef({ tipo: "", pais: "", ordem: "" });

  const search = get("q");
  const tab = get("aba", "curadoria");
  const typeFilter = get("tipo", "all");
  const countryFilter = get("pais", "all");
  const importerFilter = get("importadora", "all");
  const regionFilter = get("regiao", "all");
  const sealFilter = get("selo", "all");
  const sort = get("ordem", "price_asc");
  const page = getNum("page", 1);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Track filter usage
  useEffect(() => {
    if (typeFilter !== "all" && typeFilter !== prevFilters.current.tipo) {
      trackFilterUsed("tipo", typeFilter, "/curadoria");
    }
    if (countryFilter !== "all" && countryFilter !== prevFilters.current.pais) {
      trackFilterUsed("pais", countryFilter, "/curadoria");
    }
    if (sort !== "newest" && sort !== prevFilters.current.ordem) {
      trackFilterUsed("ordem", sort, "/curadoria");
    }
    prevFilters.current = { tipo: typeFilter, pais: countryFilter, ordem: sort };
  }, [typeFilter, countryFilter, sort, trackFilterUsed]);

  const { data: wines, isLoading } = useQuery({
    queryKey: ["curadoria-wines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines")
        .select("*")
        .in("status", ["curadoria", "acervo"])
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

  // Fetch like counts for all wines
  const { data: voteCounts } = useQuery({
    queryKey: ["curadoria-vote-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wine_votes")
        .select("wine_id, vote");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((v) => {
        if (v.vote === "up") {
          counts[v.wine_id] = (counts[v.wine_id] ?? 0) + 1;
        }
      });
      return counts;
    },
  });

  // Fetch comment counts for all wines
  const { data: commentCounts } = useQuery({
    queryKey: ["curadoria-comment-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wine_comments")
        .select("wine_id");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((c) => {
        counts[c.wine_id] = (counts[c.wine_id] ?? 0) + 1;
      });
      return counts;
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
  const allImporters = useMemo(
    () => [...new Set(wines?.map((w) => w.importer).filter(Boolean) ?? [])].sort(),
    [wines]
  );
  const allRegions = useMemo(
    () => [...new Set(wines?.map((w) => w.region).filter(Boolean) ?? [])].sort(),
    [wines]
  );

  // Build seal options from wineSealsData
  const allSeals = useMemo(() => {
    if (!wineSealsData) return [];
    const map = new Map<string, string>();
    wineSealsData.forEach((ws) => {
      const seal = ws.seals as any;
      if (seal?.name && seal?.icon) {
        map.set(seal.icon, seal.name);
      }
    });
    return Array.from(map.entries()).map(([icon, name]) => ({ icon, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [wineSealsData]);

  const curadoriaCount = useMemo(() => (wines ?? []).filter(w => (w as any).status === "curadoria").length, [wines]);
  const acervoCount = useMemo(() => (wines ?? []).filter(w => (w as any).status === "acervo").length, [wines]);

  const filtered = useMemo(() => {
    let result = (wines ?? []).filter((w) => {
      const matchTab = (w as any).status === tab;
      const s = search.toLowerCase();
      const matchSearch =
        !search ||
        w.name.toLowerCase().includes(s) ||
        w.producer?.toLowerCase().includes(s) ||
        w.grape?.toLowerCase().includes(s);
      const matchType = typeFilter === "all" || w.type === typeFilter;
      const matchCountry = countryFilter === "all" || w.country === countryFilter;
      const matchImporter = importerFilter === "all" || w.importer === importerFilter;
      const matchRegion = regionFilter === "all" || w.region === regionFilter;
      const matchSeal = sealFilter === "all" || (() => {
        const entries = wineSealsData?.filter((ws) => ws.wine_id === w.id) ?? [];
        return entries.some((e) => (e.seals as any)?.icon === sealFilter);
      })();
      return matchTab && matchSearch && matchType && matchCountry && matchImporter && matchRegion && matchSeal;
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
        case "price_asc": {
          const pa = parsePrice(a.price_range);
          const pb = parsePrice(b.price_range);
          // No price → end of list (highest)
          if (pa === null && pb === null) return 0;
          if (pa === null) return 1;
          if (pb === null) return -1;
          return pa - pb;
        }
        case "price_desc": {
          const pa = parsePrice(a.price_range);
          const pb = parsePrice(b.price_range);
          // No price → beginning of list (shown first)
          if (pa === null && pb === null) return 0;
          if (pa === null) return -1;
          if (pb === null) return 1;
          return pb - pa;
        }
        default: // newest
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [wines, search, tab, typeFilter, countryFilter, importerFilter, regionFilter, sealFilter, sort, wineSealsData]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, tab, typeFilter, countryFilter, importerFilter, regionFilter, sealFilter, sort]);

  const paginated = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, filtered.length]);

  const hasActiveFilters = search || typeFilter !== "all" || countryFilter !== "all" || importerFilter !== "all" || regionFilter !== "all" || sealFilter !== "all";

  const getSealsForWine = (wineId: string) => {
    const entries = wineSealsData?.filter((ws) => ws.wine_id === wineId) ?? [];
    const wineType = entries.find((e) => (e.seals as any)?.category === "perfil_vinho");
    const clienteType = entries.find((e) => (e.seals as any)?.category === "perfil_cliente");
    return {
      seal_wine_type: wineType ? (wineType.seals as any)?.icon ?? "" : "",
      seal_drinker_type: clienteType ? (clienteType.seals as any)?.icon ?? "" : "",
    };
  };

  return (
    <div className="animate-fade-in px-4 sm:px-6 py-6 sm:py-10 max-w-7xl mx-auto overflow-x-hidden">
      <div className="flex items-center gap-3 mb-2">
        <WineIcon className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-sans font-bold text-foreground">Curadoria</h1>
      </div>
      <p className="text-sm sm:text-base text-muted-foreground mb-4">
        Explore os vinhos selecionados pelo Radar do Jovem.
      </p>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => set({ aba: v === "curadoria" ? null : v })} className="mb-4">
        <TabsList>
          <TabsTrigger value="curadoria">Curadoria ({curadoriaCount})</TabsTrigger>
          <TabsTrigger value="acervo">Acervo ({acervoCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vinho, produtor ou uva..."
            value={search}
            onChange={(e) => set({ q: e.target.value })}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          <Select value={typeFilter} onValueChange={(v) => set({ tipo: v })}>
            <SelectTrigger className="w-full">
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
            <SelectTrigger className="w-full">
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
          <Select value={importerFilter} onValueChange={(v) => set({ importadora: v })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Importadora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas importadoras</SelectItem>
              {allImporters.map((i) => (
                <SelectItem key={i!} value={i!}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={(v) => set({ regiao: v })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas regiões</SelectItem>
              {allRegions.map((r) => (
                <SelectItem key={r!} value={r!}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sealFilter} onValueChange={(v) => set({ selo: v })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os selos</SelectItem>
              {allSeals.map((s) => (
                <SelectItem key={s.icon} value={s.icon}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => set({ ordem: v })}>
            <SelectTrigger className="w-full">
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
                onClick={() => set({ q: null, tipo: null, pais: null, importadora: null, regiao: null, selo: null })}
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
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
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
                  likeCount={voteCounts?.[wine.id] ?? 0}
                  commentCount={commentCounts?.[wine.id] ?? 0}
                  isArchive={tab === "acervo"}
                />
              );
            })}
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
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

function parsePrice(price: string | null): number | null {
  if (!price || !price.trim()) return null;
  // Normalize: if has comma as decimal separator, replace it
  // First remove thousands separators, then handle decimal
  let cleaned = price.replace(/[^\d.,]/g, "");
  // If format uses comma as decimal (e.g. "1376,89" or "187,56")
  if (cleaned.includes(",") && !cleaned.includes(".")) {
    cleaned = cleaned.replace(",", ".");
  } else if (cleaned.includes(",") && cleaned.includes(".")) {
    // e.g. "1.376,89" → remove dot (thousands), replace comma (decimal)
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }
  const val = parseFloat(cleaned);
  return isNaN(val) || val === 0 ? null : val;
}
