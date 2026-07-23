import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  asset,
  portfolio,
  portfolioSnapshot,
  portfolioTransaction,
} from "@/db/schema";
import { calculatePortfolioSummary } from "@/lib/calculations/portfolio";
import { requireCurrentUser } from "@/lib/dal/session";
import type {
  AssetType,
  PortfolioSummary,
  PortfolioTransaction,
} from "@/types/investment";

export async function getPortfolioTransactionsDto(): Promise<
  PortfolioTransaction[]
> {
  const currentUser = await requireCurrentUser();
  const portfolioRecord = await getDatabase().query.portfolio.findFirst({
    where: eq(portfolio.userId, currentUser.id),
    columns: { id: true },
  });

  if (!portfolioRecord) {
    return [];
  }

  const transactionRecords = await getDatabase()
    .select({
      id: portfolioTransaction.id,
      ticker: portfolioTransaction.ticker,
      assetType: asset.type,
      type: portfolioTransaction.type,
      operationDate: portfolioTransaction.operationDate,
      quantity: portfolioTransaction.quantity,
      unitPriceCents: portfolioTransaction.unitPriceCents,
      feesCents: portfolioTransaction.feesCents,
      taxesCents: portfolioTransaction.taxesCents,
      valueCents: portfolioTransaction.valueCents,
      broker: portfolioTransaction.broker,
      notes: portfolioTransaction.notes,
    })
    .from(portfolioTransaction)
    .leftJoin(asset, eq(portfolioTransaction.assetId, asset.id))
    .where(eq(portfolioTransaction.portfolioId, portfolioRecord.id))
    .orderBy(
      asc(portfolioTransaction.operationDate),
      asc(portfolioTransaction.createdAt),
    );

  return transactionRecords.map((transactionRecord) => ({
    id: transactionRecord.id,
    ticker: transactionRecord.ticker,
    assetType: (transactionRecord.assetType ?? "STOCK") as AssetType,
    type: transactionRecord.type,
    operationDate: transactionRecord.operationDate,
    quantity: Number(transactionRecord.quantity),
    unitPriceCents: transactionRecord.unitPriceCents,
    feesCents: transactionRecord.feesCents,
    taxesCents: transactionRecord.taxesCents,
    valueCents: transactionRecord.valueCents,
    broker: transactionRecord.broker ?? undefined,
    notes: transactionRecord.notes ?? undefined,
  }));
}

export async function getPortfolioSummaryDto(
  currentPricesCents: Record<string, number>,
): Promise<PortfolioSummary> {
  const transactions = await getPortfolioTransactionsDto();
  return calculatePortfolioSummary(transactions, currentPricesCents);
}

export async function getPortfolioSnapshotsDto(): Promise<
  Array<{
    snapshotDate: string;
    investedCents: number;
    marketValueCents: number;
    incomeCents: number;
  }>
> {
  const currentUser = await requireCurrentUser();
  const snapshotRecords = await getDatabase()
    .select({
      snapshotDate: portfolioSnapshot.snapshotDate,
      investedCents: portfolioSnapshot.investedCents,
      marketValueCents: portfolioSnapshot.marketValueCents,
      incomeCents: portfolioSnapshot.incomeCents,
    })
    .from(portfolioSnapshot)
    .innerJoin(
      portfolio,
      eq(portfolioSnapshot.portfolioId, portfolio.id),
    )
    .where(eq(portfolio.userId, currentUser.id))
    .orderBy(desc(portfolioSnapshot.snapshotDate))
    .limit(180);

  return snapshotRecords.reverse();
}
