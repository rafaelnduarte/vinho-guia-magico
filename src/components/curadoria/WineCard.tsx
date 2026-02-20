import { Wine, ThumbsUp } from "lucide-react";
import { Link } from "react-router-dom";
import { getSealIcon } from "@/lib/sealIcons";
import { Badge } from "@/components/ui/badge";

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
  isArchive?: boolean;
}

export default function WineCard({ wine, likeCount = 0, isArchive = false }: WineCardProps) {
  const wineIcon = getSealIcon(wine.seal_wine_type);
  const drinkerIcon = getSealIcon(wine.seal_drinker_type);

  return (
    <Link
      to={`/curadoria/${wine.id}`}
      className="group flex flex-col hover:opacity-90 transition-opacity"
    >
      {/* Image area with floating seals */}
      <div className="relative">
        <div className="aspect-[3/4] flex items-center justify-center overflow-hidden relative">
          {wine.image_url ? (
            <img
              src={wine.image_url}
              alt={wine.name}
              className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <Wine className="h-16 w-16 text-muted-foreground/30" />
          )}
        </div>

        {/* Seals floating top-right */}
        {(drinkerIcon || wineIcon) && (
          <div className="absolute top-0 right-0 flex flex-col gap-1">
            {drinkerIcon && (
              <img
                src={drinkerIcon}
                alt={wine.seal_drinker_type}
                className="h-10 w-10 sm:h-14 sm:w-14 drop-shadow-md"
              />
            )}
            {wineIcon && (
              <img
                src={wineIcon}
                alt={wine.seal_wine_type}
                className="h-10 w-10 sm:h-14 sm:w-14 drop-shadow-md"
              />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pt-2 sm:pt-3 flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 sm:mb-1">
          <h3 className="font-sans font-semibold text-sm sm:text-base text-foreground leading-tight group-hover:text-primary transition-colors truncate">
            {wine.name}
          </h3>
          {isArchive && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Acervo</Badge>}
        </div>
        <p className="text-[11px] sm:text-xs text-muted-foreground mb-1 sm:mb-2 truncate">
          {wine.producer} {wine.vintage ? `· ${wine.vintage}` : ""}
        </p>
        <div className="flex items-center justify-between mt-auto pt-1.5 sm:pt-2 border-t border-border/50 gap-1">
          <span className="text-[10px] sm:text-xs text-muted-foreground truncate">{wine.type} · {wine.country}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {likeCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] sm:text-xs text-muted-foreground">
                <ThumbsUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {likeCount}
              </span>
            )}
            {wine.price && <span className="text-xs sm:text-sm font-medium text-foreground">R${wine.price.replace('.', ',')}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
