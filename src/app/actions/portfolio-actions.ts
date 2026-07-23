"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDatabase } from "@/db";
import {
  asset,
  portfolio,
  portfolioTransaction,
} from "@/db/schema";
import {
  calculatePortfolioPositions,
  NegativePositionError,
} from "@/lib/calculations/portfolio";
import { requireCurrentUser } from "@/lib/dal/session";
import {
  parseBrazilianCurrencyToCents,
  parseBrazilianNumber,
} from "@/lib/parsers";
import type { AssetType, PortfolioTransaction } from "@/types/investment";

const transactionSchema = z.object({
  ticker: z.string().trim().toUpperCase().regex(/^[A-Z]{4}\d{1,2}$/),
  type: z.enum([
    "COMPRA",
    "VENDA",
    "DIVIDENDO",
    "JCP",
    "RENDIMENTO_FII",
    "AMORTIZACAO",
  ]),
  operationDate: z.iso.date(),
  quantity: z.number().min(0),
  unitPriceCents: z.number().int().min(0),
  feesCents: z.number().int().min(0),
  taxesCents: z.number().int().min(0),
  valueCents: z.number().int().min(0),
  broker: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(300).optional(),
});

export interface TransactionActionState {
  success: boolean;
  message: string;
}

async function getOrCreatePortfolioId(
  database: ReturnType<typeof getDatabase>,
  userId: string,
): Promise<string> {
  await database
    .insert(portfolio)
    .values({ userId })
    .onConflictDoNothing();
  const portfolioRecord = await database.query.portfolio.findFirst({
    where: eq(portfolio.userId, userId),
    columns: { id: true },
  });

  if (!portfolioRecord) {
    throw new Error("Não foi possível abrir a carteira principal.");
  }

  return portfolioRecord.id;
}

function mapStoredTransaction(
  transactionRecord: {
    id: string;
    ticker: string;
    type:
      | "COMPRA"
      | "VENDA"
      | "DIVIDENDO"
      | "JCP"
      | "RENDIMENTO_FII"
      | "AMORTIZACAO";
    operationDate: string;
    quantity: string;
    unitPriceCents: number;
    feesCents: number;
    taxesCents: number;
    valueCents: number;
    assetType: "STOCK" | "FII" | null;
  },
): PortfolioTransaction {
  return {
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
  };
}

