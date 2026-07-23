import { describe, expect, it } from "vitest";

import {
  calculateImportFingerprint,
  parsePortfolioCsv,
} from "@/lib/import/portfolio-csv";
import type { AssetType } from "@/types/investment";

const knownAssetTypes = new Map<string, AssetType>([
  ["PETR4", "STOCK"],
  ["HGLG11", "FII"],
]);
const header =
  "tipo;ticker;data;quantidade;preco_unitario;taxas;impostos;valor;corretora;observacao";

describe("importador CSV da carteira", () => {
  it("aceita decimal brasileiro e data DD/MM/AAAA", () => {
    const result = parsePortfolioCsv(
      `${header}\nCOMPRA;PETR4;15/01/2026;10;37,50;4,90;0,00;0,00;Teste;Compra`,
      knownAssetTypes,
    );

    expect(result.fileErrors).toEqual([]);
    expect(result.rows[0].errors).toEqual([]);
    expect(result.rows[0].transaction?.unitPriceCents).toBe(3_750);
    expect(result.rows[0].transaction?.feesCents).toBe(490);
    expect(result.rows[0].transaction?.operationDate).toBe("2026-01-15");
  });

  it("marca datas inválidas", () => {
    const result = parsePortfolioCsv(
      `${header}\nCOMPRA;PETR4;31/02/2026;10;37,50;0;0;0;;`,
      knownAssetTypes,
    );
    expect(result.rows[0].errors).toContain("Data inválida. Use DD/MM/AAAA.");
  });

  it("bloqueia ticker inexistente", () => {
    const result = parsePortfolioCsv(
      `${header}\nCOMPRA;XXXX3;15/01/2026;10;10,00;0;0;0;;`,
      knownAssetTypes,
    );
    expect(result.rows[0].errors).toContain("Ticker não encontrado no catálogo.");
  });

  it("identifica duplicado exato já existente", () => {
    const original = parsePortfolioCsv(
      `${header}\nCOMPRA;PETR4;15/01/2026;10;37,50;0;0;0;;`,
      knownAssetTypes,
    ).rows[0].transaction;
    expect(original).toBeDefined();
    const fingerprint = calculateImportFingerprint({
      ticker: original!.ticker,
      assetType: original!.assetType,
      type: original!.type,
      operationDate: original!.operationDate,
      quantity: original!.quantity,
      unitPriceCents: original!.unitPriceCents,
      feesCents: original!.feesCents,
      taxesCents: original!.taxesCents,
      valueCents: original!.valueCents,
      broker: original!.broker,
      notes: original!.notes,
    });
    const result = parsePortfolioCsv(
      `${header}\nCOMPRA;PETR4;15/01/2026;10;37,50;0;0;0;;`,
      knownAssetTypes,
      new Set([fingerprint]),
    );
    expect(result.rows[0].duplicate).toBe(true);
  });
});
