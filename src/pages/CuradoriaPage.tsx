import { useState } from "react";
import { GlassWater, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
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

export default function CuradoriaPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");

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
      const { data } = await supabase.from("wine_seals").select("wine_id, seal_id, seals(name, category, icon)");
      return data ?? [];
    },
  });

  const allTypes = [...new Set(wines?.map((w) => w.type).filter(Boolean) ?? [])];
  const allCountries = [...new Set(wines?.map((w) => w.country).filter(Boolean) ?? [])];

  const filtered = (wines ?? []).filter((w) => {
    const s = search.toLowerCase();
    const matchSearch =
      !search ||
      w.name.toLowerCase().includes(s) ||
      (w.producer?.toLowerCase().includes(s)) ||
      (w.grape?.toLowerCase().includes(s));
    const matchType = typeFilter === "all" || w.type === typeFilter;
    const matchCountry = countryFilter === "all" || w.country === countryFilter;
    return matchSearch && matchType && matchCountry;
  });

  // Build seal labels per wine
  const getSealsForWine = (wineId: string) => {
    const entries = wineSealsData?.filter((ws) => ws.wine_id === wineId) ?? [];
    const wineType = entries.find((e) => (e.seals as any)?.category === "perfil_vinho");
    const drinkerType = entries.find((e) => (e.seals as any)?.category === "perfil_bebedor");
    return {
      seal_wine_type: wineType ? `${(wineType.seals as any)?.icon ?? ""} ${(wineType.seals as any)?.name}`.trim() : "",
      seal_drinker_type: drinkerType ? `${(drinkerType.seals as any)?.icon ?? ""} ${(drinkerType.seals as any)?.name}`.trim() : "",
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
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vinho, produtor ou uva..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {allTypes.map((t) => (
              <SelectItem key={t!} value={t!}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="País" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os países</SelectItem>
            {allCountries.map((c) => (
              <SelectItem key={c!} value={c!}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((wine) => {
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
      ) : (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          Nenhum vinho encontrado com os filtros selecionados.
        </div>
      )}
    </div>
  );
}
