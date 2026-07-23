export interface B3CotahistRecord {
  ticker: string;
  companyName: string;
  marketDate: string;
  closePriceCents: number;
  tradedQuantity: number;
  financialVolumeCents: number;
  marketType: string;
  /** Especificação do papel: ON, PN, UNT, CI (cotas de fundo fechado). */
  specification: string;
  /** Código ISIN, única chave que liga o ticker da B3 ao CNPJ da CVM. */
  isin: string;
}

function parseImpliedCents(rawValue: string): number {
  const integerValue = Number.parseInt(rawValue.trim(), 10);
  return Number.isFinite(integerValue) ? integerValue : 0;
}

export function parseB3CotahistLine(line: string): B3CotahistRecord | null {
  if (line.length < 188 || line.slice(0, 2) !== "01") {
    return null;
  }

  const rawDate = line.slice(2, 10);
  const marketType = line.slice(24, 27).trim();
  const ticker = line.slice(12, 24).trim();

  if (!/^\d{8}$/.test(rawDate) || !ticker) {
    return null;
  }

  return {
    ticker,
    companyName: line.slice(27, 39).trim(),
    marketDate: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`,
    closePriceCents: parseImpliedCents(line.slice(108, 121)),
    tradedQuantity: Number.parseInt(line.slice(152, 170).trim(), 10) || 0,
    financialVolumeCents: parseImpliedCents(line.slice(170, 188)),
    marketType,
    specification: line.slice(39, 49).trim(),
    isin: line.slice(230, 242).trim(),
  };
}

/**
 * Mapa ISIN → ticker restrito às cotas de fundo fechado (`CI`), que é a
 * especificação dos FIIs. É a ponte para o CNPJ dos informes da CVM, onde o
 * ticker não existe.
 */
export function buildFiiIsinMap(
  records: B3CotahistRecord[],
): Map<string, string> {
  const isinToTicker = new Map<string, string>();

  for (const record of records) {
    if (!record.isin || !record.specification.startsWith("CI")) {
      continue;
    }
    // Tickers de FII terminam em 11; direitos e recibos (12, 13) compartilham o
    // ISIN e não devem sobrescrever a cota principal.
    if (!/11$/.test(record.ticker)) {
      continue;
    }
    isinToTicker.set(record.isin, record.ticker);
  }

  return isinToTicker;
}

export function parseB3CotahistFile(fileContent: string): B3CotahistRecord[] {
  return fileContent
    .split(/\r?\n/)
    .map(parseB3CotahistLine)
    .filter(
      (record): record is B3CotahistRecord =>
        Boolean(record) &&
        record?.marketType === "010" &&
        record.closePriceCents > 0,
    );
}
