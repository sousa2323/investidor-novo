import "server-only";

import { createHash } from "node:crypto";

import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { unzipSync } from "fflate";
import iconv from "iconv-lite";

import { getDatabase } from "@/db";
import {
  asset,
  assetDividend,
  assetFundamentalSnapshot,
  assetQuote,
  fiiMetric,
  ingestionRun,
  portfolio,
  portfolioSnapshot,
  portfolioTransaction,
  stockMetric,
} from "@/db/schema";
import { calculatePortfolioSummary } from "@/lib/calculations/portfolio";
import { buildFiiIsinMap, parseB3CotahistFile } from "@/lib/market-data/b3";
import {
  BrapiQuotaError,
  BrapiTokenError,
  fetchBrapiAssetDetail,
  type BrapiAssetDetail,
} from "@/lib/market-data/brapi-detail";
import { fetchBrapiUniverse } from "@/lib/market-data/brapi-universe";
import { downloadCvmArchive } from "@/lib/market-data/cvm";
import { fetchFundamentusIndicators } from "@/lib/market-data/fundamentus";
import {
  buildFiiRegistry,
  cvmFiiMonthlyUrl,
  indexFiiRegistryByTicker,
} from "@/lib/market-data/cvm-fii";
import { deriveFiiMetrics } from "@/lib/market-data/fii-metrics";
import { deriveStockMetrics } from "@/lib/market-data/stock-metrics";
import type { AssetType, PortfolioTransaction } from "@/types/investment";

const brapiSource = "brapi.dev";
const calculationVersion = "score-v2";

async function upsertQuote(
  assetId: string,
  quote: {
    priceCents: number;
    marketDate: string;
    source: string;
    sourceDate: Date;
    dailyVolumeCents?: number | null;
    changePercent?: number | null;
    previousCloseCents?: number | null;
    marketCapCents?: number | null;
  },
) {
  await getDatabase()
    .insert(assetQuote)
    .values({
      assetId,
      priceCents: quote.priceCents,
      dailyVolumeCents: quote.dailyVolumeCents,
      changePercent: quote.changePercent,
      previousCloseCents: quote.previousCloseCents,
      marketCapCents: quote.marketCapCents,
      marketDate: quote.marketDate,
      source: quote.source,
      sourceDate: quote.sourceDate,
    })
    .onConflictDoUpdate({
      target: [assetQuote.assetId, assetQuote.marketDate],
      set: {
        priceCents: quote.priceCents,
        dailyVolumeCents: quote.dailyVolumeCents,
        changePercent: quote.changePercent,
        previousCloseCents: quote.previousCloseCents,
        marketCapCents: quote.marketCapCents,
        source: quote.source,
        sourceDate: quote.sourceDate,
      },
    });
}

function currentMarketDate(): string {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = dateParts.find((datePart) => datePart.type === "year")?.value;
  const month = dateParts.find((datePart) => datePart.type === "month")?.value;
  const day = dateParts.find((datePart) => datePart.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Não foi possível determinar a data do snapshot.");
  }

  return `${year}-${month}-${day}`;
}

/**
 * Sincroniza o catálogo completo de ações e FIIs com o último preço conhecido.
 *
 * Usa a lista pública do brapi, que não consome cota de token, e é a rotina que
 * mantém as telas vivas durante o pregão.
 */
