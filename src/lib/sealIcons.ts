import natureba from "@/assets/seals/natureba.png";
import curioso from "@/assets/seals/curioso.png";
import nerd from "@/assets/seals/nerd.png";
import classico from "@/assets/seals/classico.png";
import contemplativo from "@/assets/seals/contemplativo.png";
import batalha from "@/assets/seals/batalha.png";
import refrescante from "@/assets/seals/refrescante.png";
import pedigree from "@/assets/seals/pedigree.png";

export const sealIcons: Record<string, string> = {
  natureba,
  curioso,
  nerd,
  classico,
  contemplativo,
  batalha,
  refrescante,
  pedigree,
};

export function getSealIcon(iconKey: string | null): string | undefined {
  if (!iconKey) return undefined;
  return sealIcons[iconKey.toLowerCase()];
}
