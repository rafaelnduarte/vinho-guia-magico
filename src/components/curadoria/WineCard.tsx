import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wine, MessageSquare } from "lucide-react";
import WineVoting from "./WineVoting";
import WineComments from "./WineComments";

export interface MockWine {
  id: string;
  name: string;
  producer: string;
  vintage: number;
  grape: string;
  type: string;
  country: string;
  importer: string;
  price_range: string;
  image_url: string;
  tasting_notes: string;
  seal_wine_type: string;
  seal_drinker_type: string;
}

interface WineCardProps {
  wine: MockWine;
}

const sealColors: Record<string, string> = {
  "Encorpado": "bg-red-900/90 text-white",
  "Leve": "bg-amber-500/90 text-white",
  "Médio": "bg-orange-700/90 text-white",
  "Frutado": "bg-pink-600/90 text-white",
  "Iniciante": "bg-emerald-600/90 text-white",
  "Intermediário": "bg-blue-600/90 text-white",
  "Avançado": "bg-violet-700/90 text-white",
  "Curioso": "bg-teal-600/90 text-white",
};

export default function WineCard({ wine }: WineCardProps) {
  const [tab, setTab] = useState("info");

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      {/* Image with seals */}
      <div className="relative aspect-[3/4] bg-muted/30 flex items-center justify-center overflow-hidden">
        {wine.image_url ? (
          <img
            src={wine.image_url}
            alt={wine.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Wine className="h-16 w-16 text-muted-foreground/30" />
        )}
        {/* Seals overlay */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5">
          <Badge className={`text-[10px] px-1.5 py-0.5 shadow-md ${sealColors[wine.seal_wine_type] ?? "bg-primary text-primary-foreground"}`}>
            {wine.seal_wine_type}
          </Badge>
          <Badge className={`text-[10px] px-1.5 py-0.5 shadow-md ${sealColors[wine.seal_drinker_type] ?? "bg-primary text-primary-foreground"}`}>
            {wine.seal_drinker_type}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col">
        <h3 className="font-display text-base text-foreground leading-tight mb-1">{wine.name}</h3>
        <p className="text-xs text-muted-foreground mb-3">{wine.producer} · {wine.vintage}</p>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
          <TabsList className="w-full grid grid-cols-2 h-8">
            <TabsTrigger value="info" className="text-xs">Detalhes</TabsTrigger>
            <TabsTrigger value="comments" className="text-xs gap-1">
              <MessageSquare className="h-3 w-3" />
              Comentários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="flex-1 mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <div>
                <span className="text-muted-foreground">Uva</span>
                <p className="text-foreground font-medium">{wine.grape}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo</span>
                <p className="text-foreground font-medium">{wine.type}</p>
              </div>
              <div>
                <span className="text-muted-foreground">País</span>
                <p className="text-foreground font-medium">{wine.country}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Importadora</span>
                <p className="text-foreground font-medium">{wine.importer}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Faixa de Preço</span>
                <p className="text-foreground font-medium">{wine.price_range}</p>
              </div>
            </div>

            {/* Thomas comment */}
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
              <p className="text-xs font-medium text-primary mb-1">Comentário do Thomas</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{wine.tasting_notes}</p>
            </div>

            {/* Voting */}
            <div className="pt-1">
              <p className="text-xs text-muted-foreground mb-2">Você recomenda este vinho?</p>
              <WineVoting wineId={wine.id} />
            </div>
          </TabsContent>

          <TabsContent value="comments" className="flex-1 mt-3">
            <WineComments wineId={wine.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
