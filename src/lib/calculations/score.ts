import type {
  AssetType,
  FiiMetrics,
  MarketAsset,
  MetricAvailability,
  RiskProfile,
  ScoreBreakdown,
  ScoreContribution,
  StockMetrics,
} from "@/types/investment";

type Direction = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";

interface WeightedMetric {
  key: keyof StockMetrics | keyof FiiMetrics;
  label: string;
  weight: number;
  direction: Direction;
}

export const stockWeights: Record<RiskProfile, WeightedMetric[]> = {
  CONSERVATIVE: [
    { key: "dividendYield", label: "Dividend Yield", weight: 15, direction: "HIGHER_IS_BETTER" },
    { key: "payout", label: "Payout", weight: 10, direction: "HIGHER_IS_BETTER" },
    { key: "roe", label: "ROE", weight: 12, direction: "HIGHER_IS_BETTER" },
    { key: "roic", label: "ROIC", weight: 12, direction: "HIGHER_IS_BETTER" },
    { key: "netDebtToEbitda", label: "Dívida líquida/EBITDA", weight: 15, direction: "LOWER_IS_BETTER" },
    { key: "netMargin", label: "Margem líquida", weight: 8, direction: "HIGHER_IS_BETTER" },
    { key: "profitGrowthFiveYears", label: "Crescimento do lucro em 5 anos", weight: 8, direction: "HIGHER_IS_BETTER" },
    { key: "dividendHistoryScore", label: "Histórico de dividendos", weight: 12, direction: "HIGHER_IS_BETTER" },
    { key: "averageDailyLiquidityCents", label: "Liquidez média diária", weight: 8, direction: "HIGHER_IS_BETTER" },
  ],
  MODERATE: [
    { key: "dividendYield", label: "Dividend Yield", weight: 10, direction: "HIGHER_IS_BETTER" },
    { key: "payout", label: "Payout", weight: 8, direction: "HIGHER_IS_BETTER" },
    { key: "roe", label: "ROE", weight: 15, direction: "HIGHER_IS_BETTER" },
    { key: "roic", label: "ROIC", weight: 15, direction: "HIGHER_IS_BETTER" },
    { key: "netDebtToEbitda", label: "Dívida líquida/EBITDA", weight: 12, direction: "LOWER_IS_BETTER" },
    { key: "netMargin", label: "Margem líquida", weight: 10, direction: "HIGHER_IS_BETTER" },
    { key: "profitGrowthFiveYears", label: "Crescimento do lucro em 5 anos", weight: 15, direction: "HIGHER_IS_BETTER" },
    { key: "dividendHistoryScore", label: "Histórico de dividendos", weight: 8, direction: "HIGHER_IS_BETTER" },
    { key: "averageDailyLiquidityCents", label: "Liquidez média diária", weight: 7, direction: "HIGHER_IS_BETTER" },
  ],
  AGGRESSIVE: [
    { key: "dividendYield", label: "Dividend Yield", weight: 5, direction: "HIGHER_IS_BETTER" },
    { key: "payout", label: "Payout", weight: 5, direction: "HIGHER_IS_BETTER" },
    { key: "roe", label: "ROE", weight: 15, direction: "HIGHER_IS_BETTER" },
    { key: "roic", label: "ROIC", weight: 18, direction: "HIGHER_IS_BETTER" },
    { key: "netDebtToEbitda", label: "Dívida líquida/EBITDA", weight: 10, direction: "LOWER_IS_BETTER" },
    { key: "netMargin", label: "Margem líquida", weight: 10, direction: "HIGHER_IS_BETTER" },
    { key: "profitGrowthFiveYears", label: "Crescimento do lucro em 5 anos", weight: 25, direction: "HIGHER_IS_BETTER" },
    { key: "dividendHistoryScore", label: "Histórico de dividendos", weight: 5, direction: "HIGHER_IS_BETTER" },
    { key: "averageDailyLiquidityCents", label: "Liquidez média diária", weight: 7, direction: "HIGHER_IS_BETTER" },
  ],
};

