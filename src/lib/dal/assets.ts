import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  asset,
  assetDividend,
  assetFundamentalSnapshot,
  fiiMetric,
  stockMetric,
} from "@/db/schema";
import {
  calculateMetricPercentiles,
  type AssetMetricPercentiles,
} from "@/lib/calculations/score";
import type { BrapiAssetDetail } from "@/lib/market-data/brapi-detail";
import { refreshAssetFundamentals } from "@/lib/market-data/refresh";
import type {
  AssetDividendEntry,
  AssetPricePoint,
  AssetType,
  LiveQuote,
  MarketAsset,
} from "@/types/investment";

const calculationVersion = "score-v2";

/** Idade máxima dos fundamentos antes de valer a pena gastar uma requisição. */
const fundamentalsMaxAgeMs = 24 * 60 * 60 * 1_000;

/**
 * Última cotação de cada ativo. `DISTINCT ON` resolve no banco o que seria um
 * agrupamento caro em memória com mais de mil ativos.
 */
const latestQuote = sql`(
  select distinct on (q.asset_id)
    q.asset_id,
    q.price_cents,
    q.daily_volume_cents,
    q.change_percent,
    q.previous_close_cents,
    q.market_cap_cents,
    q.market_date,
    q.source_date
  from asset_quote q
  order by q.asset_id, q.market_date desc
)`;

interface AssetRow {
  id: string;
  ticker: string;
  name: string;
  type: AssetType;
  subType: string | null;
  sector: string | null;
  segment: string | null;
  logoUrl: string | null;
  source: string;
  sourceDate: Date;
  referencePeriod: string | null;
  priceCents: number | string | null;
  dailyVolumeCents: number | string | null;
  changePercent: number | null;
  previousCloseCents: number | string | null;
  marketCapCents: number | string | null;
  quotedAt: Date | string | null;
}

/** A subquery de cotação chega com o timestamp em string; o resto já vem Date. */
function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** O driver HTTP do Neon serializa bigint da subquery raw como string. */
function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMarketAsset(
  row: AssetRow,
  metrics: Partial<Pick<MarketAsset, "stockMetrics" | "fiiMetrics">>,
): MarketAsset {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    type: row.type,
    subType: row.subType,
    classification:
      (row.type === "STOCK" ? row.sector : row.segment) ?? "Não classificado",
    currentPriceCents: toNumber(row.priceCents) ?? 0,
    changePercent: row.changePercent,
    previousCloseCents: toNumber(row.previousCloseCents),
    marketCapCents: toNumber(row.marketCapCents),
    dailyVolumeCents: toNumber(row.dailyVolumeCents),
    logoUrl: row.logoUrl,
    quotedAt: toIsoString(row.quotedAt),
    source: row.source,
    sourceDate: toIsoString(row.sourceDate) ?? new Date().toISOString(),
    referencePeriod: row.referencePeriod ?? "Sem competência",
    calculationVersion,
    ...metrics,
  };
}

async function selectAssetRows(type?: AssetType): Promise<AssetRow[]> {
  const database = getDatabase();
  const rows = await database
    .select({
      id: asset.id,
      ticker: asset.ticker,
      name: asset.name,
      type: asset.type,
      subType: asset.subType,
      sector: asset.sector,
      segment: asset.segment,
      logoUrl: asset.logoUrl,
      source: asset.source,
      sourceDate: asset.sourceDate,
      referencePeriod: asset.referencePeriod,
      priceCents: sql<number | null>`latest_quote.price_cents`,
      dailyVolumeCents: sql<number | null>`latest_quote.daily_volume_cents`,
      changePercent: sql<number | null>`latest_quote.change_percent`,
      previousCloseCents: sql<number | null>`latest_quote.previous_close_cents`,
      marketCapCents: sql<number | null>`latest_quote.market_cap_cents`,
      quotedAt: sql<Date | null>`latest_quote.source_date`,
    })
    .from(asset)
    .leftJoin(sql`${latestQuote} as latest_quote`, sql`latest_quote.asset_id = ${asset.id}`)
    .where(type ? and(eq(asset.active, true), eq(asset.type, type)) : eq(asset.active, true))
    .orderBy(asset.ticker);

  return rows as AssetRow[];
}

async function selectStockMetrics(): Promise<Map<string, MarketAsset["stockMetrics"]>> {
  const rows = await getDatabase()
    .select()
    .from(stockMetric)
    .where(eq(stockMetric.calculationVersion, calculationVersion))
    .orderBy(desc(stockMetric.referencePeriod));
  const metricsByAssetId = new Map<string, MarketAsset["stockMetrics"]>();

  for (const row of rows) {
    if (metricsByAssetId.has(row.assetId)) {
      continue;
    }
    metricsByAssetId.set(row.assetId, {
      dividendYield: row.dividendYield,
      payout: row.payout,
      roe: row.roe,
      roic: row.roic,
      netDebtToEbitda: row.netDebtToEbitda,
      netMargin: row.netMargin,
      profitGrowthFiveYears: row.profitGrowthFiveYears,
      profitGrowthLabel: row.profitGrowthLabel,
      dividendHistoryScore: row.dividendHistoryScore,
      dividendHistoryLabel: row.dividendHistoryLabel,
      averageDailyLiquidityCents: row.averageDailyLiquidityCents,
      liquidityLabel: row.liquidityLabel,
    });
  }

  return metricsByAssetId;
}

