import { Wine } from "lucide-react";
import { Link } from "react-router-dom";
import { getSealIcon } from "@/lib/sealIcons";

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
}

export default function WineCard({ wine }: WineCardProps) {
  const wineIcon = getSealIcon(wine.seal_wine_type);
  const drinkerIcon = getSealIcon(wine.seal_drinker_type);

  return (
    <Link
      to={`/curadoria/${wine.id}`}
      className="group flex flex-col hover:opacity-90 transition-opacity"
    >
      {/* Image area with floating seals */}
      <div className="relative">
        <div className="aspect-[3/4] flex items-center justify-center overflow-hidden">
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

        {/* Seals floating outside top-right */}
        {(drinkerIcon || wineIcon) && (
          <div className="absolute -top-2 -right-2 flex flex-col gap-2">
            {drinkerIcon && (
              <img
                src={drinkerIcon}
                alt={wine.seal_drinker_type}
                className="h-12 w-12 drop-shadow-md"
              />
            )}
            {wineIcon && (
              <img
                src={wineIcon}
                alt={wine.seal_wine_type}
                className="h-12 w-12 drop-shadow-md"
              />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pt-3 flex flex-col">
        <h3 className="font-sans font-semibold text-base text-foreground leading-tight mb-1 group-hover:text-primary transition-colors">
          {wine.name}
        </h3>
        <p className="text-xs text-muted-foreground mb-2">
          {wine.producer} {wine.vintage ? `· ${wine.vintage}` : ""}
        </p>
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">{wine.type} · {wine.country}</span>
          {wine.price && <span className="text-sm font-medium text-foreground">{wine.price}</span>}
        </div>
      </div>
    </Link>
  );
}
