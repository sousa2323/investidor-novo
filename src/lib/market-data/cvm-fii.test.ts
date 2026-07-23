import { describe, expect, it } from "vitest";

import { buildFiiIsinMap, parseB3CotahistLine, type B3CotahistRecord } from "@/lib/market-data/b3";
import {
  buildFiiRegistry,
  indexFiiRegistryByTicker,
} from "@/lib/market-data/cvm-fii";
import type { CvmCsvArchive } from "@/lib/market-data/cvm";
import { deriveFiiMetrics } from "@/lib/market-data/fii-metrics";

function createArchive(
  general: Record<string, string>[],
  complement: Record<string, string>[],
  assets: Record<string, string>[] = [],
): CvmCsvArchive {
  return {
    checksum: "fixture",
    files: [
      { filename: "inf_mensal_fii_geral_2026.csv", headers: [], rows: general },
      {
        filename: "inf_mensal_fii_complemento_2026.csv",
        headers: [],
        rows: complement,
      },
      {
        filename: "inf_mensal_fii_ativo_passivo_2026.csv",
        headers: [],
        rows: assets,
      },
    ],
  };
}

const fundCnpj = "11.728.688/0001-47";

function createMonthlyRows(
  months: string[],
  bookValue: string,
  monthlyYield: string,
): Record<string, string>[] {
  return months.map((referenceMonth) => ({
    CNPJ_Fundo_Classe: fundCnpj,
    Data_Referencia: referenceMonth,
    Valor_Patrimonial_Cotas: bookValue,
    Patrimonio_Liquido: "7597392215.14",
    Percentual_Dividend_Yield_Mes: monthlyYield,
    Total_Numero_Cotistas: "250000",
  }));
}

const twelveMonths = [
  "2025-07-01", "2025-08-01", "2025-09-01", "2025-10-01",
  "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01",
  "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01",
];

describe("registro de FIIs da CVM", () => {
  it("consolida cadastro, competências mensais e composição da carteira", () => {
    const registry = buildFiiRegistry([
      createArchive(
        [
          {
            CNPJ_Fundo_Classe: fundCnpj,
            Codigo_ISIN: "BRHGLGCTF004",
            Nome_Fundo_Classe: "PÁTRIA LOG - FUNDO DE INVESTIMENTO IMOBILIÁRIO",
            Data_Funcionamento: "2010-05-03",
            Segmento_Atuacao: "Logística",
          },
        ],
        createMonthlyRows(twelveMonths, "166.603102910645", "0.006626"),
        [
          {
            CNPJ_Fundo_Classe: fundCnpj,
            Imoveis_Renda_Acabados: "7000000000",
            CRI: "100000000",
          },
        ],
      ),
    ]);
    const entry = registry.get(fundCnpj);

    expect(entry?.isin).toBe("BRHGLGCTF004");
    expect(entry?.segment).toBe("Logística");
    expect(entry?.monthlyReports).toHaveLength(12);
    // A CVM entrega o DY mensal como fração; a derivação usa pontos percentuais.
    expect(entry?.monthlyReports.at(-1)?.dividendYieldPercent).toBeCloseTo(0.6626, 4);
    expect(entry?.monthlyReports.at(-1)?.bookValuePerShare).toBeCloseTo(166.6031, 3);
  });

  it("mantém o segmento já conhecido quando uma competência vem em branco", () => {
    const registry = buildFiiRegistry([
      createArchive(
        [
          {
            CNPJ_Fundo_Classe: fundCnpj,
            Codigo_ISIN: "BRHGLGCTF004",
            Nome_Fundo_Classe: "PÁTRIA LOG",
            Data_Funcionamento: "2010-05-03",
            Segmento_Atuacao: "Logística",
          },
          {
            CNPJ_Fundo_Classe: fundCnpj,
            Codigo_ISIN: "BRHGLGCTF004",
            Nome_Fundo_Classe: "PÁTRIA LOG",
            Data_Funcionamento: "2010-05-03",
            Segmento_Atuacao: "",
          },
        ],
        [],
      ),
    ]);

    expect(registry.get(fundCnpj)?.segment).toBe("Logística");
  });

  it("escolhe o ISIN mais frequente quando uma competência traz o código errado", () => {
    const otherCnpj = "28.757.546/0001-00";
    const registry = buildFiiRegistry([
      createArchive(
        [
          // XP Malls reporta seu ISIN em cinco competências.
          ...["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01"].map(
            (referenceMonth) => ({
              CNPJ_Fundo_Classe: otherCnpj,
              Codigo_ISIN: "BRXPMLCTF000",
              Data_Referencia: referenceMonth,
              Nome_Fundo_Classe: "XP MALLS FII",
              Segmento_Atuacao: "Shoppings",
            }),
          ),
          // Outro fundo digita o ISIN do XP Malls uma única vez, por engano.
          {
            CNPJ_Fundo_Classe: fundCnpj,
            Codigo_ISIN: "BRPENICTF001",
            Nome_Fundo_Classe: "PENINSULA FII",
            Segmento_Atuacao: "Outros",
          },
          {
            CNPJ_Fundo_Classe: fundCnpj,
            Codigo_ISIN: "BRXPMLCTF000",
            Nome_Fundo_Classe: "PENINSULA FII",
            Segmento_Atuacao: "Outros",
          },
        ],
        [],
      ),
    ]);

    expect(registry.get(otherCnpj)?.isin).toBe("BRXPMLCTF000");
    // O engano pontual não pode roubar o ISIN do fundo correto.
    expect(registry.get(fundCnpj)?.isin).toBe("BRPENICTF001");
  });

  it("reindexa o registro por ticker através do ISIN do COTAHIST", () => {
    const registry = buildFiiRegistry([
      createArchive(
        [
          {
            CNPJ_Fundo_Classe: fundCnpj,
            Codigo_ISIN: "BRHGLGCTF004",
            Nome_Fundo_Classe: "PÁTRIA LOG",
            Data_Funcionamento: "2010-05-03",
            Segmento_Atuacao: "Logística",
          },
        ],
        createMonthlyRows(twelveMonths, "166.603102910645", "0.006626"),
      ),
    ]);
    const characters = Array.from({ length: 245 }, () => " ");
    const write = (start: number, value: string) => {
      value.split("").forEach((character, index) => {
        characters[start + index] = character;
      });
    };
    write(0, "01");
    write(2, "20260722");
    write(12, "HGLG11      ");
    write(24, "010");
    write(39, "CI        ");
    write(108, "0000000014783");
    write(230, "BRHGLGCTF004");

    const isinMap = buildFiiIsinMap([
      parseB3CotahistLine(characters.join("")) as B3CotahistRecord,
    ]);
    const byTicker = indexFiiRegistryByTicker(registry, isinMap);

    expect(byTicker.get("HGLG11")?.cnpj).toBe(fundCnpj);
  });
});

