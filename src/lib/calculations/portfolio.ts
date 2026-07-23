import type {
  PortfolioPosition,
  PortfolioSummary,
  PortfolioTransaction,
} from "@/types/investment";

type MutablePosition = PortfolioPosition;

export class NegativePositionError extends Error {
  constructor(ticker: string, operationDate: string) {
    super(
      `A venda de ${ticker} em ${operationDate} é maior que a posição disponível nessa data.`,
    );
    this.name = "NegativePositionError";
  }
}

function roundCents(value: number): number {
  return Math.round(value);
}

export function calculatePortfolioPositions(
  transactions: PortfolioTransaction[],
): PortfolioPosition[] {
  const sortedTransactions = transactions
    .map((transaction, originalIndex) => ({ transaction, originalIndex }))
    .sort((firstEntry, secondEntry) => {
      const dateComparison = firstEntry.transaction.operationDate.localeCompare(
        secondEntry.transaction.operationDate,
      );
      return dateComparison === 0
        ? firstEntry.originalIndex - secondEntry.originalIndex
        : dateComparison;
    });
  const positionsByTicker = new Map<string, MutablePosition>();

  for (const { transaction } of sortedTransactions) {
    const existingPosition = positionsByTicker.get(transaction.ticker) ?? {
      ticker: transaction.ticker,
      assetType: transaction.assetType,
      quantity: 0,
      averagePriceCents: 0,
      costBasisCents: 0,
      realizedResultCents: 0,
      incomeCents: 0,
      amortizationCents: 0,
      feesCents: 0,
      taxesCents: 0,
    };

    existingPosition.feesCents += transaction.feesCents;
    existingPosition.taxesCents += transaction.taxesCents;

    if (transaction.type === "COMPRA") {
      const purchaseCostCents =
        transaction.quantity * transaction.unitPriceCents +
        transaction.feesCents +
        transaction.taxesCents;
      existingPosition.costBasisCents += purchaseCostCents;
      existingPosition.quantity += transaction.quantity;
      existingPosition.averagePriceCents =
        existingPosition.quantity === 0
          ? 0
          : roundCents(existingPosition.costBasisCents / existingPosition.quantity);
    }

    if (transaction.type === "VENDA") {
      if (transaction.quantity > existingPosition.quantity + Number.EPSILON) {
        throw new NegativePositionError(
          transaction.ticker,
          transaction.operationDate,
        );
      }

      const soldCostBasisCents =
        existingPosition.averagePriceCents * transaction.quantity;
      const saleProceedsCents =
        transaction.quantity * transaction.unitPriceCents -
        transaction.feesCents -
        transaction.taxesCents;
      existingPosition.realizedResultCents +=
        saleProceedsCents - soldCostBasisCents;
      existingPosition.quantity -= transaction.quantity;
      existingPosition.costBasisCents = Math.max(
        0,
        existingPosition.costBasisCents - soldCostBasisCents,
      );

      if (existingPosition.quantity <= Number.EPSILON) {
        existingPosition.quantity = 0;
        existingPosition.averagePriceCents = 0;
        existingPosition.costBasisCents = 0;
      }
    }

    if (
      transaction.type === "DIVIDENDO" ||
      transaction.type === "JCP" ||
      transaction.type === "RENDIMENTO_FII"
    ) {
      existingPosition.incomeCents +=
        transaction.valueCents -
        transaction.feesCents -
        transaction.taxesCents;
    }

    if (transaction.type === "AMORTIZACAO") {
      const amortizationCents = Math.min(
        existingPosition.costBasisCents,
        Math.max(0, transaction.valueCents),
      );
      existingPosition.amortizationCents += amortizationCents;
      existingPosition.costBasisCents -= amortizationCents;
      existingPosition.averagePriceCents =
        existingPosition.quantity === 0
          ? 0
          : roundCents(existingPosition.costBasisCents / existingPosition.quantity);
    }

    positionsByTicker.set(transaction.ticker, existingPosition);
  }

  return [...positionsByTicker.values()].map(
    (position) => ({
      ...position,
      quantity: Math.round(position.quantity * 100_000_000) / 100_000_000,
      averagePriceCents: roundCents(position.averagePriceCents),
      costBasisCents: roundCents(position.costBasisCents),
      realizedResultCents: roundCents(position.realizedResultCents),
    }),
  );
}

export function calculatePortfolioSummary(
  transactions: PortfolioTransaction[],
  currentPricesCents: Record<string, number>,
): PortfolioSummary {
  const positions = calculatePortfolioPositions(transactions);
  const totalCostBasisCents = positions.reduce(
    (totalCents, position) => totalCents + position.costBasisCents,
    0,
  );
  const totalMarketValueCents = positions.reduce(
    (totalCents, position) =>
      totalCents +
      position.quantity *
        (currentPricesCents[position.ticker] ?? position.averagePriceCents),
    0,
  );
  const realizedResultCents = positions.reduce(
    (totalCents, position) => totalCents + position.realizedResultCents,
    0,
  );
  const incomeCents = positions.reduce(
    (totalCents, position) => totalCents + position.incomeCents,
    0,
  );
  const feesCents = transactions.reduce(
    (totalCents, transaction) => totalCents + transaction.feesCents,
    0,
  );
  const taxesCents = transactions.reduce(
    (totalCents, transaction) => totalCents + transaction.taxesCents,
    0,
  );
  const unrealizedResultCents = totalMarketValueCents - totalCostBasisCents;

  return {
    positions,
    totalCostBasisCents: roundCents(totalCostBasisCents),
    totalMarketValueCents: roundCents(totalMarketValueCents),
    realizedResultCents: roundCents(realizedResultCents),
    unrealizedResultCents: roundCents(unrealizedResultCents),
    incomeCents: roundCents(incomeCents),
    feesCents,
    taxesCents,
    totalResultCents: roundCents(
      realizedResultCents + unrealizedResultCents + incomeCents,
    ),
  };
}
