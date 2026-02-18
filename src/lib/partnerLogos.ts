import aCasaDoProdutor from "@/assets/partners/a-casa-do-produtor.png";
import castas from "@/assets/partners/castas.png";
import elevage from "@/assets/partners/elevage.png";
import wines4u from "@/assets/partners/wines4u.png";
import curavino from "@/assets/partners/curavino.png";
import arteDaVinha from "@/assets/partners/arte-da-vinha.png";
import caveleman from "@/assets/partners/cave-leman.png";
import cellar from "@/assets/partners/cellar.png";
import cava from "@/assets/partners/cava.png";
import uvaVinhos from "@/assets/partners/uva-vinhos.png";
import animaVinum from "@/assets/partners/anima-vinum.png";
import glouglou from "@/assets/partners/glouglou.png";
import lojaElefante from "@/assets/partners/loja-elefante.png";
import outroVinho from "@/assets/partners/outro-vinho.png";
import adegasMetier from "@/assets/partners/adegas-metier.png";
import elevadoBar from "@/assets/partners/elevado-bar.png";
import vinivivo from "@/assets/partners/vinivivo.png";
import vingardeValise from "@/assets/partners/vingarde-valise.png";

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
  "uva-vinhos": uvaVinhos,
  "anima-vinum": animaVinum,
  glouglou,
  "loja-elefante": lojaElefante,
  "outro-vinho": outroVinho,
  "adegas-metier": adegasMetier,
  "elevado-bar": elevadoBar,
  vinivivo,
  "vingarde-valise": vingardeValise,
};

export function getPartnerLogo(key: string | null): string | undefined {
  if (!key) return undefined;
  return partnerLogos[key];
}
