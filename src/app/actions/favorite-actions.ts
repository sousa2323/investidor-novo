"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDatabase } from "@/db";
import { asset, favorite } from "@/db/schema";
import { requireCurrentUser } from "@/lib/dal/session";

const favoriteSchema = z.object({
  ticker: z.string().trim().toUpperCase().regex(/^[A-Z]{4}\d{1,2}$/),
  assetType: z.enum(["STOCK", "FII"]),
});

export async function toggleFavoriteAction(
  ticker: string,
  assetType: "STOCK" | "FII",
): Promise<{ favorited: boolean; message: string }> {
  const currentUser = await requireCurrentUser();
  const parsedFavorite = favoriteSchema.parse({ ticker, assetType });
  const database = getDatabase();
  const assetRecord = await database.query.asset.findFirst({
    where: and(
      eq(asset.ticker, parsedFavorite.ticker),
      eq(asset.type, parsedFavorite.assetType),
    ),
    columns: { id: true },
  });

  if (!assetRecord) {
    return {
      favorited: false,
      message: "Ativo ainda não sincronizado com o catálogo.",
    };
  }

  const existingFavorite = await database.query.favorite.findFirst({
    where: and(
      eq(favorite.userId, currentUser.id),
      eq(favorite.assetId, assetRecord.id),
    ),
    columns: { assetId: true },
  });

  if (existingFavorite) {
    await database
      .delete(favorite)
      .where(
        and(
          eq(favorite.userId, currentUser.id),
          eq(favorite.assetId, assetRecord.id),
        ),
      );
  } else {
    await database.insert(favorite).values({
      userId: currentUser.id,
      assetId: assetRecord.id,
    });
  }

  revalidatePath("/favoritos");
  revalidatePath("/painel");
  revalidatePath("/acoes");
  revalidatePath("/fiis");

  return {
    favorited: !existingFavorite,
    message: existingFavorite
      ? "Ativo removido dos favoritos."
      : "Ativo adicionado aos favoritos.",
  };
}