export const fiiWeights: Record<RiskProfile, WeightedMetric[]> = {
  CONSERVATIVE: [
    { key: "priceToBook", label: "P/VP", weight: 15, direction: "LOWER_IS_BETTER" },
    { key: "dividendYieldTwelveMonths", label: "DY 12 meses", weight: 15, direction: "HIGHER_IS_BETTER" },
    { key: "incomeRegularityScore", label: "Regularidade dos rendimentos", weight: 20, direction: "HIGHER_IS_BETTER" },
    { key: "averageDailyLiquidityCents", label: "Liquidez", weight: 15, direction: "HIGHER_IS_BETTER" },
    { key: "riskScore", label: "Vacância / risco de crédito", weight: 25, direction: "HIGHER_IS_BETTER" },
    { key: "ageYears", label: "Idade e histórico do fundo", weight: 10, direction: "HIGHER_IS_BETTER" },
  ],
  MODERATE: [
    { key: "priceToBook", label: "P/VP", weight: 20, direction: "LOWER_IS_BETTER" },
    { key: "dividendYieldTwelveMonths", label: "DY 12 meses", weight: 20, direction: "HIGHER_IS_BETTER" },
    { key: "incomeRegularityScore", label: "Regularidade dos rendimentos", weight: 15, direction: "HIGHER_IS_BETTER" },
    { key: "averageDailyLiquidityCents", label: "Liquidez", weight: 15, direction: "HIGHER_IS_BETTER" },
    { key: "riskScore", label: "Vacância / risco de crédito", weight: 20, direction: "HIGHER_IS_BETTER" },
    { key: "ageYears", label: "Idade e histórico do fundo", weight: 10, direction: "HIGHER_IS_BETTER" },
  ],
  AGGRESSIVE: [
    { key: "priceToBook", label: "P/VP", weight: 25, direction: "LOWER_IS_BETTER" },
    { key: "dividendYieldTwelveMonths", label: "DY 12 meses", weight: 25, direction: "HIGHER_IS_BETTER" },
    { key: "incomeRegularityScore", label: "Regularidade dos rendimentos", weight: 10, direction: "HIGHER_IS_BETTER" },
    { key: "averageDailyLiquidityCents", label: "Liquidez", weight: 10, direction: "HIGHER_IS_BETTER" },
    { key: "riskScore", label: "Vacância / risco de crédito", weight: 20, direction: "HIGHER_IS_BETTER" },
    { key: "ageYears", label: "Idade e histórico do fundo", weight: 10, direction: "HIGHER_IS_BETTER" },
  ],
};

const financialClassificationTerms = ["banco", "bancos", "seguro", "seguros"];

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isFinancialInstitution(classification: string): boolean {
  const normalizedClassification = normalizeText(classification);
  return financialClassificationTerms.some((term) =>
    normalizedClassification.includes(term),
  );
}

function roundScore(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}

/**
 * Índice do primeiro elemento de um array ascendente que não é menor que o alvo.
 * Equivale a contar quantos valores são estritamente menores que o alvo.
 */
