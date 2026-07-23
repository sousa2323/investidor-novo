import type { CvmCsvArchive } from "@/lib/market-data/cvm";

/** Uma competência mensal do informe, já normalizada. */
export interface FiiMonthlyReport {
  referenceMonth: string;
  bookValuePerShare: number | null;
  netAssetsCents: number | null;
  /** Dividend yield do mês em pontos percentuais (a CVM entrega em fração). */
  dividendYieldPercent: number | null;
  shareholderCount: number | null;
}

export interface FiiRegistryEntry {
  cnpj: string;
  isin: string;
  name: string;
  segment: string | null;
  inceptionDate: string | null;
  /** Ordenado da competência mais antiga para a mais recente. */
  monthlyReports: FiiMonthlyReport[];
  realEstateAssetsCents: number | null;
  creditAssetsCents: number | null;
}

function parseCvmNumber(rawValue: string | undefined): number | null {
  if (!rawValue) {
    return null;
  }

  const normalizedValue = rawValue.trim();

  if (!normalizedValue) {
    return null;
  }

  // Os informes usam ponto decimal; alguns campos legados usam vírgula.
  const parsedValue = Number.parseFloat(normalizedValue.replace(",", "."));
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function parseCvmInteger(rawValue: string | undefined): number | null {
  const parsedValue = parseCvmNumber(rawValue);
  return parsedValue === null ? null : Math.round(parsedValue);
}

function toCents(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100);
}

function findArchiveFile(archive: CvmCsvArchive, fragment: string) {
  return archive.files.find((archiveFile) =>
    archiveFile.filename.toLowerCase().includes(fragment),
  );
}

/**
 * Consolida os três CSVs do informe mensal de FIIs em um registro por fundo.
 *
 * Aceita vários arquivos porque o DY de 12 meses atravessa o ano civil: o
 * arquivo do ano corrente só tem os meses já entregues. Quando o mesmo fundo e
 * competência aparecem em mais de um arquivo, a última versão entregue vence.
 */
