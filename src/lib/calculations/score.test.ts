import { describe, expect, it } from "vitest";

import { fiiFixtures, stockFixtures } from "@/lib/calculations/score.fixtures";
import {
  applyProfileWeights,
  calculateAssetScore,
  calculateMetricPercentiles,
  calculatePercentileScore,
  fiiWeights,
  stockWeights,
} from "@/lib/calculations/score";
import type { MarketAsset, RiskProfile } from "@/types/investment";

const profiles: RiskProfile[] = ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"];

describe("cálculo de score", () => {
  it("mantém os pesos de cada perfil totalizando 100", () => {
    for (const profile of profiles) {
      expect(
        stockWeights[profile].reduce(
          (totalWeight, metric) => totalWeight + metric.weight,
          0,
        ),
      ).toBe(100);
      expect(
        fiiWeights[profile].reduce(
          (totalWeight, metric) => totalWeight + metric.weight,
          0,
        ),
      ).toBe(100);
    }
  });

  it("marca ROIC e dívida/EBITDA como não aplicáveis para bancos", () => {
    const bank = stockFixtures.find((asset) => asset.ticker === "BBDC4");
    expect(bank).toBeDefined();

    const breakdown = calculateAssetScore(
      bank as MarketAsset,
      "MODERATE",
      stockFixtures,
    );

    expect(
      breakdown.contributions.find(
        (contribution) => contribution.metric === "roic",
      )?.availability,
    ).toBe("NOT_APPLICABLE");
    expect(
      breakdown.contributions.find(
        (contribution) => contribution.metric === "netDebtToEbitda",
      )?.availability,
    ).toBe("NOT_APPLICABLE");
  });

  it("retira métricas ausentes do denominador e bloqueia ranking abaixo de 60%", () => {
    const incompleteAsset: MarketAsset = {
      ...stockFixtures[0],
      ticker: "TEST3",
      classification: "Teste",
      stockMetrics: {
        dividendYield: 5,
        payout: null,
        roe: null,
        roic: null,
        netDebtToEbitda: null,
        netMargin: null,
        profitGrowthFiveYears: null,
        dividendHistoryScore: null,
        averageDailyLiquidityCents: null,
      },
    };
    const breakdown = calculateAssetScore(
      incompleteAsset,
      "MODERATE",
      [...stockFixtures, incompleteAsset],
    );

    expect(breakdown.confidence).toBeLessThan(60);
    expect(breakdown.eligibleForRanking).toBe(false);
  });

  it("limita FII de risco extremo mesmo quando outras métricas são atraentes", () => {
    const riskyFii = fiiFixtures.find((asset) => asset.ticker === "RBRP11");
    expect(riskyFii).toBeDefined();

    const breakdown = calculateAssetScore(
      riskyFii as MarketAsset,
      "AGGRESSIVE",
      fiiFixtures,
    );

    expect(breakdown.score).toBeLessThanOrEqual(45);
  });

  it("altera a contribuição dos indicadores conforme o perfil", () => {
    const growthAsset = stockFixtures.find((asset) => asset.ticker === "LEVE3");
    expect(growthAsset).toBeDefined();

    const conservativeBreakdown = calculateAssetScore(
      growthAsset as MarketAsset,
      "CONSERVATIVE",
      stockFixtures,
    );
    const aggressiveBreakdown = calculateAssetScore(
      growthAsset as MarketAsset,
      "AGGRESSIVE",
      stockFixtures,
    );
    const conservativeGrowth = conservativeBreakdown.contributions.find(
      (contribution) => contribution.metric === "profitGrowthFiveYears",
    );
    const aggressiveGrowth = aggressiveBreakdown.contributions.find(
      (contribution) => contribution.metric === "profitGrowthFiveYears",
    );

    expect(aggressiveGrowth?.weight).toBe(25);
    expect(conservativeGrowth?.weight).toBe(8);
  });
});

describe("separação entre percentis e pesos do perfil", () => {
  it("produz o mesmo resultado do cálculo combinado nos três perfis", () => {
    const percentilesByTicker = calculateMetricPercentiles(stockFixtures);

    for (const profile of profiles) {
      for (const asset of stockFixtures) {
        const percentiles = percentilesByTicker.get(asset.ticker);
        expect(percentiles).toBeDefined();
        expect(
          applyProfileWeights(percentiles as NonNullable<typeof percentiles>, profile),
        ).toEqual(calculateAssetScore(asset, profile, stockFixtures));
      }
    }
  });

  it("calcula percentis uma única vez, independente do perfil de risco", () => {
    const percentiles = calculateMetricPercentiles(fiiFixtures).get("MXRF11");
    const conservative = applyProfileWeights(
      percentiles as NonNullable<typeof percentiles>,
      "CONSERVATIVE",
    );
    const aggressive = applyProfileWeights(
      percentiles as NonNullable<typeof percentiles>,
      "AGGRESSIVE",
    );
    const conservativeDividendYield = conservative.contributions.find(
      (contribution) => contribution.metric === "dividendYieldTwelveMonths",
    );
    const aggressiveDividendYield = aggressive.contributions.find(
      (contribution) => contribution.metric === "dividendYieldTwelveMonths",
    );

    expect(conservativeDividendYield?.normalizedScore).toBe(
      aggressiveDividendYield?.normalizedScore,
    );
    expect(conservativeDividendYield?.weight).not.toBe(
      aggressiveDividendYield?.weight,
    );
  });

  it("mantém a busca binária alinhada com a contagem direta de percentil", () => {
    const peerValues = [1, 3, 3, 3, 7, 9, 12, 12, 20];

    for (const value of peerValues) {
      const ascending = calculatePercentileScore(
        value,
        peerValues,
        "HIGHER_IS_BETTER",
      );
      const descending = calculatePercentileScore(
        value,
        peerValues,
        "LOWER_IS_BETTER",
      );
      // Cada lado é arredondado a uma casa, então a soma tolera 0,1 de folga.
      expect(ascending + descending).toBeCloseTo(100, 0);
    }

    expect(calculatePercentileScore(1, peerValues, "HIGHER_IS_BETTER")).toBe(0);
    expect(calculatePercentileScore(20, peerValues, "HIGHER_IS_BETTER")).toBe(100);
  });
});