export async function syncBrapiUniverse(): Promise<{
  assets: number;
  quotes: number;
}> {
  const universeAssets = await fetchBrapiUniverse();
  const database = getDatabase();
  const marketDate = currentMarketDate();
  const sourceDate = new Date();
  let quoteCount = 0;

  // O insert vai em lotes: são mais de mil ativos e o driver HTTP do Neon tem
  // limite de tamanho por requisição.
  const batchSize = 200;

  for (let offset = 0; offset < universeAssets.length; offset += batchSize) {
    const batch = universeAssets.slice(offset, offset + batchSize);
    const assetRecords = await database
      .insert(asset)
      .values(
        batch.map((universeAsset) => ({
          ticker: universeAsset.ticker,
          type: universeAsset.type,
          subType: universeAsset.subType,
          name: universeAsset.name,
          sector: universeAsset.type === "STOCK" ? universeAsset.classification : null,
          segment: universeAsset.type === "FII" ? universeAsset.classification : null,
          logoUrl: universeAsset.logoUrl,
          source: brapiSource,
          sourceDate,
          referencePeriod: marketDate,
        })),
      )
      .onConflictDoUpdate({
        target: [asset.ticker, asset.type],
        set: {
          name: sql`excluded.name`,
          subType: sql`excluded.sub_type`,
          sector: sql`excluded.sector`,
          segment: sql`excluded.segment`,
          logoUrl: sql`excluded.logo_url`,
          source: sql`excluded.source`,
          sourceDate: sql`excluded.source_date`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: asset.id, ticker: asset.ticker });
    const assetIdByTicker = new Map(
      assetRecords.map((assetRecord) => [assetRecord.ticker, assetRecord.id]),
    );

    for (const universeAsset of batch) {
      const assetId = assetIdByTicker.get(universeAsset.ticker);

      if (!assetId || universeAsset.priceCents === null) {
        continue;
      }

      const previousCloseCents =
        universeAsset.changePercent !== null && universeAsset.changePercent !== -100
          ? Math.round(
              universeAsset.priceCents / (1 + universeAsset.changePercent / 100),
            )
          : null;

      await upsertQuote(assetId, {
        priceCents: universeAsset.priceCents,
        marketDate,
        source: brapiSource,
        sourceDate,
        dailyVolumeCents:
          universeAsset.volume === null ? null : universeAsset.volume * 100,
        changePercent: universeAsset.changePercent,
        previousCloseCents,
        marketCapCents: universeAsset.marketCapCents,
      });
      quoteCount += 1;
    }
  }

  return { assets: universeAssets.length, quotes: quoteCount };
}

/**
 * Preenche os indicadores de todas as ações a partir do fundamentus.
 *
 * É a fonte que faz o score da listagem funcionar sem o BRAPI_TOKEN: uma única
 * requisição cobre o universo. payout, dívida/EBITDA e histórico de dividendos
 * não constam nessa tabela e permanecem ausentes — o score os retira do
 * denominador em vez de estimar. O brapi, quando há token, enriquece o detalhe
 * com proventos e histórico de preço.
 */
export async function refreshStockFundamentalsFromFundamentus(): Promise<{
  matched: number;
  persisted: number;
}> {
  const database = getDatabase();
  const indicatorsByTicker = await fetchFundamentusIndicators();

  if (indicatorsByTicker.size === 0) {
    return { matched: 0, persisted: 0 };
  }

  const stockRecords = await database
    .select({ id: asset.id, ticker: asset.ticker })
    .from(asset)
    .where(eq(asset.type, "STOCK"));
  const referencePeriod = new Date().toISOString().slice(0, 7);
  const sourceDate = new Date();
  let persisted = 0;

  for (const stockRecord of stockRecords) {
    const indicators = indicatorsByTicker.get(stockRecord.ticker);

    if (!indicators) {
      continue;
    }

    // "Crescimento em 5 anos" no fundamentus é de receita, não de lucro; é uma
    // proxy razoável para a métrica de crescimento do score.
    const metricValues = {
      dividendYield: indicators.dividendYield,
      payout: null,
      roe: indicators.roe,
      roic: indicators.roic,
      netDebtToEbitda: null,
      netMargin: indicators.netMargin,
      profitGrowthFiveYears: indicators.revenueGrowthFiveYears,
      dividendHistoryScore: null,
      averageDailyLiquidityCents: indicators.averageDailyLiquidityCents,
    };

    await database
      .insert(stockMetric)
      .values({
        assetId: stockRecord.id,
        ...metricValues,
        profitGrowthLabel: null,
        dividendHistoryLabel: null,
        liquidityLabel: null,
        source: "fundamentus.com.br",
        sourceDate,
        referencePeriod,
        calculationVersion,
      })
      .onConflictDoUpdate({
        target: [
          stockMetric.assetId,
          stockMetric.referencePeriod,
          stockMetric.calculationVersion,
        ],
        set: { ...metricValues, source: "fundamentus.com.br", sourceDate },
      });
    persisted += 1;
  }

  return { matched: indicatorsByTicker.size, persisted };
}

async function persistStockFundamentals(
  assetId: string,
  detail: BrapiAssetDetail,
  referencePeriod: string,
) {
  const database = getDatabase();
  const { metrics, dividends } = deriveStockMetrics(detail);

  await database
    .insert(stockMetric)
    .values({
      assetId,
      dividendYield: metrics.dividendYield,
      payout: metrics.payout,
      roe: metrics.roe,
      roic: metrics.roic,
      netDebtToEbitda: metrics.netDebtToEbitda,
      netMargin: metrics.netMargin,
      profitGrowthFiveYears: metrics.profitGrowthFiveYears,
      profitGrowthLabel: metrics.profitGrowthLabel,
      dividendHistoryScore: metrics.dividendHistoryScore,
      dividendHistoryLabel: metrics.dividendHistoryLabel,
      averageDailyLiquidityCents: metrics.averageDailyLiquidityCents,
      liquidityLabel: metrics.liquidityLabel,
      source: brapiSource,
      sourceDate: new Date(),
      referencePeriod,
      calculationVersion,
    })
    .onConflictDoUpdate({
      target: [
        stockMetric.assetId,
        stockMetric.referencePeriod,
        stockMetric.calculationVersion,
      ],
      set: {
        dividendYield: metrics.dividendYield,
        payout: metrics.payout,
        roe: metrics.roe,
        roic: metrics.roic,
        netDebtToEbitda: metrics.netDebtToEbitda,
        netMargin: metrics.netMargin,
        profitGrowthFiveYears: metrics.profitGrowthFiveYears,
        dividendHistoryScore: metrics.dividendHistoryScore,
        dividendHistoryLabel: metrics.dividendHistoryLabel,
        averageDailyLiquidityCents: metrics.averageDailyLiquidityCents,
        sourceDate: new Date(),
      },
    });

  const datedDividends = dividends.filter((dividend) => dividend.paymentDate);

  if (datedDividends.length > 0) {
    await database
      .insert(assetDividend)
      .values(
        datedDividends.map((dividend) => ({
          assetId,
          paymentDate: dividend.paymentDate,
          lastDatePrior: dividend.lastDatePrior,
          rate: dividend.rate,
          label: dividend.label,
          source: brapiSource,
        })),
      )
      .onConflictDoNothing();
  }

  return metrics;
}

/**
 * Baixa e persiste os fundamentos de um ativo, guardando o payload bruto para
 * permitir reprocessar as derivações sem gastar cota de novo.
 */
export async function refreshAssetFundamentals(
  assetRecord: { id: string; ticker: string; type: AssetType },
): Promise<boolean> {
  const detail = await fetchBrapiAssetDetail(assetRecord.ticker);

  if (!detail) {
    return false;
  }

  const database = getDatabase();
  const fetchedAt = new Date();
  const referencePeriod = fetchedAt.toISOString().slice(0, 7);

  await database
    .insert(assetFundamentalSnapshot)
    .values({
      assetId: assetRecord.id,
      payload: detail as unknown as Record<string, unknown>,
      source: brapiSource,
      fetchedAt,
    })
    .onConflictDoUpdate({
      target: [assetFundamentalSnapshot.assetId],
      set: {
        payload: detail as unknown as Record<string, unknown>,
        source: brapiSource,
        fetchedAt,
      },
    });

  if (assetRecord.type === "STOCK") {
    await persistStockFundamentals(assetRecord.id, detail, referencePeriod);
  } else {
    // Para FIIs o brapi cobre preço, liquidez e proventos; P/VP, patrimônio e
    // idade vêm do informe mensal da CVM, gravados por refreshFiiFundamentals.
    const { dividends } = deriveStockMetrics(detail);
    const datedDividends = dividends.filter((dividend) => dividend.paymentDate);

    if (datedDividends.length > 0) {
      await database
        .insert(assetDividend)
        .values(
          datedDividends.map((dividend) => ({
            assetId: assetRecord.id,
            paymentDate: dividend.paymentDate,
            lastDatePrior: dividend.lastDatePrior,
            rate: dividend.rate,
            label: dividend.label,
            source: brapiSource,
          })),
        )
        .onConflictDoNothing();
    }
  }

  await database
    .update(asset)
    .set({ fundamentalsRefreshedAt: fetchedAt, updatedAt: fetchedAt })
    .where(eq(asset.id, assetRecord.id));

  return true;
}

/**
 * Preenche fundamentos dos ativos mais líquidos que ainda não têm dado recente.
 *
 * O plano gratuito do brapi aceita um ticker por chamada, então o limite existe
 * para manter o consumo mensal previsível.
 */
export async function refreshTopFundamentals(limit = 250): Promise<{
  processed: number;
  failures: number;
  quotaExhausted: boolean;
}> {
  const database = getDatabase();
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1_000);
  const candidates = await database
    .select({
      id: asset.id,
      ticker: asset.ticker,
      type: asset.type,
      dailyVolumeCents: assetQuote.dailyVolumeCents,
    })
    .from(asset)
    .innerJoin(assetQuote, eq(assetQuote.assetId, asset.id))
    .where(
      and(
        eq(asset.active, true),
        or(
          isNull(asset.fundamentalsRefreshedAt),
          lte(asset.fundamentalsRefreshedAt, staleThreshold),
        ),
      ),
    )
    .orderBy(desc(assetQuote.dailyVolumeCents))
    .limit(limit);
  let processed = 0;
  let failures = 0;

  for (const candidate of candidates) {
    try {
      const refreshed = await refreshAssetFundamentals(candidate);
      if (refreshed) {
        processed += 1;
      } else {
        failures += 1;
      }
    } catch (error) {
      if (error instanceof BrapiQuotaError || error instanceof BrapiTokenError) {
        // Sem cota ou sem token não adianta insistir nos próximos tickers.
        return { processed, failures, quotaExhausted: true };
      }
      failures += 1;
    }
  }

  return { processed, failures, quotaExhausted: false };
}