export function buildFiiRegistry(
  archives: CvmCsvArchive[],
): Map<string, FiiRegistryEntry> {
  const registryByCnpj = new Map<string, FiiRegistryEntry>();
  const reportsByCnpj = new Map<string, Map<string, FiiMonthlyReport>>();
  // Um mesmo CNPJ pode reportar ISINs diferentes entre competências, por erro
  // pontual de digitação. Escolher o mais frequente descarta esses enganos e
  // evita que um fundo "roube" o ticker de outro por causa de uma linha errada.
  const isinCountsByCnpj = new Map<string, Map<string, number>>();

  for (const archive of archives) {
    const generalFile = findArchiveFile(archive, "geral");

    for (const row of generalFile?.rows ?? []) {
      const cnpj = row.CNPJ_Fundo_Classe?.trim();
      const isin = row.Codigo_ISIN?.trim();

      if (!cnpj || !isin) {
        continue;
      }

      const isinCounts = isinCountsByCnpj.get(cnpj) ?? new Map<string, number>();
      isinCounts.set(isin, (isinCounts.get(isin) ?? 0) + 1);
      isinCountsByCnpj.set(cnpj, isinCounts);

      const existingEntry = registryByCnpj.get(cnpj);
      const segment = row.Segmento_Atuacao?.trim() || null;

      registryByCnpj.set(cnpj, {
        cnpj,
        isin,
        name: row.Nome_Fundo_Classe?.trim() || existingEntry?.name || cnpj,
        // Competências mais recentes podem trazer o segmento em branco; um valor
        // já conhecido não é descartado por causa disso.
        segment: segment ?? existingEntry?.segment ?? null,
        inceptionDate:
          row.Data_Funcionamento?.trim() || existingEntry?.inceptionDate || null,
        monthlyReports: [],
        realEstateAssetsCents: existingEntry?.realEstateAssetsCents ?? null,
        creditAssetsCents: existingEntry?.creditAssetsCents ?? null,
      });
    }
  }

  for (const [cnpj, entry] of registryByCnpj) {
    const isinCounts = isinCountsByCnpj.get(cnpj);

    if (!isinCounts) {
      continue;
    }

    entry.isin = [...isinCounts.entries()].sort(
      (first, second) => second[1] - first[1],
    )[0][0];
  }

  for (const archive of archives) {
    const complementFile = findArchiveFile(archive, "complemento");

    for (const row of complementFile?.rows ?? []) {
      const cnpj = row.CNPJ_Fundo_Classe?.trim();
      const referenceMonth = row.Data_Referencia?.trim();

      if (!cnpj || !referenceMonth || !registryByCnpj.has(cnpj)) {
        continue;
      }

      const fundReports = reportsByCnpj.get(cnpj) ?? new Map<string, FiiMonthlyReport>();
      const dividendYieldFraction = parseCvmNumber(row.Percentual_Dividend_Yield_Mes);

      fundReports.set(referenceMonth, {
        referenceMonth,
        bookValuePerShare: parseCvmNumber(row.Valor_Patrimonial_Cotas),
        netAssetsCents: toCents(parseCvmNumber(row.Patrimonio_Liquido)),
        dividendYieldPercent:
          dividendYieldFraction === null ? null : dividendYieldFraction * 100,
        shareholderCount: parseCvmInteger(row.Total_Numero_Cotistas),
      });
      reportsByCnpj.set(cnpj, fundReports);
    }
  }

  for (const archive of archives) {
    const assetsFile = findArchiveFile(archive, "ativo_passivo");

    for (const row of assetsFile?.rows ?? []) {
      const cnpj = row.CNPJ_Fundo_Classe?.trim();
      const entry = cnpj ? registryByCnpj.get(cnpj) : undefined;

      if (!entry) {
        continue;
      }

      const realEstateAssets =
        (parseCvmNumber(row.Imoveis_Renda_Acabados) ?? 0) +
        (parseCvmNumber(row.Imoveis_Renda_Construcao) ?? 0) +
        (parseCvmNumber(row.Imoveis_Venda_Acabados) ?? 0) +
        (parseCvmNumber(row.Imoveis_Venda_Construcao) ?? 0) +
        (parseCvmNumber(row.Terrenos) ?? 0);
      const creditAssets =
        (parseCvmNumber(row.CRI) ?? 0) +
        (parseCvmNumber(row.CRI_CRA) ?? 0) +
        (parseCvmNumber(row.LCI) ?? 0) +
        (parseCvmNumber(row.LCI_LCA) ?? 0) +
        (parseCvmNumber(row.Letras_Hipotecarias) ?? 0);

      entry.realEstateAssetsCents = toCents(realEstateAssets);
      entry.creditAssetsCents = toCents(creditAssets);
    }
  }

  for (const [cnpj, entry] of registryByCnpj) {
    entry.monthlyReports = [...(reportsByCnpj.get(cnpj)?.values() ?? [])].sort(
      (firstReport, secondReport) =>
        firstReport.referenceMonth.localeCompare(secondReport.referenceMonth),
    );
  }

  return registryByCnpj;
}

/** Reindexa o registro por ticker usando o mapa ISIN extraído do COTAHIST. */
export function indexFiiRegistryByTicker(
  registry: Map<string, FiiRegistryEntry>,
  isinToTicker: Map<string, string>,
): Map<string, FiiRegistryEntry> {
  const registryByTicker = new Map<string, FiiRegistryEntry>();

  for (const entry of registry.values()) {
    const ticker = isinToTicker.get(entry.isin);

    if (!ticker) {
      continue;
    }

    const existingEntry = registryByTicker.get(ticker);

    // Um ticker pode aparecer em mais de uma classe do mesmo fundo; fica a que
    // tem mais competências entregues.
    if (
      !existingEntry ||
      entry.monthlyReports.length > existingEntry.monthlyReports.length
    ) {
      registryByTicker.set(ticker, entry);
    }
  }

  return registryByTicker;
}

export const cvmFiiMonthlyUrl = (year: number) =>
  `https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_${year}.zip`;
