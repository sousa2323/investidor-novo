import type { Metadata } from "next";

import { AssetScreener } from "@/components/assets/asset-screener";
import { EducationalNotice } from "@/components/feedback/educational-notice";
import { PageHeader } from "@/components/layout/page-header";
import { listMarketAssets } from "@/lib/dal/assets";
import { getFavoriteTickers } from "@/lib/dal/favorites";
import { getUserProfileDto } from "@/lib/dal/profile";
import { requireCurrentUser } from "@/lib/dal/session";

export const metadata: Metadata = {
  title: "Análise de ações",
};

export default async function StocksPage() {
  await requireCurrentUser();
  const [profile, favoriteTickers, listing] = await Promise.all([
    getUserProfileDto(),
    getFavoriteTickers(),
    listMarketAssets("STOCK"),
  ]);

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Análise fundamentalista"
        title="Ações"
        description="Compare todas as empresas listadas na B3 por indicadores reais, com pesos ajustados ao seu perfil e tratamento explícito de dados ausentes."
      />
      <EducationalNotice compact />
      <AssetScreener
        assets={listing.assets}
        percentiles={listing.percentiles}
        assetType="STOCK"
        initialRiskProfile={profile.riskProfile}
        favoriteTickers={[...favoriteTickers]}
      />
    </div>
  );
}
