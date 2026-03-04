import { Wine, ThumbsUp, MessageCircle, Grape } from "lucide-react";
import { Link } from "react-router-dom";
import { getSealIcon } from "@/lib/sealIcons";
import { Badge } from "@/components/ui/badge";

function formatPrice(raw: string): string {
  const cleaned = raw.replace(/^R\$\s*/i, "").trim();
  const num = parseFloat(cleaned.replace(",", "."));
  if (!isNaN(num)) return `R$${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return cleaned.startsWith("R$") ? cleaned : `R$${cleaned}`;
}

export interface MockWine {
  id: string;
  name: string;
  producer: string;
  vintage: number;
  grape: string;
  type: string;
  country: string;
  importer: string;
  price: string;
  image_url: string;
  tasting_notes: string;
  seal_wine_type: string;
  seal_drinker_type: string;
}

interface WineCardProps {
  wine: MockWine;
  likeCount?: number;
  commentCount?: number;
  isArchive?: boolean;
}

export default function WineCard({ wine, likeCount = 0, commentCount = 0, isArchive = false }: WineCardProps) {
  const wineIcon = getSealIcon(wine.seal_wine_type);
  const drinkerIcon = getSealIcon(wine.seal_drinker_type);

  return (
    <Link
      to={`/curadoria/${wine.id}`}
      className="group flex flex-col h-full"
    >
      {/* Image — tall bottle format, no box */}
      <div className="relative flex items-end justify-center h-48 sm:h-64 mb-2 bg-card rounded-xl overflow-hidden">
        {wine.image_url ? (
          <img
            src={wine.image_url}
            alt={wine.name}
            className="h-full w-auto object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)] group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <Wine className="h-14 w-14 text-muted-foreground/20" />
          </div>
        )}

        {/* Seals floating */}
        {(drinkerIcon || wineIcon) && (
          <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
            {drinkerIcon && (
              <img
                src={drinkerIcon}
                alt={wine.seal_drinker_type}
                className="h-7 w-7 sm:h-9 sm:w-9 drop-shadow-md"
              />
            )}
            {wineIcon && (
              <img
                src={wineIcon}
                alt={wine.seal_wine_type}
                className="h-7 w-7 sm:h-9 sm:w-9 drop-shadow-md"
              />
            )}
          </div>
        )}
      </div>

      {/* Info — clean, minimal */}
      <div className="flex-1 flex flex-col min-w-0 px-0.5">
        <div className="flex items-center gap-1 mb-0.5">
          <h3 className="font-sans font-semibold text-xs sm:text-sm text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {wine.name}
          </h3>
          {isArchive && <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">Acervo</Badge>}
        </div>
        <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 truncate">
          {wine.producer} {wine.vintage ? `· ${wine.vintage}` : ""}
        </p>
        {wine.grape && (
          <p className="text-[10px] sm:text-xs text-muted-foreground/70 mb-1 truncate flex items-center gap-1">
            <Grape className="h-2.5 w-2.5 shrink-0" /> {wine.grape}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-border/40 gap-1">
          <span className="text-[10px] sm:text-xs text-muted-foreground truncate">{wine.type} · {wine.country}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {likeCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <ThumbsUp className="h-2.5 w-2.5" /> {likeCount}
              </span>
            )}
            {commentCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <MessageCircle className="h-2.5 w-2.5" /> {commentCount}
              </span>
            )}
            {wine.price && <span className="text-[11px] sm:text-xs font-semibold text-foreground">{formatPrice(wine.price)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
