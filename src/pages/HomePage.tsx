import { useEffect, useState, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Wine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import WineCard from "@/components/curadoria/WineCard";
import type { MockWine } from "@/components/curadoria/WineCard";

interface Banner {
  id: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
}

function CarouselArrows({ onPrev, onNext, canPrev, canNext }: { onPrev: () => void; onNext: () => void; canPrev: boolean; canNext: boolean }) {
  return (
    <>
      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur rounded-full p-1.5 shadow-md border border-border disabled:opacity-30 transition-opacity"
        aria-label="Anterior"
      >
        <ChevronLeft className="h-5 w-5 text-foreground" />
      </button>
      <button
        onClick={onNext}
        disabled={!canNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur rounded-full p-1.5 shadow-md border border-border disabled:opacity-30 transition-opacity"
        aria-label="Próximo"
      >
        <ChevronRight className="h-5 w-5 text-foreground" />
      </button>
    </>
  );
}

function useCarouselNav(emblaApi: ReturnType<typeof useEmblaCarousel>[1]) {
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  return {
    canPrev,
    canNext,
    scrollPrev: () => emblaApi?.scrollPrev(),
    scrollNext: () => emblaApi?.scrollNext(),
  };
}

export default function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [wines, setWines] = useState<MockWine[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const [bannerRef, bannerApi] = useEmblaCarousel({
    align: "start",
    slidesToScroll: 1,
    breakpoints: {
      "(min-width: 768px)": { slidesToScroll: 3 },
    },
  });

  const [wineRef, wineApi] = useEmblaCarousel({
    align: "start",
    slidesToScroll: 1,
    breakpoints: {
      "(min-width: 768px)": { slidesToScroll: 3 },
    },
  });

  const bannerNav = useCarouselNav(bannerApi);
  const wineNav = useCarouselNav(wineApi);

  useEffect(() => {
    async function load() {
      const [bannersRes, winesRes] = await Promise.all([
        supabase
          .from("home_banners")
          .select("id, image_url, link_url, sort_order")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("wines")
          .select("id, name, producer, vintage, grape, type, country, importer, price_range, image_url, tasting_notes, status")
          .eq("status", "curadoria")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (bannersRes.data) setBanners(bannersRes.data);

      if (winesRes.data) {
        const ids = winesRes.data.map((w) => w.id);

        // Fetch seals for these wines
        const { data: wineSeals } = await supabase
          .from("wine_seals")
          .select("wine_id, seal_id, seals(name, category)")
          .in("wine_id", ids);

        const sealMap: Record<string, { wine_type: string; drinker_type: string }> = {};
        wineSeals?.forEach((ws: any) => {
          if (!sealMap[ws.wine_id]) sealMap[ws.wine_id] = { wine_type: "", drinker_type: "" };
          if (ws.seals?.category === "tipo_vinho") sealMap[ws.wine_id].wine_type = ws.seals.name;
          if (ws.seals?.category === "tipo_bebedor") sealMap[ws.wine_id].drinker_type = ws.seals.name;
        });

        // Fetch vote/comment counts
        const { data: votes } = await supabase.from("wine_votes").select("wine_id").in("wine_id", ids);
        const { data: comments } = await supabase.from("wine_comments").select("wine_id").in("wine_id", ids);

        const vc: Record<string, number> = {};
        votes?.forEach((v) => { vc[v.wine_id] = (vc[v.wine_id] || 0) + 1; });
        setVoteCounts(vc);

        const cc: Record<string, number> = {};
        comments?.forEach((c) => { cc[c.wine_id] = (cc[c.wine_id] || 0) + 1; });
        setCommentCounts(cc);

        setWines(
          winesRes.data.map((w) => ({
            id: w.id,
            name: w.name,
            producer: w.producer || "",
            vintage: w.vintage || 0,
            grape: w.grape || "",
            type: w.type || "",
            country: w.country || "",
            importer: w.importer || "",
            price: w.price_range || "",
            image_url: w.image_url || "",
            tasting_notes: w.tasting_notes || "",
            seal_wine_type: sealMap[w.id]?.wine_type || "",
            seal_drinker_type: sealMap[w.id]?.drinker_type || "",
          }))
        );
      }
    }
    load();
  }, []);

  return (
    <div className="animate-fade-in py-6 sm:py-10 space-y-8 sm:space-y-12 max-w-7xl mx-auto">
      {/* Linha 1 — Banners */}
      {banners.length > 0 && (
        <section className="px-4 sm:px-6 relative">
          <div className="overflow-hidden" ref={bannerRef}>
            <div className="flex gap-4">
              {banners.map((b) => {
                const img = (
                  <img
                    key={b.id}
                    src={b.image_url}
                    alt="Banner"
                    className="rounded-xl object-cover w-full aspect-[12/5]"
                    loading="lazy"
                  />
                );
                return (
                  <div key={b.id} className="flex-[0_0_100%] md:flex-[0_0_calc(33.333%-11px)]">
                    {b.link_url ? (
                      <a href={b.link_url} target="_blank" rel="noopener noreferrer">
                        {img}
                      </a>
                    ) : (
                      img
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {banners.length > 3 && (
            <CarouselArrows
              onPrev={() => bannerNav.scrollPrev()}
              onNext={() => bannerNav.scrollNext()}
              canPrev={bannerNav.canPrev}
              canNext={bannerNav.canNext}
            />
          )}
        </section>
      )}

      {/* Linha 2 — Vinhos Recentes */}
      {wines.length > 0 && (
        <section className="px-4 sm:px-6 relative">
          <h2 className="font-display text-xl sm:text-2xl text-foreground mb-4 sm:mb-6">
            Últimas adições
          </h2>
          <div className="overflow-hidden" ref={wineRef}>
            <div className="flex gap-4">
              {wines.map((w) => (
                <div key={w.id} className="flex-[0_0_100%] md:flex-[0_0_calc(33.333%-11px)]">
                  <WineCard
                    wine={w}
                    likeCount={voteCounts[w.id] || 0}
                    commentCount={commentCounts[w.id] || 0}
                  />
                </div>
              ))}
            </div>
          </div>
          {wines.length > 3 && (
            <CarouselArrows
              onPrev={() => wineNav.scrollPrev()}
              onNext={() => wineNav.scrollNext()}
              canPrev={wineNav.canPrev}
              canNext={wineNav.canNext}
            />
          )}
        </section>
      )}
    </div>
  );
}
