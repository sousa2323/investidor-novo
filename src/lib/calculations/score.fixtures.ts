import type { FiiMetrics, MarketAsset, StockMetrics } from "@/types/investment";

const fixtureSource = "Fixture de teste";
const fixtureSourceDate = "2026-07-23T03:00:00.000Z";

interface StockFixtureInput {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  dividendYield: number;
  payout: number;
  roe: number;
  roic: number;
  netDebtToEbitda: number;
  netMargin: number;
  growthLabel: string;
  dividendHistoryLabel: string;
  liquidityLabel: string;
}

const stockFixtureInputs: StockFixtureInput[] = [
  { ticker: "BBDC4", name: "Bradesco", sector: "Bancos", price: 15.2, dividendYield: 6, payout: 45, roe: 14, roic: 10, netDebtToEbitda: 2, netMargin: 18, growthLabel: "Baixo", dividendHistoryLabel: "Constante", liquidityLabel: "Alta" },
  { ticker: "BBAS3", name: "Banco do Brasil", sector: "Bancos", price: 50, dividendYield: 9, payout: 40, roe: 18, roic: 14, netDebtToEbitda: 1.8, netMargin: 22, growthLabel: "Moderado", dividendHistoryLabel: "Constante", liquidityLabel: "Alta" },
  { ticker: "SANB11", name: "Santander", sector: "Bancos", price: 28, dividendYield: 7, payout: 50, roe: 16, roic: 12, netDebtToEbitda: 2.2, netMargin: 20, growthLabel: "Moderado", dividendHistoryLabel: "Constante", liquidityLabel: "Alta" },
  { ticker: "LEVE3", name: "Metal Leve", sector: "Autopeças", price: 35, dividendYield: 9, payout: 60, roe: 28, roic: 22, netDebtToEbitda: 1, netMargin: 25, growthLabel: "Alto", dividendHistoryLabel: "Constante", liquidityLabel: "Média" },
  { ticker: "PETR4", name: "Petrobras", sector: "Petróleo", price: 38, dividendYield: 12, payout: 90, roe: 30, roic: 25, netDebtToEbitda: 1.5, netMargin: 28, growthLabel: "Volátil", dividendHistoryLabel: "Irregular", liquidityLabel: "Alta" },
  { ticker: "TAEE11", name: "Taesa", sector: "Energia", price: 36, dividendYield: 10, payout: 85, roe: 20, roic: 15, netDebtToEbitda: 3.5, netMargin: 40, growthLabel: "Estável", dividendHistoryLabel: "Constante", liquidityLabel: "Alta" },
  { ticker: "UNIP6", name: "Unipar", sector: "Química", price: 70, dividendYield: 11, payout: 75, roe: 35, roic: 30, netDebtToEbitda: 1.2, netMargin: 35, growthLabel: "Volátil", dividendHistoryLabel: "Irregular", liquidityLabel: "Média" },
  { ticker: "VALE3", name: "Vale", sector: "Mineração", price: 60, dividendYield: 10, payout: 80, roe: 25, roic: 20, netDebtToEbitda: 1, netMargin: 30, growthLabel: "Volátil", dividendHistoryLabel: "Irregular", liquidityLabel: "Alta" },
];

function createStockMetrics(input: StockFixtureInput): StockMetrics {
  return {
    dividendYield: input.dividendYield,
    payout: input.payout,
    roe: input.roe,
    roic: input.roic,
    netDebtToEbitda: input.netDebtToEbitda,
    netMargin: input.netMargin,
    profitGrowthFiveYears: null,
    profitGrowthLabel: input.growthLabel,
    dividendHistoryScore: input.dividendHistoryLabel === "Constante" ? 90 : 30,
    dividendHistoryLabel: input.dividendHistoryLabel,
    averageDailyLiquidityCents: null,
    liquidityScore: input.liquidityLabel === "Alta" ? 90 : 60,
    liquidityLabel: input.liquidityLabel,
  };
}

export const stockFixtures: MarketAsset[] = stockFixtureInputs.map((input) => ({
  id: `stock-${input.ticker.toLowerCase()}`,
  ticker: input.ticker,
  name: input.name,
  type: "STOCK",
  classification: input.sector,
  currentPriceCents: Math.round(input.price * 100),
  source: fixtureSource,
  sourceDate: fixtureSourceDate,
  referencePeriod: "Fixture",
  calculationVersion: "score-v1",
  stockMetrics: createStockMetrics(input),
}));

interface FiiFixtureInput {
  ticker: string;
  price: number;
  segment: string;
  priceToBook: number;
  dividendYield: number;
  liquidityMillionsPerDay: number;
  riskLabel: string;
  ageYears: number;
  vacancyRate?: number;
}

const fiiFixtureInputs: FiiFixtureInput[] = [
  { ticker: "HGLG11", price: 156, segment: "Logística", priceToBook: 0.94, dividendYield: 8.4, liquidityMillionsPerDay: 15.8, riskLabel: "Baixa", ageYears: 15, vacancyRate: 4.5 },
  { ticker: "XPLG11", price: 100, segment: "Logística", priceToBook: 0.95, dividendYield: 9.5, liquidityMillionsPerDay: 12, riskLabel: "Baixa", ageYears: 7 },
  { ticker: "BTLG11", price: 103, segment: "Logística", priceToBook: 1, dividendYield: 9, liquidityMillionsPerDay: 10.5, riskLabel: "Baixa", ageYears: 10 },
  { ticker: "KNRI11", price: 155, segment: "Híbrido", priceToBook: 0.95, dividendYield: 7.5, liquidityMillionsPerDay: 8, riskLabel: "Baixo risco", ageYears: 12 },
  { ticker: "MXRF11", price: 10.5, segment: "Híbrido", priceToBook: 1.05, dividendYield: 11.5, liquidityMillionsPerDay: 25, riskLabel: "Médio risco", ageYears: 12 },
  { ticker: "RBRP11", price: 60, segment: "Híbrido", priceToBook: 0.8, dividendYield: 7, liquidityMillionsPerDay: 3, riskLabel: "Alto risco", ageYears: 7 },
];

function createFiiMetrics(input: FiiFixtureInput): FiiMetrics {
  const normalizedRiskLabel = input.riskLabel.toLowerCase();
  const riskScore = normalizedRiskLabel.includes("alto")
    ? 20
    : normalizedRiskLabel.includes("méd")
      ? 55
      : 90;

  return {
    priceToBook: input.priceToBook,
    dividendYieldTwelveMonths: input.dividendYield,
    incomeRegularityScore: null,
    averageDailyLiquidityCents: Math.round(
      input.liquidityMillionsPerDay * 1_000_000 * 100,
    ),
    riskScore,
    riskLabel: input.riskLabel,
    vacancyRate: input.vacancyRate ?? null,
    ageYears: input.ageYears,
  };
}

export const fiiFixtures: MarketAsset[] = fiiFixtureInputs.map((input) => ({
  id: `fii-${input.ticker.toLowerCase()}`,
  ticker: input.ticker,
  name: `FII ${input.ticker}`,
  type: "FII",
  classification: input.segment,
  currentPriceCents: Math.round(input.price * 100),
  source: fixtureSource,
  sourceDate: fixtureSourceDate,
  referencePeriod: "Fixture",
  calculationVersion: "score-v1",
  fiiMetrics: createFiiMetrics(input),
}));
