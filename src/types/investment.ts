export type AssetType = "STOCK" | "FII";
export type RiskProfile = "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";

export interface StockMetrics {
  dividendYield: number | null;
  payout: number | null;
  roe: number | null;
  roic: number | null;
  netDebtToEbitda: number | null;
  netMargin: number | null;
  profitGrowthFiveYears: number | null;
  profitGrowthLabel?: string | null;
  dividendHistoryScore: number | null;
  dividendHistoryLabel?: string | null;
  averageDailyLiquidityCents: number | null;
  liquidityScore?: number | null;
  liquidityLabel?: string | null;
}

export interface FiiMetrics {
  priceToBook: number | null;
  dividendYieldTwelveMonths: number | null;
  incomeRegularityScore: number | null;
  averageDailyLiquidityCents: number | null;
  riskScore: number | null;
  riskLabel?: string | null;
  vacancyRate: number | null;
  ageYears: number | null;
  /** Último rendimento mensal declarado, em centavos por cota. */
  lastMonthlyDividendCents?: number | null;
}

export interface MarketAsset {
  id: string;
  ticker: string;
  name: string;
  type: AssetType;
  subType?: string | null;
  classification: string;
  currentPriceCents: number;
  /** Variação percentual do dia, como o brapi entrega. */
  changePercent?: number | null;
  previousCloseCents?: number | null;
  marketCapCents?: number | null;
  dailyVolumeCents?: number | null;
  logoUrl?: string | null;
  /** Momento da cotação usada, para exibir a defasagem ao usuário. */
  quotedAt?: string | null;
  source: string;
  sourceDate: string;
  referencePeriod: string;
  calculationVersion: string;
  stockMetrics?: StockMetrics;
  fiiMetrics?: FiiMetrics;
}

/** Cotação servida ao polling da listagem; não carrega fundamentos. */
export interface LiveQuote {
  ticker: string;
  priceCents: number;
  changePercent: number | null;
  dailyVolumeCents: number | null;
  quotedAt: string | null;
  /** Rendimento mensal do FII, incluído para refletir mudança de competência. */
  lastMonthlyDividendCents?: number | null;
}

export interface AssetDividendEntry {
  paymentDate: string | null;
  lastDatePrior: string | null;
  rate: number;
  label: string;
}

export interface AssetPricePoint {
  date: string;
  closeCents: number;
}

export type MetricAvailability = "AVAILABLE" | "MISSING" | "NOT_APPLICABLE";

export interface ScoreContribution {
  metric: string;
  label: string;
  weight: number;
  normalizedScore: number | null;
  contribution: number;
  availability: MetricAvailability;
  explanation: string;
}

export interface ScoreBreakdown {
  ticker: string;
  score: number | null;
  confidence: number;
  eligibleForRanking: boolean;
  contributions: ScoreContribution[];
}

export type PortfolioTransactionType =
  | "COMPRA"
  | "VENDA"
  | "DIVIDENDO"
  | "JCP"
  | "RENDIMENTO_FII"
  | "AMORTIZACAO";

export interface PortfolioTransaction {
  id: string;
  ticker: string;
  assetType: AssetType;
  type: PortfolioTransactionType;
  operationDate: string;
  quantity: number;
  unitPriceCents: number;
  feesCents: number;
  taxesCents: number;
  valueCents: number;
  broker?: string;
  notes?: string;
}

export interface PortfolioPosition {
  ticker: string;
  assetType: AssetType;
  quantity: number;
  averagePriceCents: number;
  costBasisCents: number;
  realizedResultCents: number;
  incomeCents: number;
  amortizationCents: number;
  feesCents: number;
  taxesCents: number;
}

export interface PortfolioSummary {
  positions: PortfolioPosition[];
  totalCostBasisCents: number;
  totalMarketValueCents: number;
  realizedResultCents: number;
  unrealizedResultCents: number;
  incomeCents: number;
  feesCents: number;
  taxesCents: number;
  totalResultCents: number;
}

export type PlannerEntryType =
  | "RECEITA"
  | "DESPESA_MENSAL"
  | "DESPESA_ANUAL"
  | "INVESTIMENTO_PLANEJADO";

export interface PlannerEntry {
  id: string;
  type: PlannerEntryType;
  category: string;
  description?: string;
  amountCents: number;
  dueDate?: string;
  recurring: boolean;
}

export interface MonthlyFinancialPlan {
  id: string;
  referenceMonth: string;
  contributionPercentage: number;
  entries: PlannerEntry[];
  closedAt?: string;
}

export interface PlannerSummary {
  incomeCents: number;
  monthlyExpenseCents: number;
  annualExpenseCents: number;
  annualProvisionCents: number;
  availableMonthlyBalanceCents: number;
  suggestedContributionCents: number;
  plannedInvestmentCents: number;
  actualContributionCents: number;
}

export interface PortfolioImportRow {
  rowNumber: number;
  transaction: PortfolioTransaction | null;
  fingerprint: string | null;
  duplicate: boolean;
  errors: string[];
}