export async function createPortfolioTransactionAction(
  _previousState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const currentUser = await requireCurrentUser();
  const parsedTransaction = transactionSchema.safeParse({
    ticker: formData.get("ticker"),
    type: formData.get("type"),
    operationDate: formData.get("operationDate"),
    quantity: parseBrazilianNumber(String(formData.get("quantity") ?? "")),
    unitPriceCents: parseBrazilianCurrencyToCents(
      String(formData.get("unitPrice") ?? ""),
    ),
    feesCents: parseBrazilianCurrencyToCents(String(formData.get("fees") ?? "")),
    taxesCents: parseBrazilianCurrencyToCents(
      String(formData.get("taxes") ?? ""),
    ),
    valueCents: parseBrazilianCurrencyToCents(String(formData.get("value") ?? "")),
    broker: String(formData.get("broker") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });

  if (!parsedTransaction.success) {
    return {
      success: false,
      message: "Revise os campos da movimentação.",
    };
  }

  const transactionValues = parsedTransaction.data;
  const isTrade =
    transactionValues.type === "COMPRA" || transactionValues.type === "VENDA";

  if (
    (isTrade &&
      (transactionValues.quantity <= 0 ||
        transactionValues.unitPriceCents <= 0)) ||
    (!isTrade && transactionValues.valueCents <= 0)
  ) {
    return {
      success: false,
      message: isTrade
        ? "Quantidade e preço precisam ser maiores que zero."
        : "O valor precisa ser maior que zero.",
    };
  }

  try {
    const database = getDatabase();
      const portfolioId = await getOrCreatePortfolioId(
        database,
        currentUser.id,
      );
      const assetRecord = await database.query.asset.findFirst({
        where: eq(asset.ticker, transactionValues.ticker),
        columns: { id: true, type: true },
      });

      if (!assetRecord) {
        throw new Error("Ticker não encontrado no catálogo de ativos.");
      }

      const storedTransactions = await database
        .select({
          id: portfolioTransaction.id,
          ticker: portfolioTransaction.ticker,
          type: portfolioTransaction.type,
          operationDate: portfolioTransaction.operationDate,
          quantity: portfolioTransaction.quantity,
          unitPriceCents: portfolioTransaction.unitPriceCents,
          feesCents: portfolioTransaction.feesCents,
          taxesCents: portfolioTransaction.taxesCents,
          valueCents: portfolioTransaction.valueCents,
          assetType: asset.type,
        })
        .from(portfolioTransaction)
        .leftJoin(asset, eq(portfolioTransaction.assetId, asset.id))
        .where(eq(portfolioTransaction.portfolioId, portfolioId))
        .orderBy(
          asc(portfolioTransaction.operationDate),
          asc(portfolioTransaction.createdAt),
        );

      const candidateTransaction: PortfolioTransaction = {
        id: crypto.randomUUID(),
        ticker: transactionValues.ticker,
        assetType: assetRecord.type,
        type: transactionValues.type,
        operationDate: transactionValues.operationDate,
        quantity: transactionValues.quantity,
        unitPriceCents: transactionValues.unitPriceCents,
        feesCents: transactionValues.feesCents,
        taxesCents: transactionValues.taxesCents,
        valueCents: transactionValues.valueCents,
        broker: transactionValues.broker || undefined,
        notes: transactionValues.notes || undefined,
      };

      calculatePortfolioPositions([
        ...storedTransactions.map(mapStoredTransaction),
        candidateTransaction,
      ]);

      await database.insert(portfolioTransaction).values({
        id: candidateTransaction.id,
        portfolioId,
        assetId: assetRecord.id,
        ticker: candidateTransaction.ticker,
        type: candidateTransaction.type,
        operationDate: candidateTransaction.operationDate,
        quantity: String(candidateTransaction.quantity),
        unitPriceCents: candidateTransaction.unitPriceCents,
        feesCents: candidateTransaction.feesCents,
        taxesCents: candidateTransaction.taxesCents,
        valueCents: candidateTransaction.valueCents,
        broker: candidateTransaction.broker,
        notes: candidateTransaction.notes,
      });
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof NegativePositionError || error instanceof Error
          ? error.message
          : "Não foi possível salvar a movimentação.",
    };
  }

  revalidatePath("/carteira");
  revalidatePath("/carteira/movimentacoes");
  revalidatePath("/planejador");
  revalidatePath("/painel");

  return {
    success: true,
    message: "Movimentação registrada.",
  };
}

export async function deletePortfolioTransactionAction(
  transactionId: string,
): Promise<{ success: boolean; message: string }> {
  const currentUser = await requireCurrentUser();
  const database = getDatabase();
  const ownedTransaction = await database
    .select({ id: portfolioTransaction.id, portfolioId: portfolioTransaction.portfolioId })
    .from(portfolioTransaction)
    .innerJoin(portfolio, eq(portfolioTransaction.portfolioId, portfolio.id))
    .where(
      and(
        eq(portfolioTransaction.id, transactionId),
        eq(portfolio.userId, currentUser.id),
      ),
    )
    .limit(1);

  if (!ownedTransaction[0]) {
    return { success: false, message: "Movimentação não encontrada." };
  }

  await database
    .delete(portfolioTransaction)
    .where(eq(portfolioTransaction.id, transactionId));
  revalidatePath("/carteira");
  revalidatePath("/carteira/movimentacoes");

  return { success: true, message: "Movimentação removida." };
}
