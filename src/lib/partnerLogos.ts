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
import goodClothing from "@/assets/partners/good-clothing.png";
import saintVivant from "@/assets/partners/saint-vivant.png";
import elevageNew from "@/assets/partners/elevage-new.png";
import maisonSirino from "@/assets/partners/maison-sirino.png";
import mistral from "@/assets/partners/mistral.png";
import saidaDeEmergencia from "@/assets/partners/saida-de-emergencia.png";
import tanynoGlass from "@/assets/partners/tanyno-glass.png";
import tanyno from "@/assets/partners/tanyno.png";
import vibrana from "@/assets/partners/vibrana.png";
import vinhaSolo from "@/assets/partners/vinha-solo.png";
import vinveneto from "@/assets/partners/vinveneto.png";
import vivente from "@/assets/partners/vivente.png";
import worldWine from "@/assets/partners/world-wine.png";

const partnerLogos: Record<string, string> = {
  "a-casa-do-produtor": aCasaDoProdutor,
  castas,
  elevage: elevageNew,
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
  "good-clothing": saidaDeEmergencia,
  "saint-vivant": saintVivant,
  "maison-sirino": maisonSirino,
  mistral,
  "saida-emergencia": goodClothing,
  "tanyno-glass": tanynoGlass,
  tanyno,
  vibrana,
  "vinha-solo": vinhaSolo,
  "vin-veneto": vinveneto,
  vivente,
  "world-wine": worldWine,
};

export function getPartnerLogo(key: string | null): string | undefined {
  if (!key) return undefined;
  return partnerLogos[key];
}
