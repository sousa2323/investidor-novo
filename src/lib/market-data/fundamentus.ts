import "server-only";

import iconv from "iconv-lite";

export interface FundamentusIndicators {
  ticker: string;
  priceEarnings: number | null;
  priceToBook: number | null;
  dividendYield: number | null;
  netMargin: number | null;
  roic: number | null;
  roe: number | null;
  averageDailyLiquidityCents: number | null;
  netDebtToEquity: number | null;
  revenueGrowthFiveYears: number | null;
}

/**
 * Converte um número no formato brasileiro do fundamentus para JavaScript.
 *
 * Trata separador de milhar por ponto, decimal por vírgula e sufixo de
 * percentual. Zero costuma significar "não informado" para vários indicadores,
 * mas essa interpretação fica com quem consome, não aqui.
 */
function parseBrazilianNumber(rawValue: string): number | null {
  const normalizedValue = rawValue
    .replace(/&nbsp;/g, "")
    .replace(/%/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  if (!normalizedValue || normalizedValue === "-") {
    return null;
  }

  const parsedValue = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

/** Zero no fundamentus quase sempre é dado ausente, não valor real. */
function nonZero(value: number | null): number | null {
  return value === null || value === 0 ? null : value;
}

function stripHtml(cell: string): string {
  return cell.replace(/<[^>]+>/g, "").trim();
}

/**
 * Índice das colunas na tabela do fundamentus. Fixado por posição porque o
 * cabeçalho é estável, mas documentado para facilitar a manutenção.
 */
const columnIndex = {
  ticker: 0,
  priceEarnings: 2,
  priceToBook: 3,
  dividendYield: 5,
  netMargin: 14,
  roic: 16,
  roe: 17,
  liquidity: 18,
  netDebtToEquity: 20,
  revenueGrowth: 21,
} as const;

/**
 * Indicadores fundamentalistas de todas as ações da B3 em uma única requisição.
 *
 * A tabela pública `resultado.php` do fundamentus lista o universo com DY, ROE,
 * ROIC, margem e crescimento — sem token e sem cota, o que preenche o score da
 * listagem inteira mesmo sem o BRAPI_TOKEN. Não traz proventos individuais nem
 * histórico de preço; isso continua vindo do brapi no detalhe.
 */
export async function fetchFundamentusIndicators(): Promise<
  Map<string, FundamentusIndicators>
> {
  const response = await fetch("https://www.fundamentus.com.br/resultado.php", {
    headers: {
      // O fundamentus recusa requisições sem User-Agent de navegador.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`fundamentus respondeu com status ${response.status}.`);
  }

  const html = iconv.decode(
    Buffer.from(await response.arrayBuffer()),
    "latin1",
  );
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(
    (match) => match[1],
  );
  const indicatorsByTicker = new Map<string, FundamentusIndicators>();

  // A primeira linha é o cabeçalho; as demais são ativos.
  for (const row of rows.slice(1)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) =>
      stripHtml(match[1]),
    );

    if (cells.length < 22) {
      continue;
    }

    const ticker = cells[columnIndex.ticker].toUpperCase();

    if (!/^[A-Z]{4}\d{1,2}$/.test(ticker)) {
      continue;
    }

    const liquidityReais = parseBrazilianNumber(cells[columnIndex.liquidity]);

    indicatorsByTicker.set(ticker, {
      ticker,
      priceEarnings: nonZero(parseBrazilianNumber(cells[columnIndex.priceEarnings])),
      priceToBook: nonZero(parseBrazilianNumber(cells[columnIndex.priceToBook])),
      dividendYield: nonZero(parseBrazilianNumber(cells[columnIndex.dividendYield])),
      netMargin: nonZero(parseBrazilianNumber(cells[columnIndex.netMargin])),
      roic: nonZero(parseBrazilianNumber(cells[columnIndex.roic])),
      roe: nonZero(parseBrazilianNumber(cells[columnIndex.roe])),
      averageDailyLiquidityCents:
        liquidityReais === null ? null : Math.round(liquidityReais * 100),
      netDebtToEquity: parseBrazilianNumber(cells[columnIndex.netDebtToEquity]),
      revenueGrowthFiveYears: parseBrazilianNumber(cells[columnIndex.revenueGrowth]),
    });
  }

  return indicatorsByTicker;
}
