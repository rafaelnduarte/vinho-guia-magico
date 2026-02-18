import aCasaDoProdutor from "@/assets/partners/a-casa-do-produtor.png";
import castas from "@/assets/partners/castas.png";
import elevage from "@/assets/partners/elevage.png";
import wines4u from "@/assets/partners/wines4u.png";
import curavino from "@/assets/partners/curavino.png";
import arteDaVinha from "@/assets/partners/arte-da-vinha.png";
import caveleman from "@/assets/partners/cave-leman.png";
import cellar from "@/assets/partners/cellar.png";
import cava from "@/assets/partners/cava.png";

const partnerLogos: Record<string, string> = {
  "a-casa-do-produtor": aCasaDoProdutor,
  castas,
  elevage,
  wines4u,
  curavino,
  "arte-da-vinha": arteDaVinha,
  "cave-leman": caveleman,
  cellar,
  cava,
};

export function getPartnerLogo(key: string | null): string | undefined {
  if (!key) return undefined;
  return partnerLogos[key];
}
