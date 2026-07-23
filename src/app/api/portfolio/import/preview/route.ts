import { and, eq, isNotNull } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  asset,
  portfolio,
  portfolioTransaction,
} from "@/db/schema";
import {
  calculateFileChecksum,
  parsePortfolioCsv,
} from "@/lib/import/portfolio-csv";
import { getCurrentUserOrNull } from "@/lib/dal/session";
import type { AssetType } from "@/types/investment";

export async function POST(request: Request) {
  const currentUser = await getCurrentUserOrNull();

  if (!currentUser) {
    return Response.json({ message: "Sessão expirada." }, { status: 401 });
  }

  const formData = await request.formData();
  const uploadedFile = formData.get("file");

  if (!(uploadedFile instanceof File)) {
    return Response.json(
      { message: "Selecione um arquivo CSV." },
      { status: 400 },
    );
  }

  if (uploadedFile.size > 2 * 1024 * 1024) {
    return Response.json(
      { message: "O arquivo deve ter no máximo 2 MB." },
      { status: 413 },
    );
  }

  const fileContent = await uploadedFile.text();
  const database = getDatabase();
  const databaseAssets = await database
    .select({ ticker: asset.ticker, type: asset.type })
    .from(asset);
  const knownAssetTypes = new Map<string, AssetType>(
    databaseAssets.map((assetRecord) => [assetRecord.ticker, assetRecord.type]),
  );
  const portfolioRecord = await database.query.portfolio.findFirst({
    where: eq(portfolio.userId, currentUser.id),
    columns: { id: true },
  });
  const storedFingerprints = portfolioRecord
    ? await database
        .select({ fingerprint: portfolioTransaction.importFingerprint })
        .from(portfolioTransaction)
        .where(
          and(
            eq(portfolioTransaction.portfolioId, portfolioRecord.id),
            isNotNull(portfolioTransaction.importFingerprint),
          ),
        )
    : [];
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

  return Response.json({
    filename: uploadedFile.name,
    checksum: calculateFileChecksum(fileContent),
    fileContent,
    ...preview,
    summary: {
      totalRows: preview.rows.length,
      validRows: preview.rows.filter(
        (previewRow) => previewRow.errors.length === 0 && !previewRow.duplicate,
      ).length,
      duplicateRows: preview.rows.filter((previewRow) => previewRow.duplicate)
        .length,
      invalidRows: preview.rows.filter(
        (previewRow) => previewRow.errors.length > 0,
      ).length,
    },
  });
}
