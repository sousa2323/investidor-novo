import {
  ArrowRight,
  CircleDollarSign,
  Goal,
  PiggyBank,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { AllocationChart } from "@/components/portfolio/portfolio-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { applyProfileWeights } from "@/lib/calculations/score";
import { getCurrentPricesByTicker, listMarketAssets } from "@/lib/dal/assets";
import { getFavoriteTickers } from "@/lib/dal/favorites";
import { getMonthlyFinancialPlanDto } from "@/lib/dal/planner";
import { getPortfolioSummaryDto } from "@/lib/dal/portfolio";
import { getUserProfileDto } from "@/lib/dal/profile";
import { requireCurrentUser } from "@/lib/dal/session";
import { formatCurrencyFromCents } from "@/lib/formatters";
import type { MarketAsset, ScoreBreakdown } from "@/types/investment";

export const metadata: Metadata = {
  title: "Painel",
};

export default async function DashboardPage() {
  const currentUser = await requireCurrentUser();
  const currentPricesCents = await getCurrentPricesByTicker();
  const [
    profile,
    portfolioSummary,
    plannerResult,
    favoriteTickers,
    stockListing,
    fiiListing,
  ] = await Promise.all([
    getUserProfileDto(),
    getPortfolioSummaryDto(currentPricesCents),
    getMonthlyFinancialPlanDto(),
    getFavoriteTickers(),
    listMarketAssets("STOCK"),
    listMarketAssets("FII"),
  ]);

  function rankTopThree(listing: Awaited<ReturnType<typeof listMarketAssets>>) {
    const assetsByTicker = new Map(
      listing.assets.map((asset) => [asset.ticker, asset]),
    );

    return listing.percentiles
      .map((percentiles) => ({
        asset: assetsByTicker.get(percentiles.ticker),
        breakdown: applyProfileWeights(percentiles, profile.riskProfile),
      }))
      .filter(
        (entry): entry is { asset: MarketAsset; breakdown: ScoreBreakdown } =>
          Boolean(entry.asset) && entry.breakdown.eligibleForRanking,
      )
      .sort(
        (firstEntry, secondEntry) =>
          (secondEntry.breakdown.score ?? -1) - (firstEntry.breakdown.score ?? -1),
      )
      .slice(0, 3);
  }

  const rankedStocks = rankTopThree(stockListing);
  const rankedFiis = rankTopThree(fiiListing);
  const contributionProgress =
    plannerResult.summary.suggestedContributionCents === 0
      ? 0
      : Math.min(
          100,
          (plannerResult.summary.actualContributionCents /
            plannerResult.summary.suggestedContributionCents) *
            100,
        );
  const summaryCards = [
    {
      label: "Patrimônio",
      value: portfolioSummary.totalMarketValueCents,
      helper: "Sua carteira hoje",
      icon: PiggyBank,
    },
    {
      label: "Resultado total",
      value: portfolioSummary.totalResultCents,
      helper: "Realizado + em aberto + proventos",
      icon: TrendingUp,
    },
    {
      label: "Meta mensal",
      value: plannerResult.summary.suggestedContributionCents,
      helper: `${plannerResult.plan.contributionPercentage}% das receitas, limitado ao saldo`,
      icon: Goal,
    },
    {
      label: "Aportes no mês",
      value: plannerResult.summary.actualContributionCents,
      helper: "Compras registradas na carteira",
      icon: CircleDollarSign,
    },
  ];

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Visão geral"
        title={`Olá, ${currentUser.name.split(" ")[0]}`}
        description="Seu patrimônio, planejamento e estudos em uma visão simples."
        actions={
          <Button asChild>
            <Link href="/carteira/movimentacoes">
              Registrar aporte
              <ArrowRight />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((summaryCard) => {
          const Icon = summaryCard.icon;
          return (
            <Card key={summaryCard.label} size="sm">
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {summaryCard.label}
                    </p>
                    <p className="numeric mt-2 text-xl font-semibold">
                      {formatCurrencyFromCents(summaryCard.value)}
                    </p>
                  </div>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                  {summaryCard.helper}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Meta do mês</CardTitle>
            <CardDescription>
              Planejador comparado com compras reais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Realizado</p>
                <p className="numeric mt-1 text-2xl font-semibold text-primary">
                  {formatCurrencyFromCents(
                    plannerResult.summary.actualContributionCents,
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Meta sugerida</p>
                <p className="numeric mt-1 text-base font-medium">
                  {formatCurrencyFromCents(
                    plannerResult.summary.suggestedContributionCents,
                  )}
                </p>
              </div>
            </div>
            <Progress value={contributionProgress} className="mt-5" />
            <div className="mt-4 flex justify-between text-xs text-muted-foreground">
              <span>
                Saldo disponível:{" "}
                {formatCurrencyFromCents(
                  plannerResult.summary.availableMonthlyBalanceCents,
                )}
              </span>
              <Link
                href="/planejador"
                className="font-medium text-primary hover:underline"
              >
                Abrir planejador
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alocação</CardTitle>
            <CardDescription>Distribuição atual por ativo</CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationChart
              positions={portfolioSummary.positions}
              currentPricesCents={currentPricesCents}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <RankingCard
          title="Ações aderentes ao perfil"
          description="Maior aderência entre os dados de referência"
          entries={rankedStocks}
          href="/acoes"
        />
        <RankingCard
          title="FIIs aderentes ao perfil"
          description="Risco e regularidade limitam scores frágeis"
          entries={rankedFiis}
          href="/fiis"
        />
      </section>

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Favoritos</CardTitle>
            <CardDescription>Ativos separados para estudo</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/favoritos">Ver todos</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {favoriteTickers.size === 0 ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              Você ainda não favoritou nenhum ativo.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...favoriteTickers].map((ticker) => (
                <Badge key={ticker} variant="secondary" className="numeric">
                  {ticker}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RankingCard({
  title,
  description,
  entries,
  href,
}: {
  title: string;
  description: string;
  entries: Array<{ asset: MarketAsset; breakdown: ScoreBreakdown }>;
  href: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={href}>Analisar</Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-2">
        {entries.map(({ asset, breakdown }, entryIndex) => (
          <Link
            key={asset.ticker}
            href={`${href}/${asset.ticker}`}
            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            <span className="numeric flex size-7 items-center justify-center rounded-md bg-muted text-xs font-medium">
              {entryIndex + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{asset.ticker}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {asset.classification}
              </span>
            </span>
            <span className="text-right">
              <span className="numeric block text-sm font-semibold text-primary">
                {breakdown.score}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                {breakdown.confidence}% confiança
              </span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