describe("métricas derivadas de FII", () => {
  const registryEntry = buildFiiRegistry([
    createArchive(
      [
        {
          CNPJ_Fundo_Classe: fundCnpj,
          Codigo_ISIN: "BRHGLGCTF004",
          Nome_Fundo_Classe: "PÁTRIA LOG",
          Data_Funcionamento: "2010-05-03",
          Segmento_Atuacao: "Logística",
        },
      ],
      createMonthlyRows(twelveMonths, "166.603102910645", "0.006626"),
      [
        {
          CNPJ_Fundo_Classe: fundCnpj,
          Imoveis_Renda_Acabados: "7000000000",
          CRI: "100000000",
        },
      ],
    ),
  ]).get(fundCnpj);

  it("calcula P/VP a partir do valor patrimonial da cota", () => {
    const metrics = deriveFiiMetrics({
      priceCents: 14_783,
      registryEntry: registryEntry as NonNullable<typeof registryEntry>,
      averageDailyLiquidityCents: 1_580_000_000,
      referenceDate: new Date("2026-07-23T00:00:00Z"),
    });

    // 147,83 / 166,60 — o mesmo valor conferido contra os dados públicos.
    expect(metrics.priceToBook).toBeCloseTo(0.89, 2);
    expect(metrics.dividendYieldTwelveMonths).toBeCloseTo(7.95, 1);
    expect(metrics.ageYears).toBeCloseTo(16.2, 1);
    expect(metrics.vacancyRate).toBeNull();
    // Rendimento mensal por cota = DY do mês (0,6626%) × valor patrimonial
    // (166,60), em centavos.
    expect(metrics.lastMonthlyDividendCents).toBe(110);
  });

  it("deixa o DY de 12 meses ausente quando a janela está incompleta", () => {
    const partialEntry = buildFiiRegistry([
      createArchive(
        [
          {
            CNPJ_Fundo_Classe: fundCnpj,
            Codigo_ISIN: "BRHGLGCTF004",
            Nome_Fundo_Classe: "PÁTRIA LOG",
            Data_Funcionamento: "2010-05-03",
            Segmento_Atuacao: "Logística",
          },
        ],
        createMonthlyRows(twelveMonths.slice(0, 6), "166.6", "0.006626"),
      ),
    ]).get(fundCnpj);

    expect(
      deriveFiiMetrics({
        priceCents: 14_783,
        registryEntry: partialEntry as NonNullable<typeof partialEntry>,
        averageDailyLiquidityCents: null,
      }).dividendYieldTwelveMonths,
    ).toBeNull();
  });

  it("penaliza fundo que concentra a distribuição em poucos meses", () => {
    const irregularRows = twelveMonths.map((referenceMonth, monthIndex) => ({
      CNPJ_Fundo_Classe: fundCnpj,
      Data_Referencia: referenceMonth,
      Valor_Patrimonial_Cotas: "100",
      Percentual_Dividend_Yield_Mes: monthIndex === 0 ? "0.08" : "0",
    }));
    const irregularEntry = buildFiiRegistry([
      createArchive(
        [
          {
            CNPJ_Fundo_Classe: fundCnpj,
            Codigo_ISIN: "BRTESTCTF001",
            Nome_Fundo_Classe: "FUNDO IRREGULAR",
            Data_Funcionamento: "2020-01-01",
            Segmento_Atuacao: "Outros",
          },
        ],
        irregularRows,
      ),
    ]).get(fundCnpj);
    const metrics = deriveFiiMetrics({
      priceCents: 10_000,
      registryEntry: irregularEntry as NonNullable<typeof irregularEntry>,
      averageDailyLiquidityCents: null,
    });

    expect(metrics.incomeRegularityScore).toBeLessThan(30);
  });
});
