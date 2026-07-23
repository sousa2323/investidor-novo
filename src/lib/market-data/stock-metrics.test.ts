import { describe, expect, it } from "vitest";

import type { BrapiAssetDetail } from "@/lib/market-data/brapi-detail";
import { deriveStockMetrics } from "@/lib/market-data/stock-metrics";

/** Recorte do payload real de PETR4 devolvido pelo brapi. */
function createPetrobrasDetail(
  overrides: Partial<BrapiAssetDetail> = {},
): BrapiAssetDetail {
  return {
    symbol: "PETR4",
    shortName: "PETR4",
    longName: "Petroleo Brasileiro SA Pfd",
    currency: "BRL",
    regularMarketPrice: 43.28,
    regularMarketChange: 0.7,
    regularMarketChangePercent: 1.64,
    regularMarketVolume: 12_881_100,
    regularMarketPreviousClose: 43.29,
    regularMarketOpen: 43.4,
    regularMarketDayHigh: 43.49,
    regularMarketDayLow: 43.1,
    regularMarketTime: "2026-07-23T16:22:30.000Z",
    fiftyTwoWeekLow: 29.31,
    fiftyTwoWeekHigh: 50.69,
    marketCap: 582_636_533_210,
    priceEarnings: 5.185034323297913,
    earningsPerShare: 8.347058,
    logourl: "https://icons.brapi.dev/icons/PETR4.svg",
    summaryProfile: { sector: "Energia" },
    financialData: {
      totalCash: 47_600_000_000,
      ebitda: 230_884_000_000,
      totalDebt: 676_977_000_000,
      totalRevenue: 498_091_000_000,
      returnOnEquity: 0.24267222,
      profitMargins: 0.21689811,
    },
    defaultKeyStatistics: {
      trailingEps: 8.347058,
      priceToBook: 1.2327399,
      bookValue: 34.540943,
    },
    balanceSheetHistory: [
      { type: "yearly", endDate: "2021-12-31", totalStockholderEquity: 320_000_000_000 },
      { type: "yearly", endDate: "2025-12-31", totalStockholderEquity: 445_000_000_000 },
    ],
    incomeStatementHistory: [
      {
        type: "yearly",
        endDate: "2020-12-31",
        netIncome: 60_000_000_000,
        operatingIncome: 120_000_000_000,
        incomeBeforeTax: 100_000_000_000,
        incomeTaxExpense: -30_000_000_000,
      },
      {
        type: "yearly",
        endDate: "2025-12-31",
        netIncome: 107_583_000_000,
        operatingIncome: 143_700_000_000,
        incomeBeforeTax: 150_000_000_000,
        incomeTaxExpense: -45_000_000_000,
      },
    ],
    dividendsData: {
      cashDividends: [
        { paymentDate: "2026-05-20T03:00:00.000Z", lastDatePrior: "2026-04-22T03:00:00.000Z", rate: 0.313115, label: "JCP" },
        { paymentDate: "2026-03-20T03:00:00.000Z", lastDatePrior: "2025-12-22T03:00:00.000Z", rate: 0.29642144, label: "DIVIDENDO" },
        { paymentDate: "2025-11-20T03:00:00.000Z", lastDatePrior: "2025-10-22T03:00:00.000Z", rate: 0.4, label: "JCP" },
        { paymentDate: "2024-08-20T03:00:00.000Z", lastDatePrior: "2024-07-22T03:00:00.000Z", rate: 1.2, label: "DIVIDENDO" },
        { paymentDate: "2023-08-20T03:00:00.000Z", lastDatePrior: "2023-07-22T03:00:00.000Z", rate: 1.5, label: "DIVIDENDO" },
        { paymentDate: "2022-08-20T03:00:00.000Z", lastDatePrior: "2022-07-22T03:00:00.000Z", rate: 2.1, label: "DIVIDENDO" },
      ],
    },
    historicalDataPrice: Array.from({ length: 60 }, (_unused, index) => ({
      date: 1_753_239_600 + index * 86_400,
      open: 43,
      high: 44,
      low: 42,
      close: 43,
      volume: 20_000_000,
      adjustedClose: 43,
    })),
    ...overrides,
  } as BrapiAssetDetail;
}

const referenceDate = new Date("2026-07-23T00:00:00Z");

