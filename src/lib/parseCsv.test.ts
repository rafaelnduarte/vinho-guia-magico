import { describe, expect, it } from "vitest";

import { normalizeCsvHeader, parseCSV } from "./parseCsv";

describe("parseCSV", () => {
  it("preserva campos com quebras de linha e vírgulas entre aspas", () => {
    const csv = [
      'VINHO,COMENTÁRIO,Para quem é este vinho?,Categoria Vinho',
      '"Teste","Linha 1, com vírgula',
      'Linha 2","Nerd","Contemplativo"',
    ].join("\n");

    const { headers, rows } = parseCSV(csv);

    expect(headers).toEqual([
      "VINHO",
      "COMENTÁRIO",
      "Para quem é este vinho?",
      "Categoria Vinho",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([
      "Teste",
      "Linha 1, com vírgula\nLinha 2",
      "Nerd",
      "Contemplativo",
    ]);
  });

  it("detecta CSV delimitado por ponto e vírgula", () => {
    const csv = [
      "VINHO;Para quem é este vinho?;Categoria Vinho",
      '"Teste";"Curioso";"Refrescante"',
    ].join("\n");

    const { headers, rows } = parseCSV(csv);

    expect(headers).toEqual([
      "VINHO",
      "Para quem é este vinho?",
      "Categoria Vinho",
    ]);
    expect(rows[0]).toEqual(["Teste", "Curioso", "Refrescante"]);
  });
});

describe("normalizeCsvHeader", () => {
  it("normaliza acentos e pontuação", () => {
    expect(normalizeCsvHeader("Para quem é este vinho?")).toBe("para_quem_e_este_vinho");
  });
});