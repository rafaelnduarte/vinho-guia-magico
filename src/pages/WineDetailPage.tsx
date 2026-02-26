import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wine, Loader2, ExternalLink } from "lucide-react";
import AudioPlayer from "@/components/curadoria/AudioPlayer";
import { getSealIcon } from "@/lib/sealIcons";
import WineVoting from "@/components/curadoria/WineVoting";
import WineComments from "@/components/curadoria/WineComments";
import { useAnalytics } from "@/hooks/useAnalytics";

function formatWinePrice(raw: string): string {
  const cleaned = raw.replace(/^R\$\s*/i, "").trim();
  const num = parseFloat(cleaned.replace(",", "."));
  if (!isNaN(num)) return `R$${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return cleaned.startsWith("R$") ? cleaned : `R$${cleaned}`;
}

export default function WineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { trackWineOpened } = useAnalytics();

  const { data: wine, isLoading } = useQuery({
    queryKey: ["wine-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines")
        .select("*")
        .eq("id", id!)
        .in("status", ["curadoria", "acervo"])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sealEntries } = useQuery({
    queryKey: ["wine-detail-seals", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wine_seals")
        .select("seal_id, seals(name, category, icon, description)")
        .eq("wine_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  // Track wine opened
  useEffect(() => {
    if (wine) {
      trackWineOpened(wine.id, wine.name);
    }
  }, [wine?.id, trackWineOpened]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!wine) {
    return (
      <div className="px-6 py-10 max-w-4xl mx-auto text-center">
        <Wine className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">Vinho não encontrado</h1>
        <p className="text-muted-foreground mb-6">Este vinho pode ter sido removido ou não está publicado.</p>
        <Link to="/curadoria">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar à curadoria
          </Button>
        </Link>
      </div>
    );
  }

  const wineSeals = sealEntries?.filter((e) => (e.seals as any)?.category === "perfil_vinho") ?? [];
  const drinkerSeals = sealEntries?.filter((e) => (e.seals as any)?.category === "perfil_bebedor") ?? [];

  return (
    <div className="animate-fade-in px-4 sm:px-6 py-6 sm:py-10 max-w-4xl mx-auto">
      {/* Back */}
      <Link to="/curadoria" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 sm:mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar à curadoria
      </Link>

      <div className="grid gap-6 sm:gap-8 md:grid-cols-[320px_1fr]">
        {/* Image */}
        <div className="relative aspect-[3/4] max-h-[50vh] md:max-h-none rounded-xl overflow-hidden bg-muted/30 border border-border mx-auto md:mx-0 w-full max-w-[280px] md:max-w-none">
          {wine.image_url ? (
            <img src={wine.image_url} alt={wine.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Wine className="h-20 w-20 text-muted-foreground/20" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-sans font-bold text-foreground">{wine.name}</h1>
              {(wine as any).status === "acervo" && (
                <Badge variant="secondary" className="text-xs">Acervo</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {wine.producer} {wine.vintage ? `· ${wine.vintage}` : ""}
            </p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {[
              { label: "Uva", value: wine.grape },
              { label: "Tipo", value: wine.type },
              { label: "País", value: wine.country },
              { label: "Região", value: wine.region },
              { label: "Importadora", value: wine.importer },
              { label: "Preço", value: wine.price_range ? formatWinePrice(wine.price_range) : null },
              { label: "Nota", value: wine.rating ? `${wine.rating}/100` : null },
              { label: "Beber ou Guardar?", value: (wine as any).drink_or_cellar },
            ]
              .filter((d) => d.value)
              .map((d) => (
                <div key={d.label}>
                  <span className="text-muted-foreground text-xs">{d.label}</span>
                  <p className="font-medium text-foreground">{d.value}</p>
                </div>
              ))}
          </div>

          {/* Description */}
          {wine.description && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-1">Descrição</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{wine.description}</p>
            </div>
          )}

          {/* Thomas notes */}
          {wine.tasting_notes && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-4">
              <h3 className="text-sm font-medium text-primary mb-2">Comentário do Thomas</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{wine.tasting_notes}</p>
            </div>
          )}

          {/* Audio player - always visible */}
          <AudioPlayer src={(wine as any).audio_url} />

          {/* Seller button */}
          {(wine as any).website_url && (
            <a
              href={`${(wine as any).website_url}${(wine as any).website_url.includes('?') ? '&' : '?'}utm_source=radar-do-jovem`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                Visitar o vendedor
              </Button>
            </a>
          )}

          {/* Seal descriptions */}
          {sealEntries && sealEntries.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Selos</h3>
              <div className="space-y-2">
                {sealEntries.map((entry) => (
                  <div key={entry.seal_id} className="flex items-start gap-3 text-sm">
                    {(() => {
                      const iconSrc = getSealIcon((entry.seals as any)?.icon);
                      return iconSrc ? (
                        <img src={iconSrc} alt={(entry.seals as any)?.name} className="h-10 w-10 shrink-0 object-contain" />
                      ) : (
                        <span className="text-base shrink-0">{(entry.seals as any)?.icon}</span>
                      );
                    })()}
                    <div>
                      <span className="font-medium text-foreground">{(entry.seals as any)?.name}</span>
                      {(entry.seals as any)?.description && (
                        <p className="text-muted-foreground text-xs">{(entry.seals as any)?.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Voting */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Você recomenda este vinho?</p>
            <WineVoting wineId={wine.id} />
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Comentários</h3>
            <WineComments wineId={wine.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