function formatB3DailyFilename(date: Date): string {
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return dateFormatter.format(date).replace(/\//g, "");
}

async function downloadCotahistRecords(date: Date) {
  const dateIdentifier = formatB3DailyFilename(date);
  const archiveUrl = `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D${dateIdentifier}.ZIP`;
  const response = await fetch(archiveUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    return null;
  }

  const archiveBytes = new Uint8Array(await response.arrayBuffer());
  const unzippedFiles = unzipSync(archiveBytes);
  const textEntry = Object.entries(unzippedFiles).find(([filename]) =>
    filename.toLowerCase().endsWith(".txt"),
  );

  if (!textEntry) {
    return null;
  }

  return parseB3CotahistFile(iconv.decode(Buffer.from(textEntry[1]), "latin1"));
}

/** Grava o ISIN de cada ativo, chave que liga o ticker da B3 ao CNPJ da CVM. */
async function syncIsinCodes(): Promise<number> {
  const database = getDatabase();

  for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - dayOffset);
    const records = await downloadCotahistRecords(targetDate);

    if (!records || records.length === 0) {
      continue;
    }

    const isinByTicker = new Map(
      records
        .filter((record) => record.isin)
        .map((record) => [record.ticker, record.isin]),
    );
    const assetRecords = await database
      .select({ id: asset.id, ticker: asset.ticker })
      .from(asset)
      .where(inArray(asset.ticker, [...isinByTicker.keys()]));
    let updated = 0;

    for (const assetRecord of assetRecords) {
      const isin = isinByTicker.get(assetRecord.ticker);

      if (!isin) {
        continue;
      }

      await database
        .update(asset)
        .set({ isin })
        .where(eq(asset.id, assetRecord.id));
      updated += 1;
    }

    return updated;
  }

  return 0;
}