async function selectFiiMetrics(): Promise<Map<string, MarketAsset["fiiMetrics"]>> {
  const rows = await getDatabase()
    .select()
    .from(fiiMetric)
    .where(eq(fiiMetric.calculationVersion, calculationVersion))
    .orderBy(desc(fiiMetric.referencePeriod));
  const metricsByAssetId = new Map<string, MarketAsset["fiiMetrics"]>();

  for (const row of rows) {
    if (metricsByAssetId.has(row.assetId)) {
      continue;
    }
    metricsByAssetId.set(row.assetId, {
      priceToBook: row.priceToBook,
      dividendYieldTwelveMonths: row.dividendYieldTwelveMonths,
      incomeRegularityScore: row.incomeRegularityScore,
      averageDailyLiquidityCents: row.averageDailyLiquidityCents,
      riskScore: row.riskScore,
      riskLabel: row.riskLabel,
      vacancyRate: row.vacancyRate,
      ageYears: row.ageYears,
      lastMonthlyDividendCents: row.lastDividendCents,
    });
  }

  return metricsByAssetId;
}

export interface MarketAssetListing {
  assets: MarketAsset[];
  /** Percentis prontos, para o cliente só aplicar os pesos do perfil. */
  percentiles: AssetMetricPercentiles[];
}

/**
 * Lista completa de ativos de um tipo, com a última cotação e os percentis já
 * calculados.
 *
 * O cálculo de percentil roda aqui porque ordena os pares de cada métrica: com
 * centenas de ativos, refazer isso no cliente a cada troca de perfil travaria a
 * interface.
 */
export async function listMarketAssets(
  type: AssetType,
): Promise<MarketAssetListing> {
  const [rows, stockMetricsByAssetId, fiiMetricsByAssetId] = await Promise.all([
    selectAssetRows(type),
    type === "STOCK" ? selectStockMetrics() : Promise.resolve(new Map()),
    type === "FII" ? selectFiiMetrics() : Promise.resolve(new Map()),
  ]);
  const assets = rows.map((row) =>
    toMarketAsset(
      row,
      row.type === "STOCK"
        ? { stockMetrics: stockMetricsByAssetId.get(row.id) }
        : { fiiMetrics: fiiMetricsByAssetId.get(row.id) },
    ),
  );

  return {
    assets,
    percentiles: [...calculateMetricPercentiles(assets).values()],
  };
}

/** Ativos avulsos por ticker, para carteira, favoritos e importação. */
export async function getMarketAssetsByTickers(
  tickers: string[],
): Promise<MarketAsset[]> {
  if (tickers.length === 0) {
    return [];
  }

  const normalizedTickers = new Set(
    tickers.map((ticker) => ticker.trim().toUpperCase()),
  );
  const [rows, stockMetricsByAssetId, fiiMetricsByAssetId] = await Promise.all([
    selectAssetRows(),
    selectStockMetrics(),
    selectFiiMetrics(),
  ]);

  return rows
    .filter((row) => normalizedTickers.has(row.ticker))
    .map((row) =>
      toMarketAsset(
        row,
        row.type === "STOCK"
          ? { stockMetrics: stockMetricsByAssetId.get(row.id) }
          : { fiiMetrics: fiiMetricsByAssetId.get(row.id) },
      ),
    );
}

/** Preços atuais por ticker, usados pela carteira e pelo painel. */
export async function getCurrentPricesByTicker(): Promise<Record<string, number>> {
  const rows = await selectAssetRows();
  const pricesByTicker: Record<string, number> = {};

  for (const row of rows) {
    const priceCents = toNumber(row.priceCents);
    if (priceCents !== null) {
      pricesByTicker[row.ticker] = priceCents;
    }
  }

  return pricesByTicker;
}

/** Cotações enxutas para o polling da listagem. */
export async function listLiveQuotes(type: AssetType): Promise<LiveQuote[]> {
  const [rows, fiiMetricsByAssetId] = await Promise.all([
    selectAssetRows(type),
    // O rendimento por cota muda de competência, não intraday; incluí-lo aqui
    // deixa o polling refletir um novo anúncio sem exigir recarga da página.
    type === "FII" ? selectFiiMetrics() : Promise.resolve(new Map()),
  ]);

  return rows
    .map((row) => ({ row, priceCents: toNumber(row.priceCents) }))
    .filter(
      (entry): entry is { row: AssetRow; priceCents: number } =>
        entry.priceCents !== null,
    )
    .map(({ row, priceCents }) => ({
      ticker: row.ticker,
      priceCents,
      changePercent: row.changePercent,
      dailyVolumeCents: toNumber(row.dailyVolumeCents),
      quotedAt: toIsoString(row.quotedAt),
      lastMonthlyDividendCents:
        fiiMetricsByAssetId.get(row.id)?.lastMonthlyDividendCents ?? null,
    }));
}

