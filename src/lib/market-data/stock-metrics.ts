import type { BrapiAssetDetail } from "@/lib/market-data/brapi-detail";
import type { StockMetrics } from "@/types/investment";

function readNumber(
  source: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = source?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toPercentage(fraction: number | null): number | null {
  return fraction === null ? null : Math.round(fraction * 100 * 100) / 100;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface DividendPayment {
  paymentDate: string | null;
  lastDatePrior: string | null;
  rate: number;
  label: string;
}

/** Proventos em dinheiro normalizados, do mais recente para o mais antigo. */
export function extractDividendPayments(
  detail: BrapiAssetDetail,
): DividendPayment[] {
  const cashDividends = detail.dividendsData?.cashDividends ?? [];

  return cashDividends
    .filter(
      (dividend): dividend is typeof dividend & { rate: number } =>
        typeof dividend.rate === "number" && dividend.rate > 0,
    )
    .map((dividend) => ({
      paymentDate: dividend.paymentDate?.slice(0, 10) ?? null,
      lastDatePrior: dividend.lastDatePrior?.slice(0, 10) ?? null,
      rate: dividend.rate,
      label: dividend.label?.trim() || "PROVENTO",
    }))
    .sort((first, second) =>
      (second.paymentDate ?? "").localeCompare(first.paymentDate ?? ""),
    );
}

function sumTrailingDividends(
  payments: DividendPayment[],
  referenceDate: Date,
  months: number,
): number {
  const cutoff = new Date(referenceDate);
  cutoff.setMonth(cutoff.getMonth() - months);

  return payments
    .filter((payment) => {
      if (!payment.paymentDate) {
        return false;
      }
      const paidAt = new Date(`${payment.paymentDate}T00:00:00Z`);
      return paidAt >= cutoff && paidAt <= referenceDate;
    })
    .reduce((total, payment) => total + payment.rate, 0);
}

/**
 * Consistência das distribuições nos últimos cinco anos: conta quantos desses
 * anos tiveram algum provento pago.
 */
function calculateDividendHistoryScore(
  payments: DividendPayment[],
  referenceDate: Date,
): { score: number | null; label: string | null } {
  const currentYear = referenceDate.getUTCFullYear();
  const consideredYears = [1, 2, 3, 4, 5].map((offset) => currentYear - offset);
  const paidYears = new Set(
    payments
      .filter((payment) => payment.paymentDate)
      .map((payment) => Number.parseInt(payment.paymentDate!.slice(0, 4), 10)),
  );

  if (paidYears.size === 0) {
    return { score: 0, label: "Sem distribuição" };
  }

  const yearsWithPayment = consideredYears.filter((year) =>
    paidYears.has(year),
  ).length;
  const score = round((yearsWithPayment / consideredYears.length) * 100, 1);

  return {
    score,
    label: score >= 80 ? "Constante" : score >= 40 ? "Irregular" : "Raro",
  };
}

interface AnnualStatement {
  endDate: string;
  value: number | null;
}

function readAnnualSeries(
  statements: Array<Record<string, unknown>> | null | undefined,
  key: string,
): AnnualStatement[] {
  return (statements ?? [])
    .filter((statement) => statement.type === "yearly")
    .map((statement) => ({
      endDate: typeof statement.endDate === "string" ? statement.endDate : "",
      value: readNumber(statement, key),
    }))
    .filter((statement) => statement.endDate)
    .sort((first, second) => first.endDate.localeCompare(second.endDate));
}

/**
 * CAGR do lucro líquido em cinco exercícios. Base inicial nula ou negativa
 * devolve `null`: a taxa não tem significado econômico nesse caso, e estimar
 * seria inventar dado.
 */
function calculateProfitGrowthFiveYears(
  detail: BrapiAssetDetail,
): number | null {
  const netIncomeSeries = readAnnualSeries(
    detail.incomeStatementHistory,
    "netIncome",
  ).filter((statement) => statement.value !== null);

  const latest = netIncomeSeries.at(-1);

  if (!latest?.value || latest.value <= 0) {
    return null;
  }

  const latestYear = Number.parseInt(latest.endDate.slice(0, 4), 10);
  // O intervalo vem da diferença entre exercícios, não da posição no array: uma
  // lacuna na série anual distorceria a taxa sem qualquer sinal.
  const baseline = netIncomeSeries.find(
    (statement) => Number.parseInt(statement.endDate.slice(0, 4), 10) === latestYear - 5,
  );

  if (!baseline?.value || baseline.value <= 0) {
    return null;
  }

  const growthRate = (latest.value / baseline.value) ** (1 / 5) - 1;
  return Number.isFinite(growthRate) ? round(growthRate * 100) : null;
}

/**
 * ROIC = NOPAT / capital investido. Usa a alíquota efetiva do próprio exercício
 * quando ela é plausível, e cai para 34% (IRPJ + CSLL) quando não é.
 */
function calculateRoic(detail: BrapiAssetDetail): number | null {
  const operatingIncome = readAnnualSeries(
    detail.incomeStatementHistory,
    "operatingIncome",
  ).at(-1);
  const incomeBeforeTax = readAnnualSeries(
    detail.incomeStatementHistory,
    "incomeBeforeTax",
  ).at(-1);
  const incomeTaxExpense = readAnnualSeries(
    detail.incomeStatementHistory,
    "incomeTaxExpense",
  ).at(-1);
  const totalEquity = readAnnualSeries(
    detail.balanceSheetHistory,
    "totalStockholderEquity",
  ).at(-1);
  const totalDebt = readNumber(detail.financialData, "totalDebt");
  const totalCash = readNumber(detail.financialData, "totalCash");

  if (!operatingIncome?.value || !totalEquity?.value || totalDebt === null) {
    return null;
  }

  const investedCapital = totalEquity.value + totalDebt - (totalCash ?? 0);

  if (investedCapital <= 0) {
    return null;
  }

  let taxRate = 0.34;

  if (incomeBeforeTax?.value && incomeTaxExpense?.value) {
    const effectiveRate = Math.abs(incomeTaxExpense.value / incomeBeforeTax.value);
    if (effectiveRate > 0 && effectiveRate < 0.6) {
      taxRate = effectiveRate;
    }
  }

  const nopat = operatingIncome.value * (1 - taxRate);
  return round((nopat / investedCapital) * 100);
}

/**
 * Liquidez média diária em centavos, a partir dos últimos pregões da série
 * histórica.
 */
function calculateAverageDailyLiquidityCents(
  detail: BrapiAssetDetail,
  sessions = 60,
): number | null {
  const recentSessions = (detail.historicalDataPrice ?? [])
    .filter(
      (session) =>
        typeof session.close === "number" && typeof session.volume === "number",
    )
    .slice(-sessions);

  if (recentSessions.length === 0) {
    return null;
  }

  const averageFinancialVolume =
    recentSessions.reduce(
      (total, session) => total + (session.close ?? 0) * (session.volume ?? 0),
      0,
    ) / recentSessions.length;

  return Math.round(averageFinancialVolume * 100);
}

function calculateNetDebtToEbitda(detail: BrapiAssetDetail): number | null {
  const totalDebt = readNumber(detail.financialData, "totalDebt");
  const totalCash = readNumber(detail.financialData, "totalCash");
  const ebitda = readNumber(detail.financialData, "ebitda");

  if (totalDebt === null || ebitda === null || ebitda <= 0) {
    return null;
  }

  return round((totalDebt - (totalCash ?? 0)) / ebitda);
}

export interface StockMetricsResult {
  metrics: StockMetrics;
  dividends: DividendPayment[];
}

/** Métricas fundamentalistas de uma ação a partir do payload do brapi. */
export function deriveStockMetrics(
  detail: BrapiAssetDetail,
  referenceDate = new Date(),
): StockMetricsResult {
  const dividends = extractDividendPayments(detail);
  const price = detail.regularMarketPrice ?? null;
  const trailingDividends = sumTrailingDividends(dividends, referenceDate, 12);
  const dividendYield =
    price && price > 0 && trailingDividends > 0
      ? round((trailingDividends / price) * 100)
      : null;
  const earningsPerShare =
    detail.earningsPerShare ??
    readNumber(detail.defaultKeyStatistics, "trailingEps");
  const payout =
    earningsPerShare && earningsPerShare > 0 && trailingDividends > 0
      ? round((trailingDividends / earningsPerShare) * 100)
      : null;
  const { score: dividendHistoryScore, label: dividendHistoryLabel } =
    calculateDividendHistoryScore(dividends, referenceDate);
  const averageDailyLiquidityCents = calculateAverageDailyLiquidityCents(detail);

  return {
    metrics: {
      dividendYield,
      payout,
      roe: toPercentage(readNumber(detail.financialData, "returnOnEquity")),
      roic: calculateRoic(detail),
      netDebtToEbitda: calculateNetDebtToEbitda(detail),
      netMargin: toPercentage(readNumber(detail.financialData, "profitMargins")),
      profitGrowthFiveYears: calculateProfitGrowthFiveYears(detail),
      profitGrowthLabel: null,
      dividendHistoryScore,
      dividendHistoryLabel,
      averageDailyLiquidityCents,
      liquidityScore: null,
      liquidityLabel: null,
    },
    dividends,
  };
}