/**
 * Métricas de FII a partir do informe mensal da CVM.
 *
 * Baixa o ano corrente e o anterior porque a janela de 12 meses do dividend
 * yield atravessa o ano civil, e liga CNPJ a ticker pelo ISIN do COTAHIST.
 */
export async function refreshFiiFundamentals(): Promise<{
  matched: number;
  persisted: number;
}> {
  const database = getDatabase();
  const currentYear = new Date().getFullYear();
  const archives = [];

  for (const year of [currentYear - 1, currentYear]) {
    try {
      archives.push(await downloadCvmArchive(cvmFiiMonthlyUrl(year)));
    } catch {
      // Um ano indisponível não impede o cálculo com o outro; o DY de 12 meses
      // simplesmente fica ausente quando a janela não fecha.
    }
  }

  if (archives.length === 0) {
    return { matched: 0, persisted: 0 };
  }

  let isinToTicker = new Map<string, string>();

  for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - dayOffset);
    const records = await downloadCotahistRecords(targetDate);

    if (records && records.length > 0) {
      isinToTicker = buildFiiIsinMap(records);
      break;
    }
  }

  const registryByTicker = indexFiiRegistryByTicker(
    buildFiiRegistry(archives),
    isinToTicker,
  );

  if (registryByTicker.size === 0) {
    return { matched: 0, persisted: 0 };
  }

  const fiiRecords = await database
    .select({
      id: asset.id,
      ticker: asset.ticker,
      priceCents: assetQuote.priceCents,
      dailyVolumeCents: assetQuote.dailyVolumeCents,
    })
    .from(asset)
    .leftJoin(assetQuote, eq(assetQuote.assetId, asset.id))
    .where(eq(asset.type, "FII"))
    .orderBy(desc(assetQuote.marketDate));
  const seenAssetIds = new Set<string>();
  const referencePeriod = new Date().toISOString().slice(0, 7);
  let persisted = 0;

  for (const fiiRecord of fiiRecords) {
    if (seenAssetIds.has(fiiRecord.id)) {
      continue;
    }
    seenAssetIds.add(fiiRecord.id);

    const registryEntry = registryByTicker.get(fiiRecord.ticker);

    if (!registryEntry) {
      continue;
    }

    const metrics = deriveFiiMetrics({
      priceCents: fiiRecord.priceCents,
      registryEntry,
      averageDailyLiquidityCents: fiiRecord.dailyVolumeCents,
    });
    const sourceDate = new Date();

    await database
      .insert(fiiMetric)
      .values({
        assetId: fiiRecord.id,
        priceToBook: metrics.priceToBook,
        dividendYieldTwelveMonths: metrics.dividendYieldTwelveMonths,
        incomeRegularityScore: metrics.incomeRegularityScore,
        averageDailyLiquidityCents: metrics.averageDailyLiquidityCents,
        riskScore: metrics.riskScore,
        riskLabel: metrics.riskLabel,
        vacancyRate: metrics.vacancyRate,
        ageYears: metrics.ageYears,
        lastDividendCents: metrics.lastMonthlyDividendCents,
        source: "CVM Informe Mensal FII",
        sourceDate,
        referencePeriod,
        calculationVersion,
      })
      .onConflictDoUpdate({
        target: [
          fiiMetric.assetId,
          fiiMetric.referencePeriod,
          fiiMetric.calculationVersion,
        ],
        set: {
          priceToBook: metrics.priceToBook,
          dividendYieldTwelveMonths: metrics.dividendYieldTwelveMonths,
          incomeRegularityScore: metrics.incomeRegularityScore,
          averageDailyLiquidityCents: metrics.averageDailyLiquidityCents,
          riskScore: metrics.riskScore,
          riskLabel: metrics.riskLabel,
          ageYears: metrics.ageYears,
          lastDividendCents: metrics.lastMonthlyDividendCents,
          sourceDate,
        },
      });

    // O CNPJ vem da CVM. O segmento oficial só substitui o do brapi quando é
    // específico: "Multicategoria" é o rótulo genérico que a CVM usa para muitos
    // fundos e agruparia ativos distintos sem critério.
    const specificSegment =
      registryEntry.segment &&
      registryEntry.segment.toLowerCase() !== "multicategoria"
        ? registryEntry.segment
        : undefined;

    await database
      .update(asset)
      .set({
        cnpj: registryEntry.cnpj,
        isin: registryEntry.isin,
        ...(specificSegment ? { segment: specificSegment } : {}),
      })
      .where(eq(asset.id, fiiRecord.id));

    persisted += 1;
  }

  return { matched: registryByTicker.size, persisted };
}

