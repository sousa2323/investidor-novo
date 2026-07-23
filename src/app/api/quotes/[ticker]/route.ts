import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import { asset, assetQuote } from "@/db/schema";
import { getCurrentUserOrNull } from "@/lib/dal/session";
import { fetchBrapiQuote } from "@/lib/market-data/brapi";

export const revalidate = 1_800;

export async function GET(
  _request: Request,
  context: RouteContext<"/api/quotes/[ticker]">,
) {
  const currentUser = await getCurrentUserOrNull();
  if (!currentUser) {
    return Response.json({ message: "Sessão expirada." }, { status: 401 });
  }

  const { ticker: rawTicker } = await context.params;
  const parsedTicker = z
    .string()
    .transform((ticker) => ticker.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{4}\d{1,2}$/))
    .safeParse(rawTicker);
  if (!parsedTicker.success) {
    return Response.json({ message: "Ticker inválido." }, { status: 400 });
  }

  const ticker = parsedTicker.data;
  const database = getDatabase();
  const assetRecord = await database.query.asset.findFirst({
    where: eq(asset.ticker, ticker),
    columns: { id: true },
  });
  const brapiQuote = await fetchBrapiQuote(ticker).catch(() => null);

  if (brapiQuote && assetRecord) {
    await database
      .insert(assetQuote)
      .values({
        assetId: assetRecord.id,
        priceCents: brapiQuote.priceCents,
        marketDate: brapiQuote.marketDate,
        source: "brapi",
        sourceDate: brapiQuote.sourceDate,
      })
      .onConflictDoUpdate({
        target: [assetQuote.assetId, assetQuote.marketDate],
        set: {
          priceCents: brapiQuote.priceCents,
          source: "brapi",
          sourceDate: brapiQuote.sourceDate,
        },
      });
    return Response.json({
      ticker,
      priceCents: brapiQuote.priceCents,
      source: "brapi",
      sourceDate: brapiQuote.sourceDate.toISOString(),
      stale: false,
    });
  }

  if (assetRecord) {
    const storedQuote = await database.query.assetQuote.findFirst({
      where: eq(assetQuote.assetId, assetRecord.id),
      orderBy: [desc(assetQuote.marketDate)],
    });
    if (storedQuote) {
      return Response.json({
        ticker,
        priceCents: storedQuote.priceCents,
        source: storedQuote.source,
        sourceDate: storedQuote.sourceDate.toISOString(),
        stale: true,
      });
    }
  }

  return Response.json({ message: "Cotação indisponível." }, { status: 404 });
}
