import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssetDetail } from "@/components/assets/asset-detail";
import { getMarketAssetDetail } from "@/lib/dal/assets";
import { getFavoriteTickers } from "@/lib/dal/favorites";
import { getUserProfileDto } from "@/lib/dal/profile";
import { requireCurrentUser } from "@/lib/dal/session";

interface FiiDetailPageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({
  params,
}: FiiDetailPageProps): Promise<Metadata> {
  const { ticker } = await params;
  const normalizedTicker = decodeURIComponent(ticker).toUpperCase();
  const detail = await getMarketAssetDetail(normalizedTicker, "FII").catch(
    () => null,
  );

  return {
    title: detail ? `${normalizedTicker} · ${detail.asset.name}` : normalizedTicker,
  };
}

export default async function FiiDetailPage({ params }: FiiDetailPageProps) {
  await requireCurrentUser();
  const { ticker } = await params;
  const normalizedTicker = decodeURIComponent(ticker).toUpperCase();
  const [profile, favoriteTickers, detail] = await Promise.all([
    getUserProfileDto(),
    getFavoriteTickers(),
    getMarketAssetDetail(normalizedTicker, "FII"),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <AssetDetail
      detail={detail}
      riskProfile={profile.riskProfile}
      initiallyFavorited={favoriteTickers.has(detail.asset.ticker)}
    />
  );
}
