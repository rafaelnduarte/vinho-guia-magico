import { useEffect, useState, useCallback, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Wine, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import WineCard from "@/components/curadoria/WineCard";
import type { MockWine } from "@/components/curadoria/WineCard";

interface Banner {
  id: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
}

const PLACEHOLDER_BANNERS: Banner[] = [
  { id: "p1", image_url: "", link_url: null, sort_order: 0 },
  { id: "p2", image_url: "", link_url: null, sort_order: 1 },
  { id: "p3", image_url: "", link_url: null, sort_order: 2 },
];

const PLACEHOLDER_WINES: MockWine[] = Array.from({ length: 6 }, (_, i) => ({
  id: `placeholder-${i}`,
  name: `Vinho Exemplo ${i + 1}`,
  producer: "Produtor",
  vintage: 2023,
  grape: "Uva",
  type: "Tinto",
  country: "Portugal",
  importer: "",
  price: "R$120,00",
  image_url: "",
  tasting_notes: "",
  seal_wine_type: "",
  seal_drinker_type: "",
}));

function CarouselArrows({
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <>
      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="absolute left-1 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur rounded-full p-1 shadow border border-border disabled:opacity-20 transition-opacity"
        aria-label="Anterior"
      >
        <ChevronLeft className="h-4 w-4 text-foreground" />
      </button>
      <button
        onClick={onNext}
        disabled={!canNext}
        className="absolute right-1 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur rounded-full p-1 shadow border border-border disabled:opacity-20 transition-opacity"
        aria-label="Próximo"
      >
        <ChevronRight className="h-4 w-4 text-foreground" />
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

function BannerPlaceholder() {
  return (
    <div className="rounded-lg bg-muted border border-border aspect-[4/5] flex items-center justify-center">
      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
    </div>
  );
}

export default function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [wines, setWines] = useState<MockWine[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

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
          .not("image_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (bannersRes.data) setBanners(bannersRes.data);

      if (winesRes.data && winesRes.data.length > 0) {
        const ids = winesRes.data.map((w) => w.id);

        const { data: wineSeals } = await supabase
          .from("wine_seals")
          .select("wine_id, seal_id, seals(name, category)")
          .in("wine_id", ids);

        const sealMap: Record<string, { wine_type: string; drinker_type: string }> = {};
        wineSeals?.forEach((ws: any) => {
          if (!sealMap[ws.wine_id]) sealMap[ws.wine_id] = { wine_type: "", drinker_type: "" };
          if (ws.seals?.category === "perfil_vinho") sealMap[ws.wine_id].wine_type = ws.seals.name;
          if (ws.seals?.category === "perfil_cliente") sealMap[ws.wine_id].drinker_type = ws.seals.name;
        });

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
      setLoaded(true);
    }
    load();
  }, []);

  const displayBanners = banners.length > 0 ? banners : PLACEHOLDER_BANNERS;
  const displayWines = wines.length > 0 ? wines : PLACEHOLDER_WINES;
  const isPlaceholderWines = wines.length === 0;

  return (
    <div className="animate-fade-in py-4 sm:py-6 space-y-6 sm:space-y-8 max-w-5xl mx-auto">
      {/* Linha 1 — Banners */}
      <section className="px-3 sm:px-4 relative">
        <div className="overflow-hidden" ref={bannerRef}>
          <div className="flex gap-3">
            {displayBanners.map((b) => (
              <div key={b.id} className="flex-[0_0_100%] md:flex-[0_0_calc(33.333%-8px)]">
                {b.image_url ? (
                  b.link_url ? (
                    <a href={b.link_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={b.image_url}
                        alt="Banner"
                        className="rounded-lg object-cover w-full aspect-[4/5]"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <img
                      src={b.image_url}
                      alt="Banner"
                      className="rounded-lg object-cover w-full aspect-[4/5]"
                      loading="lazy"
                    />
                  )
                ) : (
                  <BannerPlaceholder />
                )}
              </div>
            ))}
          </div>
        </div>
        {displayBanners.length > 3 && (
          <CarouselArrows
            onPrev={() => bannerNav.scrollPrev()}
            onNext={() => bannerNav.scrollNext()}
            canPrev={bannerNav.canPrev}
            canNext={bannerNav.canNext}
          />
        )}
      </section>

      {/* Linha 2 — Vinhos Recentes */}
      <section className="px-3 sm:px-4 relative">
        <h2 className="font-display text-lg sm:text-xl text-foreground mb-3 sm:mb-4">
          Novidades no Radar
        </h2>
        <div className="overflow-hidden" ref={wineRef}>
          <div className="flex gap-3">
            {displayWines.map((w) => (
              <div key={w.id} className="flex-[0_0_100%] md:flex-[0_0_calc(33.333%-8px)]">
                <div className="h-full">
                  {isPlaceholderWines ? (
                    <div className="rounded-lg border border-border bg-muted p-4 flex flex-col items-center justify-center aspect-[3/4]">
                      <Wine className="h-10 w-10 text-muted-foreground/30 mb-2" />
                      <span className="text-xs text-muted-foreground">{w.name}</span>
                    </div>
                  ) : (
                    <WineCard
                      wine={w}
                      likeCount={voteCounts[w.id] || 0}
                      commentCount={commentCounts[w.id] || 0}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {displayWines.length > 3 && (
          <CarouselArrows
            onPrev={() => wineNav.scrollPrev()}
            onNext={() => wineNav.scrollNext()}
            canPrev={wineNav.canPrev}
            canNext={wineNav.canNext}
          />
        )}
      </section>
    </div>
  );
}
