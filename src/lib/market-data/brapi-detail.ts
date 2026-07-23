import "server-only";

import { z } from "zod";

const nullableNumber = z.number().nullish();

const historicalPriceSchema = z.object({
  date: z.number(),
  open: nullableNumber,
  high: nullableNumber,
  low: nullableNumber,
  close: nullableNumber,
  volume: nullableNumber,
  adjustedClose: nullableNumber,
});

const cashDividendSchema = z.object({
  paymentDate: z.string().nullish(),
  lastDatePrior: z.string().nullish(),
  rate: nullableNumber,
  label: z.string().nullish(),
});

const yearlyStatementSchema = z
  .object({
    type: z.string().nullish(),
    endDate: z.string().nullish(),
  })
  .catchall(z.unknown());

const detailSchema = z.object({
  results: z
    .array(
      z.object({
        symbol: z.string(),
        shortName: z.string().nullish(),
        longName: z.string().nullish(),
        currency: z.string().nullish(),
        regularMarketPrice: nullableNumber,
        regularMarketChange: nullableNumber,
        regularMarketChangePercent: nullableNumber,
        regularMarketVolume: nullableNumber,
        regularMarketPreviousClose: nullableNumber,
        regularMarketOpen: nullableNumber,
        regularMarketDayHigh: nullableNumber,
        regularMarketDayLow: nullableNumber,
        regularMarketTime: z.string().or(z.number()).nullish(),
        fiftyTwoWeekLow: nullableNumber,
        fiftyTwoWeekHigh: nullableNumber,
        marketCap: nullableNumber,
        priceEarnings: nullableNumber,
        earningsPerShare: nullableNumber,
        logourl: z.string().nullish(),
        summaryProfile: z.record(z.string(), z.unknown()).nullish(),
        financialData: z.record(z.string(), z.unknown()).nullish(),
        defaultKeyStatistics: z.record(z.string(), z.unknown()).nullish(),
        balanceSheetHistory: z.array(yearlyStatementSchema).nullish(),
        incomeStatementHistory: z.array(yearlyStatementSchema).nullish(),
        dividendsData: z
          .object({
            cashDividends: z.array(cashDividendSchema).nullish(),
          })
          .nullish(),
        historicalDataPrice: z.array(historicalPriceSchema).nullish(),
      }),
    )
    .min(1),
});

export type BrapiAssetDetail = z.infer<typeof detailSchema>["results"][number];

const detailModules = [
  "summaryProfile",
  "defaultKeyStatistics",
  "financialData",
  "balanceSheetHistory",
  "incomeStatementHistory",
].join(",");

export class BrapiQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrapiQuotaError";
  }
}

export class BrapiTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrapiTokenError";
  }
}

/**
 * Fundamentos completos de um ativo: cotação, série histórica, proventos,
 * balanço, DRE e estatísticas.
 *
 * Consome uma requisição da cota do token (plano gratuito aceita um ticker por
 * chamada), então a persistência em `asset_fundamental_snapshot` é o que evita
 * repetir a busca. O token vai na query string: o brapi rejeita o header
 * `Authorization: Bearer`.
 */
export async function fetchBrapiAssetDetail(
  ticker: string,
): Promise<BrapiAssetDetail | null> {
  const brapiToken = process.env.BRAPI_TOKEN?.trim();

  if (!brapiToken) {
    throw new BrapiTokenError(
      "BRAPI_TOKEN ausente. Cadastre um token gratuito em brapi.dev para carregar fundamentos.",
    );
  }

  const detailUrl = new URL(
    `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`,
  );
  detailUrl.searchParams.set("token", brapiToken);
  detailUrl.searchParams.set("range", "5y");
  detailUrl.searchParams.set("interval", "1d");
  detailUrl.searchParams.set("fundamental", "true");
  detailUrl.searchParams.set("dividends", "true");
  detailUrl.searchParams.set("modules", detailModules);

  const response = await fetch(detailUrl, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 401 || response.status === 403) {
    throw new BrapiTokenError("Token do brapi inválido ou inativo.");
  }

  if (response.status === 402 || response.status === 429) {
    throw new BrapiQuotaError("Cota de requisições do brapi esgotada.");
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`brapi respondeu com status ${response.status}.`);
  }

  const parsedDetail = detailSchema.safeParse(await response.json());

  if (!parsedDetail.success) {
    return null;
  }

  return parsedDetail.data.results[0];
}
