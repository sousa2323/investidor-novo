import { Heart } from "lucide-react";
import type { Metadata } from "next";

import { AssetScreener } from "@/components/assets/asset-screener";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { listMarketAssets } from "@/lib/dal/assets";
import { getFavoriteTickers } from "@/lib/dal/favorites";
import { getUserProfileDto } from "@/lib/dal/profile";
import { requireCurrentUser } from "@/lib/dal/session";

export const metadata: Metadata = {
  title: "Favoritos",
};

export default async function FavoritesPage() {
  await requireCurrentUser();
  const [favoriteTickers, profile, stockListing, fiiListing] = await Promise.all([
    getFavoriteTickers(),
    getUserProfileDto(),
    listMarketAssets("STOCK"),
    listMarketAssets("FII"),
  ]);
  // Os percentis seguem sendo os do universo inteiro: comparar um favorito
  // apenas com os outros favoritos distorceria o score.
  const favoriteStocks = stockListing.assets.filter((asset) =>
    favoriteTickers.has(asset.ticker),
  );
  const favoriteFiis = fiiListing.assets.filter((asset) =>
    favoriteTickers.has(asset.ticker),
  );
  const hasFavorites = favoriteStocks.length > 0 || favoriteFiis.length > 0;

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Lista de acompanhamento"
        title="Favoritos"
        description="Reúna os ativos que você quer estudar com mais calma, sem confundir acompanhamento com recomendação."
      />
      {hasFavorites ? (
        <>
          {favoriteStocks.length > 0 ? (
            <section className="grid gap-3">
              <h2 className="text-sm font-semibold">Ações</h2>
              <AssetScreener
                assets={favoriteStocks}
                percentiles={stockListing.percentiles}
                assetType="STOCK"
                initialRiskProfile={profile.riskProfile}
                favoriteTickers={[...favoriteTickers]}
              />
            </section>
          ) : null}
          {favoriteFiis.length > 0 ? (
            <section className="grid gap-3">
              <h2 className="text-sm font-semibold">FIIs</h2>
              <AssetScreener
                assets={favoriteFiis}
                percentiles={fiiListing.percentiles}
                assetType="FII"
                initialRiskProfile={profile.riskProfile}
                favoriteTickers={[...favoriteTickers]}
              />
            </section>
          ) : null}
        </>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Heart className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium">Nenhum favorito ainda</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use o coração nas telas de ações e FIIs.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
