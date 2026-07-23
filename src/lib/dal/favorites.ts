import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { asset, favorite } from "@/db/schema";
import { requireCurrentUser } from "@/lib/dal/session";

export async function getFavoriteTickers(): Promise<Set<string>> {
  const currentUser = await requireCurrentUser();
  const favoriteRecords = await getDatabase()
    .select({ ticker: asset.ticker })
    .from(favorite)
    .innerJoin(asset, eq(favorite.assetId, asset.id))
    .where(eq(favorite.userId, currentUser.id));

  return new Set(favoriteRecords.map((favoriteRecord) => favoriteRecord.ticker));
}
