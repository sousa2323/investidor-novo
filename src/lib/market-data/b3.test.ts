import { describe, expect, it } from "vitest";

import {
  buildFiiIsinMap,
  parseB3CotahistLine,
  type B3CotahistRecord,
} from "@/lib/market-data/b3";

function createAnonymizedCotahistFixture(
  overrides: { ticker?: string; specification?: string; isin?: string } = {},
): string {
  const characters = Array.from({ length: 245 }, () => " ");
  function write(start: number, value: string) {
    value.split("").forEach((character, characterIndex) => {
      characters[start + characterIndex] = character;
    });
  }
  write(0, "01");
  write(2, "20260722");
  write(12, (overrides.ticker ?? "TEST3").padEnd(12, " "));
  write(24, "010");
  write(27, "EMPRESA TESTE");
  write(39, (overrides.specification ?? "ON      NM").padEnd(10, " "));
  write(108, "0000000001234");
  write(152, "000000000000001000");
  write(170, "000000000001234000");
  write(230, overrides.isin ?? "BRTESTACNOR1");
  return characters.join("");
}

describe("parser B3 COTAHIST", () => {
  it("lê o registro fixo e mantém preços em centavos", () => {
    const record = parseB3CotahistLine(createAnonymizedCotahistFixture());
    expect(record).toMatchObject({
      ticker: "TEST3",
      marketDate: "2026-07-22",
      closePriceCents: 1_234,
      tradedQuantity: 1_000,
      financialVolumeCents: 1_234_000,
      marketType: "010",
      specification: "ON      NM",
      isin: "BRTESTACNOR1",
    });
  });

  it("ignora cabeçalhos e rodapés", () => {
    expect(parseB3CotahistLine("00COTAHIST CABECALHO")).toBeNull();
  });
});

describe("mapa ISIN de FIIs", () => {
  function parseFixture(overrides: {
    ticker: string;
    specification: string;
    isin: string;
  }): B3CotahistRecord {
    return parseB3CotahistLine(
      createAnonymizedCotahistFixture(overrides),
    ) as B3CotahistRecord;
  }

  it("indexa apenas cotas de fundo fechado terminadas em 11", () => {
    const isinMap = buildFiiIsinMap([
      parseFixture({
        ticker: "HGLG11",
        specification: "CI",
        isin: "BRHGLGCTF004",
      }),
      parseFixture({
        ticker: "BBAS3",
        specification: "ON      NM",
        isin: "BRBBASACNOR3",
      }),
    ]);

    expect(isinMap.get("BRHGLGCTF004")).toBe("HGLG11");
    expect(isinMap.has("BRBBASACNOR3")).toBe(false);
  });

  it("não deixa recibo de subscrição sobrescrever a cota principal", () => {
    const isinMap = buildFiiIsinMap([
      parseFixture({
        ticker: "HGLG11",
        specification: "CI",
        isin: "BRHGLGCTF004",
      }),
      parseFixture({
        ticker: "HGLG12",
        specification: "CI  ER",
        isin: "BRHGLGCTF004",
      }),
    ]);

    expect(isinMap.get("BRHGLGCTF004")).toBe("HGLG11");
  });
});