describe("métricas derivadas de ação", () => {
  it("converte frações do brapi em pontos percentuais", () => {
    const { metrics } = deriveStockMetrics(createPetrobrasDetail(), referenceDate);

    expect(metrics.roe).toBeCloseTo(24.27, 1);
    expect(metrics.netMargin).toBeCloseTo(21.69, 1);
  });

  it("calcula dívida líquida sobre EBITDA", () => {
    const { metrics } = deriveStockMetrics(createPetrobrasDetail(), referenceDate);

    // (676,977 − 47,6) / 230,884 bilhões
    expect(metrics.netDebtToEbitda).toBeCloseTo(2.73, 1);
  });

  it("soma somente os proventos dos últimos doze meses", () => {
    const { metrics } = deriveStockMetrics(createPetrobrasDetail(), referenceDate);

    // 0,313115 + 0,29642144 + 0,4 = 1,009536 sobre 43,28
    expect(metrics.dividendYield).toBeCloseTo(2.33, 1);
    expect(metrics.payout).toBeCloseTo(12.09, 1);
  });

  it("calcula CAGR do lucro e recusa base negativa", () => {
    const { metrics } = deriveStockMetrics(createPetrobrasDetail(), referenceDate);
    expect(metrics.profitGrowthFiveYears).toBeCloseTo(12.4, 0);

    const negativeBase = deriveStockMetrics(
      createPetrobrasDetail({
        incomeStatementHistory: [
          { type: "yearly", endDate: "2020-12-31", netIncome: -10_000_000_000 },
          { type: "yearly", endDate: "2025-12-31", netIncome: 107_583_000_000 },
        ],
      }),
      referenceDate,
    );
    expect(negativeBase.metrics.profitGrowthFiveYears).toBeNull();
  });

  it("usa o intervalo entre exercícios, não a posição na série", () => {
    // Apenas dois exercícios, distantes cinco anos: a taxa precisa ser anualizada
    // pelo intervalo real, e não tratada como crescimento de um ano só.
    const { metrics } = deriveStockMetrics(
      createPetrobrasDetail({
        incomeStatementHistory: [
          { type: "yearly", endDate: "2020-12-31", netIncome: 60_000_000_000 },
          { type: "yearly", endDate: "2025-12-31", netIncome: 107_583_000_000 },
        ],
      }),
      referenceDate,
    );

    expect(metrics.profitGrowthFiveYears).toBeCloseTo(12.4, 0);
  });

  it("não calcula crescimento sem exercício de cinco anos atrás", () => {
    const { metrics } = deriveStockMetrics(
      createPetrobrasDetail({
        incomeStatementHistory: [
          { type: "yearly", endDate: "2023-12-31", netIncome: 90_000_000_000 },
          { type: "yearly", endDate: "2025-12-31", netIncome: 107_583_000_000 },
        ],
      }),
      referenceDate,
    );

    expect(metrics.profitGrowthFiveYears).toBeNull();
  });

  it("calcula ROIC pela alíquota efetiva do exercício", () => {
    const { metrics } = deriveStockMetrics(createPetrobrasDetail(), referenceDate);

    // NOPAT = 143,7 × (1 − 0,30); capital = 445 + 676,977 − 47,6
    expect(metrics.roic).toBeCloseTo(9.37, 1);
  });

  it("classifica o histórico de dividendos pelos anos com distribuição", () => {
    const { metrics } = deriveStockMetrics(createPetrobrasDetail(), referenceDate);

    // Distribuiu em 2022, 2023, 2024 e 2025, mas não em 2021.
    expect(metrics.dividendHistoryScore).toBe(80);
    expect(metrics.dividendHistoryLabel).toBe("Constante");
  });

  it("deixa indicadores ausentes quando a fonte não traz o dado", () => {
    const { metrics } = deriveStockMetrics(
      createPetrobrasDetail({
        financialData: {},
        incomeStatementHistory: [],
        balanceSheetHistory: [],
        dividendsData: { cashDividends: [] },
      }),
      referenceDate,
    );

    expect(metrics.roe).toBeNull();
    expect(metrics.roic).toBeNull();
    expect(metrics.netDebtToEbitda).toBeNull();
    expect(metrics.dividendYield).toBeNull();
    expect(metrics.profitGrowthFiveYears).toBeNull();
  });

  it("calcula liquidez média diária em centavos", () => {
    const { metrics } = deriveStockMetrics(createPetrobrasDetail(), referenceDate);

    // 43 × 20.000.000 = 860.000.000 reais
    expect(metrics.averageDailyLiquidityCents).toBe(86_000_000_000);
  });
});
