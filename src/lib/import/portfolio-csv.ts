import { createHash } from "node:crypto";

import { format, isValid, parse } from "date-fns";
import Papa from "papaparse";

import {
  parseBrazilianCurrencyToCents,
  parseBrazilianNumber,
} from "@/lib/parsers";
import type {
  AssetType,
  PortfolioImportRow,
  PortfolioTransaction,
  PortfolioTransactionType,
} from "@/types/investment";

const expectedHeaders = [
  "tipo",
  "ticker",
  "data",
  "quantidade",
  "preco_unitario",
  "taxas",
  "impostos",
  "valor",
  "corretora",
  "observacao",
] as const;

const validTransactionTypes = new Set<PortfolioTransactionType>([
  "COMPRA",
  "VENDA",
  "DIVIDENDO",
  "JCP",
  "RENDIMENTO_FII",
  "AMORTIZACAO",
]);

type CsvRecord = Record<(typeof expectedHeaders)[number], string>;

function normalizeHeader(header: string): string {
  return header
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseOperationDate(dateValue: string): string | null {
  const trimmedDate = dateValue.trim();
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)
    ? parse(trimmedDate, "yyyy-MM-dd", new Date())
    : parse(trimmedDate, "dd/MM/yyyy", new Date());

  return isValid(parsedDate) ? format(parsedDate, "yyyy-MM-dd") : null;
}

function inferAssetType(ticker: string, knownAssetTypes: Map<string, AssetType>) {
  return knownAssetTypes.get(ticker) ?? null;
}

export function calculateImportFingerprint(
  transaction: Omit<PortfolioTransaction, "id">,
): string {
  return createHash("sha256")
    .update(
      [
        transaction.type,
        transaction.ticker,
        transaction.operationDate,
        transaction.quantity.toFixed(8),
        transaction.unitPriceCents,
        transaction.feesCents,
        transaction.taxesCents,
        transaction.valueCents,
        transaction.broker ?? "",
        transaction.notes ?? "",
      ].join("|"),
    )
    .digest("hex");
}

export function calculateFileChecksum(fileContent: string): string {
  return createHash("sha256").update(fileContent).digest("hex");
}

export function parsePortfolioCsv(
  fileContent: string,
  knownAssetTypes: Map<string, AssetType>,
  existingFingerprints: Set<string> = new Set(),
): { rows: PortfolioImportRow[]; fileErrors: string[] } {
  const parsedCsv = Papa.parse<CsvRecord>(fileContent.replace(/^\uFEFF/, ""), {
    header: true,
    delimiter: ";",
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
  const fileErrors: string[] = [];
  const parsedHeaders = parsedCsv.meta.fields ?? [];

  for (const expectedHeader of expectedHeaders) {
    if (!parsedHeaders.includes(expectedHeader)) {
      fileErrors.push(`Coluna obrigatória ausente: ${expectedHeader}.`);
    }
  }

  if (parsedCsv.errors.some((parseError) => parseError.type === "Delimiter")) {
    fileErrors.push("Use ponto e vírgula (;) como separador.");
  }

  if (fileErrors.length > 0) {
    return { rows: [], fileErrors };
  }

  const fingerprintsInFile = new Set<string>();
  const rows = parsedCsv.data.map((csvRecord, rowIndex): PortfolioImportRow => {
    const rowNumber = rowIndex + 2;
    const errors: string[] = [];
    const transactionType = csvRecord.tipo?.trim().toUpperCase() as PortfolioTransactionType;
    const ticker = csvRecord.ticker?.trim().toUpperCase();
    const operationDate = parseOperationDate(csvRecord.data ?? "");
    const quantity = parseBrazilianNumber(csvRecord.quantidade);
    const unitPriceCents = parseBrazilianCurrencyToCents(csvRecord.preco_unitario);
    const feesCents = parseBrazilianCurrencyToCents(csvRecord.taxas);
    const taxesCents = parseBrazilianCurrencyToCents(csvRecord.impostos);
    const valueCents = parseBrazilianCurrencyToCents(csvRecord.valor);
    const assetType = inferAssetType(ticker, knownAssetTypes);

    if (!validTransactionTypes.has(transactionType)) {
      errors.push("Tipo de movimentação inválido.");
    }
    if (!/^[A-Z]{4}\d{1,2}$/.test(ticker)) {
      errors.push("Ticker inválido.");
    } else if (!assetType) {
      errors.push("Ticker não encontrado no catálogo.");
    }
    if (!operationDate) {
      errors.push("Data inválida. Use DD/MM/AAAA.");
    }
    if (!Number.isFinite(feesCents) || feesCents < 0) {
      errors.push("Taxas inválidas.");
    }
    if (!Number.isFinite(taxesCents) || taxesCents < 0) {
      errors.push("Impostos inválidos.");
    }

    if (transactionType === "COMPRA" || transactionType === "VENDA") {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push("Quantidade deve ser maior que zero.");
      }
      if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) {
        errors.push("Preço unitário deve ser maior que zero.");
      }
    }

    if (
      transactionType === "DIVIDENDO" ||
      transactionType === "JCP" ||
      transactionType === "RENDIMENTO_FII" ||
      transactionType === "AMORTIZACAO"
    ) {
      if (!Number.isFinite(valueCents) || valueCents <= 0) {
        errors.push("Valor deve ser maior que zero.");
      }
    }

    if (errors.length > 0 || !operationDate || !assetType) {
      return {
        rowNumber,
        transaction: null,
        fingerprint: null,
        duplicate: false,
        errors,
      };
    }

    const transactionWithoutId: Omit<PortfolioTransaction, "id"> = {
      ticker,
      assetType,
      type: transactionType,
      operationDate,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unitPriceCents: Number.isFinite(unitPriceCents) ? unitPriceCents : 0,
      feesCents: Number.isFinite(feesCents) ? feesCents : 0,
      taxesCents: Number.isFinite(taxesCents) ? taxesCents : 0,
      valueCents: Number.isFinite(valueCents) ? valueCents : 0,
      broker: csvRecord.corretora?.trim() || undefined,
      notes: csvRecord.observacao?.trim() || undefined,
    };
    const fingerprint = calculateImportFingerprint(transactionWithoutId);
    const duplicate =
      existingFingerprints.has(fingerprint) ||
      fingerprintsInFile.has(fingerprint);
    fingerprintsInFile.add(fingerprint);

    return {
      rowNumber,
      transaction: {
        ...transactionWithoutId,
        id: `preview-${rowNumber}`,
      },
      fingerprint,
      duplicate,
      errors: [],
    };
  });

  return { rows, fileErrors };
}
