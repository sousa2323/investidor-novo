import "server-only";

import { z } from "zod";

const brapiQuoteSchema = z.object({
  results: z
    .array(
      z.object({
        symbol: z.string(),
        regularMarketPrice: z.number().positive(),
        regularMarketTime: z.string().or(z.number()).optional(),
        regularMarketVolume: z.number().nonnegative().optional(),
        currency: z.string().optional(),
      }),
    )
    .min(1),
});

export interface BrapiQuote {
  ticker: string;
  priceCents: number;
  marketDate: string;
  volume: number | null;
  sourceDate: Date;
}

export async function fetchBrapiQuote(ticker: string): Promise<BrapiQuote | null> {
  const brapiToken = process.env.BRAPI_TOKEN?.trim();

  if (!brapiToken) {
    return null;
  }

  const response = await fetch(
    `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?token=${encodeURIComponent(brapiToken)}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 1_800 },
      signal: AbortSignal.timeout(12_000),
    },
  );

  if (!response.ok) {
    return null;
  }

  const parsedQuote = brapiQuoteSchema.safeParse(await response.json());
  if (!parsedQuote.success) {
    return null;
  }

  const quote = parsedQuote.data.results[0];
  const sourceDate =
    typeof quote.regularMarketTime === "number"
      ? new Date(quote.regularMarketTime * 1_000)
      : quote.regularMarketTime
        ? new Date(quote.regularMarketTime)
        : new Date();

  return {
    ticker: quote.symbol.toUpperCase(),
    priceCents: Math.round(quote.regularMarketPrice * 100),
    marketDate: sourceDate.toISOString().slice(0, 10),
    volume: quote.regularMarketVolume ?? null,
    sourceDate,
  };
}