function countBelow(sortedValues: number[], target: number): number {
  let low = 0;
  let high = sortedValues.length;

  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sortedValues[middle] < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

/**
 * Índice do primeiro elemento maior que o alvo. A diferença para countBelow é a
 * quantidade de valores iguais ao alvo.
 */
function countAtOrBelow(sortedValues: number[], target: number): number {
  let low = 0;
  let high = sortedValues.length;

  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sortedValues[middle] <= target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function calculatePercentileFromSorted(
  value: number,
  sortedPeerValues: number[],
  direction: Direction,
): number {
  if (sortedPeerValues.length <= 1) {
    return 50;
  }

  const lowerValues = countBelow(sortedPeerValues, value);
  const equalValues = countAtOrBelow(sortedPeerValues, value) - lowerValues;
  const rank = lowerValues + Math.max(0, equalValues - 1) / 2;
  const ascendingPercentile = (rank / (sortedPeerValues.length - 1)) * 100;

  return roundScore(
    direction === "HIGHER_IS_BETTER"
      ? ascendingPercentile
      : 100 - ascendingPercentile,
  );
}

export function calculatePercentileScore(
  value: number,
  peerValues: number[],
  direction: Direction,
): number {
  return calculatePercentileFromSorted(
    value,
    [...peerValues].sort((first, second) => first - second),
    direction,
  );
}

function calculatePayoutScore(payout: number): number {
  if (payout < 0 || payout > 150) {
    return 0;
  }
  if (payout >= 30 && payout <= 70) {
    return 100;
  }
  if (payout < 30) {
    return roundScore((payout / 30) * 100);
  }
  return roundScore(100 - ((payout - 70) / 80) * 100);
}

function resolveStockMetricValue(
  metrics: StockMetrics,
  key: keyof StockMetrics,
): number | null {
  if (key === "profitGrowthFiveYears") {
    if (metrics.profitGrowthFiveYears !== null) {
      return metrics.profitGrowthFiveYears;
    }
    const growthScores: Record<string, number> = {
      baixo: 25,
      estavel: 45,
      moderado: 60,
      alto: 90,
    };
    return growthScores[normalizeText(metrics.profitGrowthLabel ?? "")] ?? null;
  }

  if (key === "averageDailyLiquidityCents") {
    if (metrics.averageDailyLiquidityCents !== null) {
      return metrics.averageDailyLiquidityCents;
    }
    if (metrics.liquidityScore !== null && metrics.liquidityScore !== undefined) {
      return metrics.liquidityScore;
    }
    const liquidityScores: Record<string, number> = { baixa: 25, media: 60, alta: 90 };
    return liquidityScores[normalizeText(metrics.liquidityLabel ?? "")] ?? null;
  }

  const metricValue = metrics[key];
  return typeof metricValue === "number" ? metricValue : null;
}

function resolveFiiMetricValue(
  metrics: FiiMetrics,
  key: keyof FiiMetrics,
): number | null {
  const metricValue = metrics[key];
  return typeof metricValue === "number" ? metricValue : null;
}

function resolveMetricValue(
  asset: MarketAsset,
  key: keyof StockMetrics | keyof FiiMetrics,
): number | null {
  if (asset.type === "STOCK") {
    return asset.stockMetrics
      ? resolveStockMetricValue(asset.stockMetrics, key as keyof StockMetrics)
      : null;
  }
  return asset.fiiMetrics
    ? resolveFiiMetricValue(asset.fiiMetrics, key as keyof FiiMetrics)
    : null;
}

function getPeerAssets(asset: MarketAsset, assets: MarketAsset[]): MarketAsset[] {
  const sameClassificationAssets = assets.filter(
    (peerAsset) =>
      peerAsset.type === asset.type &&
      normalizeText(peerAsset.classification) === normalizeText(asset.classification),
  );

  if (sameClassificationAssets.length >= 3) {
    return sameClassificationAssets;
  }

  return assets.filter((peerAsset) => peerAsset.type === asset.type);
}

/**
 * Percentil já normalizado de uma métrica, sem os pesos do perfil de risco
 * aplicados. É a metade cara do cálculo e não depende do perfil, então roda uma
 * vez no servidor e é reaproveitada para os três perfis no cliente.
 */
export interface MetricPercentile {
  metric: string;
  normalizedScore: number | null;
  availability: MetricAvailability;
  explanation: string;
}

export interface AssetMetricPercentiles {
  ticker: string;
  type: AssetType;
  metrics: Record<string, MetricPercentile>;
  /** Valores brutos que o teto de risco dos FIIs consulta. */
  riskScoreValue: number | null;
  incomeRegularityValue: number | null;
}

/** Chaves avaliadas por tipo de ativo. Os pesos mudam por perfil, as chaves não. */
const metricKeysByType: Record<AssetType, WeightedMetric[]> = {
  STOCK: stockWeights.MODERATE,
  FII: fiiWeights.MODERATE,
};

export function calculateMetricPercentiles(
  assets: MarketAsset[],
): Map<string, AssetMetricPercentiles> {
  interface PeerGroup {
    key: string;
    peers: MarketAsset[];
    isSectorGroup: boolean;
  }

  const peerGroupCache = new Map<string, PeerGroup>();
  const sortedValuesCache = new Map<string, number[]>();
  const result = new Map<string, AssetMetricPercentiles>();

  function getPeerGroup(asset: MarketAsset): PeerGroup {
    const classificationKey = `${asset.type}|${normalizeText(asset.classification)}`;
    const cachedGroup = peerGroupCache.get(classificationKey);

    if (cachedGroup) {
      return cachedGroup;
    }

    const peers = getPeerAssets(asset, assets);
    // Quando a amostra setorial é pequena, getPeerAssets devolve toda a classe do
    // ativo. Esses casos compartilham uma única lista ordenada por métrica.
    const isSectorGroup =
      peers.length >= 3 &&
      peers.every(
        (peerAsset) =>
          normalizeText(peerAsset.classification) ===
          normalizeText(asset.classification),
      );
    const group: PeerGroup = {
      key: isSectorGroup ? classificationKey : `${asset.type}|__ALL__`,
      peers,
      isSectorGroup,
    };

    peerGroupCache.set(classificationKey, group);
    return group;
  }

  function getSortedValues(
    groupKey: string,
    peers: MarketAsset[],
    metricKey: keyof StockMetrics | keyof FiiMetrics,
  ): number[] {
    const cacheKey = `${groupKey}|${String(metricKey)}`;
    const cachedValues = sortedValuesCache.get(cacheKey);

    if (cachedValues) {
      return cachedValues;
    }

    const values = peers
      .map((peerAsset) => resolveMetricValue(peerAsset, metricKey))
      .filter((peerValue): peerValue is number => peerValue !== null)
      .sort((first, second) => first - second);

    sortedValuesCache.set(cacheKey, values);
    return values;
  }

  for (const asset of assets) {
    const weightedMetrics = metricKeysByType[asset.type];
    const hasMetrics =
      asset.type === "STOCK" ? Boolean(asset.stockMetrics) : Boolean(asset.fiiMetrics);

    if (!hasMetrics) {
      result.set(asset.ticker, {
        ticker: asset.ticker,
        type: asset.type,
        metrics: {},
        riskScoreValue: null,
        incomeRegularityValue: null,
      });
      continue;
    }

    const { key: groupKey, peers, isSectorGroup } = getPeerGroup(asset);
    const explanation = isSectorGroup
      ? `Comparado com ${peers.length} ativos do mesmo setor ou segmento.`
      : `Amostra setorial pequena; comparado com ${peers.length} ativos da mesma classe.`;
    const metrics: Record<string, MetricPercentile> = {};

    for (const weightedMetric of weightedMetrics) {
      const metricKey = String(weightedMetric.key);
      const notApplicable =
        asset.type === "STOCK" &&
        isFinancialInstitution(asset.classification) &&
        (weightedMetric.key === "roic" || weightedMetric.key === "netDebtToEbitda");

      if (notApplicable) {
        metrics[metricKey] = {
          metric: metricKey,
          normalizedScore: null,
          availability: "NOT_APPLICABLE",
          explanation: "Não aplicável a bancos e seguradoras.",
        };
        continue;
      }

      const value = resolveMetricValue(asset, weightedMetric.key);

      if (value === null || !Number.isFinite(value)) {
        metrics[metricKey] = {
          metric: metricKey,
          normalizedScore: null,
          availability: "MISSING",
          explanation: "Dado não disponível na fonte informada.",
        };
        continue;
      }

      metrics[metricKey] = {
        metric: metricKey,
        normalizedScore:
          weightedMetric.key === "payout"
            ? calculatePayoutScore(value)
            : calculatePercentileFromSorted(
                value,
                getSortedValues(groupKey, peers, weightedMetric.key),
                weightedMetric.direction,
              ),
        availability: "AVAILABLE",
        explanation,
      };
    }

    result.set(asset.ticker, {
      ticker: asset.ticker,
      type: asset.type,
      metrics,
      riskScoreValue: asset.fiiMetrics?.riskScore ?? null,
      incomeRegularityValue: asset.fiiMetrics?.incomeRegularityScore ?? null,
    });
  }

  return result;
}

/**
 * Metade barata do cálculo: aplica os pesos do perfil sobre percentis prontos.
 * Roda no cliente a cada troca de perfil de risco.
 */
export function applyProfileWeights(
  percentiles: AssetMetricPercentiles,
  profile: RiskProfile,
): ScoreBreakdown {
  const weightedMetrics =
    percentiles.type === "STOCK" ? stockWeights[profile] : fiiWeights[profile];
  let applicableWeight = 0;
  let availableWeight = 0;
  let weightedScore = 0;

  const contributions: ScoreContribution[] = weightedMetrics.map((weightedMetric) => {
    const metricKey = String(weightedMetric.key);
    const percentile = percentiles.metrics[metricKey];

    if (!percentile || percentile.availability === "NOT_APPLICABLE") {
      return {
        metric: metricKey,
        label: weightedMetric.label,
        weight: weightedMetric.weight,
        normalizedScore: null,
        contribution: 0,
        availability: percentile?.availability ?? "MISSING",
        explanation:
          percentile?.explanation ?? "Dado não disponível na fonte informada.",
      };
    }

    applicableWeight += weightedMetric.weight;

    if (percentile.availability === "MISSING" || percentile.normalizedScore === null) {
      return {
        metric: metricKey,
        label: weightedMetric.label,
        weight: weightedMetric.weight,
        normalizedScore: null,
        contribution: 0,
        availability: "MISSING",
        explanation: percentile.explanation,
      };
    }

    availableWeight += weightedMetric.weight;
    const contribution = (percentile.normalizedScore * weightedMetric.weight) / 100;
    weightedScore += contribution;

    return {
      metric: metricKey,
      label: weightedMetric.label,
      weight: weightedMetric.weight,
      normalizedScore: percentile.normalizedScore,
      contribution: roundScore(contribution),
      availability: "AVAILABLE",
      explanation: percentile.explanation,
    };
  });

  if (Object.keys(percentiles.metrics).length === 0) {
    return {
      ticker: percentiles.ticker,
      score: null,
      confidence: 0,
      eligibleForRanking: false,
      contributions: [],
    };
  }

  const confidence =
    applicableWeight === 0 ? 0 : roundScore((availableWeight / applicableWeight) * 100);
  let finalScore =
    availableWeight === 0 ? null : roundScore((weightedScore / availableWeight) * 100);

  if (
    percentiles.type === "FII" &&
    finalScore !== null &&
    ((percentiles.riskScoreValue ?? 100) < 30 ||
      (percentiles.incomeRegularityValue ?? 100) < 30)
  ) {
    finalScore = Math.min(finalScore, 45);
  }

  return {
    ticker: percentiles.ticker,
    score: finalScore,
    confidence,
    eligibleForRanking: confidence >= 60,
    contributions,
  };
}

export function calculateAssetScore(
  asset: MarketAsset,
  profile: RiskProfile,
  assets: MarketAsset[],
): ScoreBreakdown {
  const percentiles = calculateMetricPercentiles(assets).get(asset.ticker);

  if (!percentiles) {
    return {
      ticker: asset.ticker,
      score: null,
      confidence: 0,
      eligibleForRanking: false,
      contributions: [],
    };
  }

  return applyProfileWeights(percentiles, profile);
}

export function rankAssets(
  assets: MarketAsset[],
  profile: RiskProfile,
): Array<{ asset: MarketAsset; breakdown: ScoreBreakdown }> {
  const percentilesByTicker = calculateMetricPercentiles(assets);

  return assets
    .map((asset) => {
      const percentiles = percentilesByTicker.get(asset.ticker);
      return {
        asset,
        breakdown: percentiles
          ? applyProfileWeights(percentiles, profile)
          : {
              ticker: asset.ticker,
              score: null,
              confidence: 0,
              eligibleForRanking: false,
              contributions: [],
            },
      };
    })
    .sort((firstAsset, secondAsset) => {
      if (firstAsset.breakdown.eligibleForRanking !== secondAsset.breakdown.eligibleForRanking) {
        return firstAsset.breakdown.eligibleForRanking ? -1 : 1;
      }
      return (secondAsset.breakdown.score ?? -1) - (firstAsset.breakdown.score ?? -1);
    });
}
