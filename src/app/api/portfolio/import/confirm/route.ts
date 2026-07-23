import { and, asc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import {
  asset,
  importRun,
  portfolio,
  portfolioTransaction,
} from "@/db/schema";
import {
  calculatePortfolioPositions,
  NegativePositionError,
} from "@/lib/calculations/portfolio";
import {
  calculateFileChecksum,
  parsePortfolioCsv,
} from "@/lib/import/portfolio-csv";
import { getCurrentUserOrNull } from "@/lib/dal/session";
import type { AssetType, PortfolioTransaction } from "@/types/investment";

const confirmationSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  fileContent: z.string().min(1).max(2 * 1024 * 1024),
});

export async function POST(request: Request) {
  const currentUser = await getCurrentUserOrNull();

  if (!currentUser) {
    return Response.json({ message: "Sessão expirada." }, { status: 401 });
  }

  const parsedBody = confirmationSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return Response.json(
      { message: "Prévia inválida. Envie o arquivo novamente." },
      { status: 400 },
    );
  }

  const { filename, checksum, fileContent } = parsedBody.data;
  if (calculateFileChecksum(fileContent) !== checksum) {
    return Response.json(
      { message: "O arquivo mudou após a prévia." },
      { status: 409 },
    );
  }

  try {
    const database = getDatabase();
        await database
          .insert(portfolio)
          .values({ userId: currentUser.id })
          .onConflictDoNothing();
        const portfolioRecord =
          await database.query.portfolio.findFirst({
            where: eq(portfolio.userId, currentUser.id),
            columns: { id: true },
          });

        if (!portfolioRecord) {
          throw new Error("Carteira principal não encontrada.");
        }

        const existingImport = await database.query.importRun.findFirst({
          where: and(
            eq(importRun.userId, currentUser.id),
            eq(importRun.checksum, checksum),
          ),
          columns: { id: true },
        });
        if (existingImport) {
          return Response.json({
            importedCount: 0,
            duplicateCount: 0,
            message: "Este arquivo já foi importado.",
          });
        }

        const databaseAssets = await database
          .select({ id: asset.id, ticker: asset.ticker, type: asset.type })
          .from(asset);
        const assetByTicker = new Map(
          databaseAssets.map((assetRecord) => [assetRecord.ticker, assetRecord]),
        );
        const knownAssetTypes = new Map<string, AssetType>(
          databaseAssets.map((assetRecord) => [
            assetRecord.ticker,
            assetRecord.type,
          ]),
        );
        const storedFingerprints = await database
          .select({ fingerprint: portfolioTransaction.importFingerprint })
          .from(portfolioTransaction)
          .where(
            and(
              eq(portfolioTransaction.portfolioId, portfolioRecord.id),
              isNotNull(portfolioTransaction.importFingerprint),
            ),
          );
        const existingFingerprints = new Set(
          storedFingerprints
            .map((storedFingerprint) => storedFingerprint.fingerprint)
            .filter((fingerprint): fingerprint is string => Boolean(fingerprint)),
        );
        const preview = parsePortfolioCsv(
          fileContent,
          knownAssetTypes,
          existingFingerprints,
        );
        const invalidRows = preview.rows.filter(
          (previewRow) => previewRow.errors.length > 0,
        );

        if (preview.fileErrors.length > 0 || invalidRows.length > 0) {
          throw new Error(
            "Há linhas inválidas. Gere uma nova prévia antes de confirmar.",
          );
        }

        const rowsToImport = preview.rows.filter(
          (previewRow) =>
            !previewRow.duplicate &&
            previewRow.transaction &&
            previewRow.fingerprint,
        );
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
          .where(eq(portfolioTransaction.portfolioId, portfolioRecord.id))
          .orderBy(
            asc(portfolioTransaction.operationDate),
            asc(portfolioTransaction.createdAt),
          );
        const existingTransactions: PortfolioTransaction[] =
          storedTransactions.map((transactionRecord) => ({
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
          }));
        const candidateTransactions = rowsToImport.map(
          (previewRow) => previewRow.transaction as PortfolioTransaction,
        );

        calculatePortfolioPositions([
          ...existingTransactions,
          ...candidateTransactions,
        ]);

        const transactionInsertStatement =
          rowsToImport.length > 0
            ? database.insert(portfolioTransaction).values(
            rowsToImport.map((previewRow) => {
              const transaction = previewRow.transaction as PortfolioTransaction;
              const assetRecord = assetByTicker.get(transaction.ticker);

              if (!assetRecord) {
                throw new Error(
                  `Ticker ${transaction.ticker} não encontrado no catálogo.`,
                );
              }

              return {
                portfolioId: portfolioRecord.id,
                assetId: assetRecord.id,
                ticker: transaction.ticker,
                type: transaction.type,
                operationDate: transaction.operationDate,
                quantity: String(transaction.quantity),
                unitPriceCents: transaction.unitPriceCents,
                feesCents: transaction.feesCents,
                taxesCents: transaction.taxesCents,
                valueCents: transaction.valueCents,
                broker: transaction.broker,
                notes: transaction.notes,
                importFingerprint: previewRow.fingerprint,
              };
            }),
              )
            : undefined;

        const duplicateCount = preview.rows.filter(
          (previewRow) => previewRow.duplicate,
        ).length;
        const importRunInsertStatement = database.insert(importRun).values({
          userId: currentUser.id,
          portfolioId: portfolioRecord.id,
          filename,
          checksum,
          rowCount: preview.rows.length,
          importedCount: rowsToImport.length,
          duplicateCount,
          errorCount: 0,
          report: {
            importedRows: rowsToImport.map((previewRow) => previewRow.rowNumber),
            duplicateRows: preview.rows
              .filter((previewRow) => previewRow.duplicate)
              .map((previewRow) => previewRow.rowNumber),
          },
        });

        if (transactionInsertStatement) {
          await database.batch([
            transactionInsertStatement,
            importRunInsertStatement,
          ]);
        } else {
          await database.batch([importRunInsertStatement]);
        }

        const importResult = {
          importedCount: rowsToImport.length,
          duplicateCount,
          message: "Importação concluída.",
        };

    return Response.json(importResult);
  } catch (error) {
    const message =
      error instanceof NegativePositionError || error instanceof Error
        ? error.message
        : "Não foi possível concluir a importação.";
    return Response.json({ message }, { status: 422 });
  }
}
