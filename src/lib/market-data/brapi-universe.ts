import "server-only";

import { z } from "zod";

import type { AssetType } from "@/types/investment";

const universePageSchema = z.object({
  stocks: z.array(
    z.object({
      stock: z.string().min(1),
      name: z.string().nullish(),
      close: z.number().nullish(),
      change: z.number().nullish(),
      volume: z.number().nullish(),
      market_cap: z.number().nullish(),
      logo: z.string().nullish(),
      sector: z.string().nullish(),
      subsector: z.string().nullish(),
      type: z.string().nullish(),
      subType: z.string().nullish(),
    }),
  ),
});

export interface BrapiUniverseAsset {
  ticker: string;
  name: string;
  type: AssetType;
  subType: string;
  classification: string;
  priceCents: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCapCents: number | null;
  logoUrl: string | null;
}

/** A lista pública recusa `limit` acima de 2000 e devolve página vazia no fim. */
const universePageSize = 2_000;
const maxUniversePages = 10;

/** Sem logo próprio o brapi devolve um ícone genérico, que não vale persistir. */
const placeholderLogoPattern = /\/BRAPI\.svg$/i;

function toCents(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100);
}

async function fetchUniversePage(page: number) {
  const response = await fetch(
    `https://brapi.dev/api/quote/list?limit=${universePageSize}&page=${page}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw new Error(`brapi respondeu com status ${response.status}.`);
  }

  const parsedPage = universePageSchema.safeParse(await response.json());

  if (!parsedPage.success) {
    throw new Error("Resposta da lista do brapi em formato inesperado.");
  }

  return parsedPage.data.stocks;
}

/**
 * Catálogo completo de ações e FIIs da B3 com o último preço conhecido.
 *
 * Usa o endpoint público `/api/quote/list`, que não consome a cota do token e
 * cobre todo o universo em poucas chamadas. ETFs, BDRs, FI-Agro e FI-Infra são
 * descartados: ficaram fora do escopo do produto.
 */
export async function fetchBrapiUniverse(): Promise<BrapiUniverseAsset[]> {
  const universeAssets: BrapiUniverseAsset[] = [];
  const seenTickers = new Set<string>();

  for (let page = 1; page <= maxUniversePages; page += 1) {
    const pageAssets = await fetchUniversePage(page);

    if (pageAssets.length === 0) {
      break;
    }

    for (const pageAsset of pageAssets) {
      const isStock = pageAsset.type === "stock";
      const isFii = pageAsset.subType === "fii";

      if (!isStock && !isFii) {
        continue;
      }

      const ticker = pageAsset.stock.trim().toUpperCase();

      if (seenTickers.has(ticker)) {
        continue;
      }
      seenTickers.add(ticker);

      const type: AssetType = isStock ? "STOCK" : "FII";
      // Para ações o setor do brapi vem em inglês; o subsetor é em português e
      // mais próximo do vocabulário das planilhas. Para FIIs só há subsetor.
      const classification =
        pageAsset.subsector?.trim() || pageAsset.sector?.trim() || "Não classificado";

      universeAssets.push({
        ticker,
        name: pageAsset.name?.trim() || ticker,
        type,
        subType: pageAsset.subType?.trim() || (isStock ? "stock" : "fii"),
        classification,
        priceCents: toCents(pageAsset.close),
        changePercent: pageAsset.change ?? null,
        volume: pageAsset.volume ?? null,
        marketCapCents: toCents(pageAsset.market_cap),
        logoUrl:
          pageAsset.logo && !placeholderLogoPattern.test(pageAsset.logo)
            ? pageAsset.logo
            : null,
      });
    }

    if (pageAssets.length < universePageSize) {
      break;
    }
  }

  return universeAssets;
}