async function refreshPortfolioSnapshots(): Promise<number> {
  const database = getDatabase();
  const snapshotDate = currentMarketDate();
  const portfolioRecords = await database
    .select({ id: portfolio.id })
    .from(portfolio);
  const quoteRecords = await database
    .select({
      ticker: asset.ticker,
      priceCents: assetQuote.priceCents,
      marketDate: assetQuote.marketDate,
    })
    .from(assetQuote)
    .innerJoin(asset, eq(assetQuote.assetId, asset.id))
    .orderBy(desc(assetQuote.marketDate));
  const currentPricesCents: Record<string, number> = {};

  for (const quoteRecord of quoteRecords) {
    currentPricesCents[quoteRecord.ticker] ??= quoteRecord.priceCents;
  }

  for (const portfolioRecord of portfolioRecords) {
    const transactionRecords = await database
      .select({
        id: portfolioTransaction.id,
        ticker: portfolioTransaction.ticker,
        assetType: asset.type,
        type: portfolioTransaction.type,
        operationDate: portfolioTransaction.operationDate,
        quantity: portfolioTransaction.quantity,
        unitPriceCents: portfolioTransaction.unitPriceCents,
        feesCents: portfolioTransaction.feesCents,
        taxesCents: portfolioTransaction.taxesCents,
        valueCents: portfolioTransaction.valueCents,
      })
      .from(portfolioTransaction)
      .leftJoin(asset, eq(portfolioTransaction.assetId, asset.id))
      .where(
        and(
          eq(portfolioTransaction.portfolioId, portfolioRecord.id),
          lte(portfolioTransaction.operationDate, snapshotDate),
        ),
      )
      .orderBy(
        asc(portfolioTransaction.operationDate),
        asc(portfolioTransaction.createdAt),
      );
    const transactions: PortfolioTransaction[] = transactionRecords.map(
      (transactionRecord) => ({
        id: transactionRecord.id,
        ticker: transactionRecord.ticker,
        assetType: (transactionRecord.assetType ?? "STOCK") as AssetType,
        type: transactionRecord.type,
        operationDate: transactionRecord.operationDate,
        quantity: Number(transactionRecord.quantity),
        unitPriceCents: transactionRecord.unitPriceCents,
        feesCents: transactionRecord.feesCents,
        taxesCents: transactionRecord.taxesCents,
        valueCents: transactionRecord.valueCents,
      }),
    );
    const summary = calculatePortfolioSummary(transactions, currentPricesCents);

    await database
      .insert(portfolioSnapshot)
      .values({
        portfolioId: portfolioRecord.id,
        snapshotDate,
        investedCents: summary.totalCostBasisCents,
        marketValueCents: summary.totalMarketValueCents,
        incomeCents: summary.incomeCents,
      })
      .onConflictDoUpdate({
        target: [portfolioSnapshot.portfolioId, portfolioSnapshot.snapshotDate],
        set: {
          investedCents: summary.totalCostBasisCents,
          marketValueCents: summary.totalMarketValueCents,
          incomeCents: summary.incomeCents,
        },
      });
  }

  return portfolioRecords.length;
}

