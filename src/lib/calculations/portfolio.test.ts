import { describe, expect, it } from "vitest";

import {
  calculatePortfolioPositions,
  calculatePortfolioSummary,
  NegativePositionError,
} from "@/lib/calculations/portfolio";
import type { PortfolioTransaction } from "@/types/investment";

function transaction(
  partialTransaction: Partial<PortfolioTransaction> &
    Pick<PortfolioTransaction, "id" | "type" | "operationDate">,
): PortfolioTransaction {
  return {
    ticker: "PETR4",
    assetType: "STOCK",
    quantity: 0,
    unitPriceCents: 0,
    feesCents: 0,
    taxesCents: 0,
    valueCents: 0,
    ...partialTransaction,
  };
}

describe("cálculo da carteira", () => {
  it("calcula preço médio ponderado incluindo taxas de compra", () => {
    const positions = calculatePortfolioPositions([
      transaction({
        id: "buy-one",
        type: "COMPRA",
        operationDate: "2026-01-10",
        quantity: 10,
        unitPriceCents: 1_000,
        feesCents: 100,
      }),
      transaction({
        id: "buy-two",
        type: "COMPRA",
        operationDate: "2026-02-10",
        quantity: 10,
        unitPriceCents: 1_200,
      }),
    ]);

    expect(positions[0].quantity).toBe(20);
    expect(positions[0].costBasisCents).toBe(22_100);
    expect(positions[0].averagePriceCents).toBe(1_105);
  });

  it("mantém o preço médio após venda parcial e calcula resultado realizado", () => {
    const positions = calculatePortfolioPositions([
      transaction({
        id: "buy",
        type: "COMPRA",
        operationDate: "2026-01-10",
        quantity: 10,
        unitPriceCents: 1_000,
      }),
      transaction({
        id: "sell",
        type: "VENDA",
        operationDate: "2026-02-10",
        quantity: 4,
        unitPriceCents: 1_300,
        feesCents: 20,
      }),
    ]);

    expect(positions[0].quantity).toBe(6);
    expect(positions[0].averagePriceCents).toBe(1_000);
    expect(positions[0].realizedResultCents).toBe(1_180);
  });

  it("soma proventos e reduz custo com amortização sem ficar negativo", () => {
    const positions = calculatePortfolioPositions([
      transaction({
        id: "buy",
        type: "COMPRA",
        operationDate: "2026-01-10",
        quantity: 10,
        unitPriceCents: 1_000,
      }),
      transaction({
        id: "income",
        type: "DIVIDENDO",
        operationDate: "2026-02-10",
        valueCents: 900,
        taxesCents: 100,
      }),
      transaction({
        id: "amortization",
        type: "AMORTIZACAO",
        operationDate: "2026-03-10",
        valueCents: 20_000,
      }),
    ]);

    expect(positions[0].incomeCents).toBe(800);
    expect(positions[0].costBasisCents).toBe(0);
    expect(positions[0].averagePriceCents).toBe(0);
  });

  it("recalcula movimentação retroativa em ordem de data", () => {
    const positions = calculatePortfolioPositions([
      transaction({
        id: "later-sell",
        type: "VENDA",
        operationDate: "2026-02-10",
        quantity: 5,
        unitPriceCents: 1_200,
      }),
      transaction({
        id: "earlier-buy",
        type: "COMPRA",
        operationDate: "2026-01-10",
        quantity: 10,
        unitPriceCents: 1_000,
      }),
    ]);

    expect(positions[0].quantity).toBe(5);
  });

  it("impede posição negativa na data da venda", () => {
    expect(() =>
      calculatePortfolioPositions([
        transaction({
          id: "sell",
          type: "VENDA",
          operationDate: "2026-01-10",
          quantity: 1,
          unitPriceCents: 1_000,
        }),
      ]),
    ).toThrow(NegativePositionError);
  });

  it("calcula resultado total com posição em aberto e proventos", () => {
    const summary = calculatePortfolioSummary(
      [
        transaction({
          id: "buy",
          type: "COMPRA",
          operationDate: "2026-01-10",
          quantity: 10,
          unitPriceCents: 1_000,
        }),
        transaction({
          id: "income",
          type: "DIVIDENDO",
          operationDate: "2026-02-10",
          valueCents: 500,
        }),
      ],
      { PETR4: 1_200 },
    );

    expect(summary.unrealizedResultCents).toBe(2_000);
    expect(summary.totalResultCents).toBe(2_500);
  });
});