export interface MarketAssetDetail {
  asset: MarketAsset;
  percentiles: AssetMetricPercentiles | null;
  peerPercentiles: AssetMetricPercentiles[];
  dividends: AssetDividendEntry[];
  priceHistory: AssetPricePoint[];
  businessSummary: string | null;
  website: string | null;
  fiftyTwoWeekLowCents: number | null;
  fiftyTwoWeekHighCents: number | null;
  fundamentalsFetchedAt: string | null;
  /** Preenchido quando os fundamentos não puderam ser carregados. */
  fundamentalsWarning: string | null;
}

function readSnapshotString(
  payload: Record<string, unknown> | null,
  section: string,
  key: string,
): string | null {
  const sectionValue = payload?.[section];

  if (!sectionValue || typeof sectionValue !== "object") {
    return null;
  }

  const value = (sectionValue as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readSnapshotNumber(
  payload: Record<string, unknown> | null,
  key: string,
): number | null {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractPriceHistory(
  payload: Record<string, unknown> | null,
): AssetPricePoint[] {
  const historical = payload?.historicalDataPrice;

  if (!Array.isArray(historical)) {
    return [];
  }

  return historical
    .map((entry) => {
      const point = entry as { date?: unknown; close?: unknown };
      if (typeof point.date !== "number" || typeof point.close !== "number") {
        return null;
      }
      return {
        date: new Date(point.date * 1_000).toISOString().slice(0, 10),
        closeCents: Math.round(point.close * 100),
      };
    })
    .filter((point): point is AssetPricePoint => point !== null)
    .sort((first, second) => first.date.localeCompare(second.date));
}

/**
 * Detalhe de um ativo com fundamentos.
 *
 * Quando os fundamentos estão velhos ou ausentes, busca no brapi na hora e
 * persiste. Uma falha aí não derruba a página: o detalhe é servido com o que há
 * no banco e um aviso explícito do que faltou.
 */
export async function getMarketAssetDetail(
  ticker: string,
  type: AssetType,
): Promise<MarketAssetDetail | null> {
  const database = getDatabase();
  const normalizedTicker = ticker.trim().toUpperCase();
  const assetRecord = await database.query.asset.findFirst({
    where: and(eq(asset.ticker, normalizedTicker), eq(asset.type, type)),
    columns: { id: true, fundamentalsRefreshedAt: true },
  });

  if (!assetRecord) {
    return null;
  }

  let fundamentalsWarning: string | null = null;
  const isStale =
    !assetRecord.fundamentalsRefreshedAt ||
    Date.now() - assetRecord.fundamentalsRefreshedAt.getTime() > fundamentalsMaxAgeMs;

  if (isStale) {
    try {
      await refreshAssetFundamentals({
        id: assetRecord.id,
        ticker: normalizedTicker,
        type,
      });
    } catch (error) {
      fundamentalsWarning =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar os fundamentos agora.";
    }
  }

  const listing = await listMarketAssets(type);
  const detailAsset = listing.assets.find(
    (listedAsset) => listedAsset.ticker === normalizedTicker,
  );

  if (!detailAsset) {
    return null;
  }

  const [snapshotRecord, dividendRecords] = await Promise.all([
    database.query.assetFundamentalSnapshot.findFirst({
      where: eq(assetFundamentalSnapshot.assetId, assetRecord.id),
    }),
    database
      .select()
      .from(assetDividend)
      .where(eq(assetDividend.assetId, assetRecord.id))
      .orderBy(desc(assetDividend.paymentDate))
      .limit(36),
  ]);
  const payload = (snapshotRecord?.payload ?? null) as
    | (Record<string, unknown> & Partial<BrapiAssetDetail>)
    | null;

  return {
    asset: detailAsset,
    percentiles:
      listing.percentiles.find(
        (entry) => entry.ticker === normalizedTicker,
      ) ?? null,
    peerPercentiles: listing.percentiles,
    dividends: dividendRecords.map((record) => ({
      paymentDate: record.paymentDate,
      lastDatePrior: record.lastDatePrior,
      rate: record.rate,
      label: record.label,
    })),
    priceHistory: extractPriceHistory(payload),
    businessSummary: readSnapshotString(
      payload,
      "summaryProfile",
      "longBusinessSummary",
    ),
    website: readSnapshotString(payload, "summaryProfile", "website"),
    fiftyTwoWeekLowCents: (() => {
      const value = readSnapshotNumber(payload, "fiftyTwoWeekLow");
      return value === null ? null : Math.round(value * 100);
    })(),
    fiftyTwoWeekHighCents: (() => {
      const value = readSnapshotNumber(payload, "fiftyTwoWeekHigh");
      return value === null ? null : Math.round(value * 100);
    })(),
    fundamentalsFetchedAt: snapshotRecord?.fetchedAt.toISOString() ?? null,
    fundamentalsWarning,
  };
}