/** Atualização rápida de cotações, usada pelo cron intradiário. */
export async function refreshQuotes() {
  const warnings: string[] = [];
  let universe = { assets: 0, quotes: 0 };

  try {
    universe = await syncBrapiUniverse();
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `brapi: ${error.message}`
        : "Falha ao sincronizar a lista do brapi.",
    );
  }

  return { ...universe, warnings };
}

export async function refreshMarketData() {
  const warnings: string[] = [];
  let universe = { assets: 0, quotes: 0 };
  let stockIndicators = 0;
  let isinCodes = 0;
  let portfolioSnapshots = 0;

  try {
    universe = await syncBrapiUniverse();
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `brapi: ${error.message}`
        : "Falha ao sincronizar a lista do brapi.",
    );
  }

  try {
    const stockResult = await refreshStockFundamentalsFromFundamentus();
    stockIndicators = stockResult.persisted;
    if (stockResult.persisted === 0) {
      warnings.push("fundamentus indisponível; indicadores de ações mantidos.");
    }
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `fundamentus: ${error.message}`
        : "Falha ao consultar o fundamentus.",
    );
  }

  try {
    isinCodes = await syncIsinCodes();
    if (isinCodes === 0) {
      warnings.push("COTAHIST indisponível; códigos ISIN não atualizados.");
    }
  } catch (error) {
    warnings.push(
      error instanceof Error ? `B3: ${error.message}` : "Falha ao consultar B3.",
    );
  }

  try {
    portfolioSnapshots = await refreshPortfolioSnapshots();
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Snapshots: ${error.message}`
        : "Falha ao gerar snapshots de carteira.",
    );
  }

  return { ...universe, stockIndicators, isinCodes, portfolioSnapshots, warnings };
}

const cvmCompanyDatasets = [
  {
    source: "CVM DFP",
    buildUrl: (year: number) =>
      `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_${year}.zip`,
  },
  {
    source: "CVM ITR",
    buildUrl: (year: number) =>
      `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_${year}.zip`,
  },
] as const;

export async function refreshFundamentalsData(year = new Date().getFullYear()) {
  const database = getDatabase();
  const results: Array<{
    source: string;
    status: "COMPLETED" | "SKIPPED" | "FAILED";
    records: number;
    message?: string;
  }> = [];

  try {
    const fiiResult = await refreshFiiFundamentals();
    await database.insert(ingestionRun).values({
      jobName: "refresh-fundamentals",
      source: "CVM Informe Mensal FII",
      referencePeriod: String(year),
      checksum: createHash("sha256")
        .update(`fii|${year}|${fiiResult.persisted}|${Date.now()}`)
        .digest("hex"),
      status: "COMPLETED",
      processedRecords: fiiResult.persisted,
      details: {
        matchedFunds: fiiResult.matched,
        note: "P/VP, DY 12 meses, regularidade e idade derivados do informe mensal. Vacância permanece ausente: só existe no informe trimestral.",
      },
      finishedAt: new Date(),
    });
    results.push({
      source: "CVM Informe Mensal FII",
      status: "COMPLETED",
      records: fiiResult.persisted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida.";
    results.push({
      source: "CVM Informe Mensal FII",
      status: "FAILED",
      records: 0,
      message,
    });
  }

  try {
    const fundamentusResult = await refreshStockFundamentalsFromFundamentus();
    results.push({
      source: "fundamentus indicadores",
      status: fundamentusResult.persisted > 0 ? "COMPLETED" : "FAILED",
      records: fundamentusResult.persisted,
    });
  } catch (error) {
    results.push({
      source: "fundamentus indicadores",
      status: "FAILED",
      records: 0,
      message: error instanceof Error ? error.message : "Falha desconhecida.",
    });
  }

  try {
    const stockResult = await refreshTopFundamentals();
    results.push({
      source: "brapi fundamentos",
      status: stockResult.quotaExhausted ? "SKIPPED" : "COMPLETED",
      records: stockResult.processed,
      message: stockResult.quotaExhausted
        ? "Cota do brapi esgotada ou token ausente."
        : undefined,
    });
  } catch (error) {
    results.push({
      source: "brapi fundamentos",
      status: "FAILED",
      records: 0,
      message: error instanceof Error ? error.message : "Falha desconhecida.",
    });
  }

  for (const dataset of cvmCompanyDatasets) {
    try {
      const archive = await downloadCvmArchive(dataset.buildUrl(year));
      const existingRun = await database.query.ingestionRun.findFirst({
        where: and(
          eq(ingestionRun.jobName, "refresh-fundamentals"),
          eq(ingestionRun.source, dataset.source),
          eq(ingestionRun.referencePeriod, String(year)),
          eq(ingestionRun.checksum, archive.checksum),
        ),
        columns: { id: true },
      });
      const recordCount = archive.files.reduce(
        (totalRecords, archiveFile) => totalRecords + archiveFile.rows.length,
        0,
      );

      if (existingRun) {
        results.push({ source: dataset.source, status: "SKIPPED", records: 0 });
        continue;
      }

      await database.insert(ingestionRun).values({
        jobName: "refresh-fundamentals",
        source: dataset.source,
        referencePeriod: String(year),
        checksum: archive.checksum,
        status: "COMPLETED",
        processedRecords: recordCount,
        details: {
          files: archive.files.map((archiveFile) => ({
            filename: archiveFile.filename,
            records: archiveFile.rows.length,
            headers: archiveFile.headers,
          })),
          note: "Arquivo validado e versionado como fonte auditável dos demonstrativos.",
        },
        finishedAt: new Date(),
      });
      results.push({
        source: dataset.source,
        status: "COMPLETED",
        records: recordCount,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha desconhecida.";
      const errorChecksum = createHash("sha256")
        .update(`${dataset.source}|${year}|${message}|${Date.now()}`)
        .digest("hex");
      await database.insert(ingestionRun).values({
        jobName: "refresh-fundamentals",
        source: dataset.source,
        referencePeriod: String(year),
        checksum: errorChecksum,
        status: "FAILED",
        details: { message },
        finishedAt: new Date(),
      });
      results.push({
        source: dataset.source,
        status: "FAILED",
        records: 0,
        message,
      });
    }
  }

  return results;
}

export async function getRecentIngestionRuns(limit = 10) {
  return getDatabase().query.ingestionRun.findMany({
    orderBy: [desc(ingestionRun.startedAt)],
    limit,
  });
}
