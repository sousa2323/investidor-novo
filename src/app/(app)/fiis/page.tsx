import type { Metadata } from "next";

import { AssetScreener } from "@/components/assets/asset-screener";
import { EducationalNotice } from "@/components/feedback/educational-notice";
import { PageHeader } from "@/components/layout/page-header";
import { listMarketAssets } from "@/lib/dal/assets";
import { getFavoriteTickers } from "@/lib/dal/favorites";
import { getUserProfileDto } from "@/lib/dal/profile";
import { requireCurrentUser } from "@/lib/dal/session";

export const metadata: Metadata = {
  title: "Análise de FIIs",
};

export default async function FiisPage() {
  await requireCurrentUser();
  const [profile, favoriteTickers, listing] = await Promise.all([
    getUserProfileDto(),
    getFavoriteTickers(),
    listMarketAssets("FII"),
  ]);

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Fundos imobiliários"
        title="FIIs"
        description="Estude P/VP, rendimentos, liquidez e risco de todos os FIIs listados na B3. DY alto nunca esconde risco extremo no score."
      />
      <EducationalNotice compact />
      <AssetScreener
        assets={listing.assets}
        percentiles={listing.percentiles}
        assetType="FII"
        initialRiskProfile={profile.riskProfile}
        favoriteTickers={[...favoriteTickers]}
      />
    </div>
  );
}
