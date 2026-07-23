import {
  CalendarDays,
  CircleHelp,
  Database,
  Gauge,
  History,
  Info,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { FavoriteButton } from "@/components/assets/favorite-button";
import { AssetPriceChart } from "@/components/assets/asset-price-chart";
import { EducationalNotice } from "@/components/feedback/educational-notice";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { applyProfileWeights } from "@/lib/calculations/score";
import type { MarketAssetDetail } from "@/lib/dal/assets";
import {
  estimateAnnualDividendCents,
  formatCompactCurrencyFromCents,
  formatCurrencyFromCents,
  formatDate,
  formatDateTime,
  formatPercentage,
  formatSignedPercentage,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { MarketAsset, RiskProfile } from "@/types/investment";

interface AssetDetailProps {
  detail: MarketAssetDetail;
  riskProfile: RiskProfile;
  initiallyFavorited: boolean;
}

const metricDescriptions: Record<string, string> = {
  "Dividend Yield": "Proventos dos últimos 12 meses divididos pelo preço.",
  Payout: "Parcela do lucro distribuída aos acionistas.",
  ROE: "Lucro líquido de 12 meses sobre o patrimônio líquido médio.",
  ROIC: "NOPAT sobre o capital investido. Não se aplica a bancos e seguradoras.",
  "Dívida / EBITDA":
    "Relação entre dívida líquida e geração operacional. Não se aplica a instituições financeiras.",
  "Margem líquida": "Lucro líquido de 12 meses dividido pela receita do período.",
  "Crescimento 5 anos":
    "CAGR entre exercícios comparáveis; bases negativas ficam indisponíveis.",
  "Histórico de dividendos": "Regularidade observada no histórico de distribuições.",
  "P/VP":
    "Preço de mercado dividido pelo valor patrimonial da cota, apurado no informe mensal da CVM.",
  "DY 12 meses":
    "Soma dos rendimentos mensais informados à CVM nos últimos 12 meses.",
  "Liquidez média": "Volume financeiro médio negociado diariamente.",
  Vacância:
    "Percentual de área desocupada. Só consta no informe trimestral, por isso aparece indisponível aqui.",
  Risco:
    "Combina a composição da carteira entre tijolo e papel com a regularidade das distribuições.",
  "Idade do fundo": "Tempo desde o início de funcionamento registrado na CVM.",
};

function profileLabel(riskProfile: RiskProfile): string {
  return {
    CONSERVATIVE: "Conservador",
    MODERATE: "Moderado",
    AGGRESSIVE: "Arrojado",
  }[riskProfile];
}

function getMetricCards(asset: MarketAsset) {
  if (asset.type === "STOCK") {
    return [
      { label: "Dividend Yield", value: formatPercentage(asset.stockMetrics?.dividendYield ?? null) },
      { label: "Payout", value: formatPercentage(asset.stockMetrics?.payout ?? null) },
      { label: "ROE", value: formatPercentage(asset.stockMetrics?.roe ?? null) },
      { label: "ROIC", value: formatPercentage(asset.stockMetrics?.roic ?? null) },
      {
        label: "Dívida / EBITDA",
        value:
          asset.stockMetrics?.netDebtToEbitda?.toLocaleString("pt-BR", {
            maximumFractionDigits: 2,
          }) ?? "Indisponível",
      },
      { label: "Margem líquida", value: formatPercentage(asset.stockMetrics?.netMargin ?? null) },
      {
        label: "Crescimento 5 anos",
        value:
          asset.stockMetrics?.profitGrowthFiveYears !== null &&
          asset.stockMetrics?.profitGrowthFiveYears !== undefined
            ? formatPercentage(asset.stockMetrics.profitGrowthFiveYears)
            : (asset.stockMetrics?.profitGrowthLabel ?? "Indisponível"),
      },
      {
        label: "Histórico de dividendos",
        value: asset.stockMetrics?.dividendHistoryLabel ?? "Indisponível",
      },
    ];
  }

  return [
    {
      label: "P/VP",
      value:
        asset.fiiMetrics?.priceToBook?.toLocaleString("pt-BR", {
          maximumFractionDigits: 2,
        }) ?? "Indisponível",
    },
    {
      label: "DY 12 meses",
      value: formatPercentage(asset.fiiMetrics?.dividendYieldTwelveMonths ?? null),
    },
    {
      label: "Liquidez média",
      value: formatCompactCurrencyFromCents(
        asset.fiiMetrics?.averageDailyLiquidityCents ?? null,
      ),
    },
    {
      label: "Vacância",
      value: formatPercentage(asset.fiiMetrics?.vacancyRate ?? null),
    },
    { label: "Risco", value: asset.fiiMetrics?.riskLabel ?? "Indisponível" },
    {
      label: "Idade do fundo",
      value:
        asset.fiiMetrics?.ageYears === null || asset.fiiMetrics?.ageYears === undefined
          ? "Indisponível"
          : `${asset.fiiMetrics.ageYears.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} anos`,
    },
  ];
}

export function AssetDetail({
  detail,
  riskProfile,
  initiallyFavorited,
}: AssetDetailProps) {
  const { asset } = detail;
  const scoreBreakdown = detail.percentiles
    ? applyProfileWeights(detail.percentiles, riskProfile)
    : { score: null, confidence: 0, eligibleForRanking: false, contributions: [] };
  const listPath = asset.type === "STOCK" ? "/acoes" : "/fiis";

  return (
    <div className="page-grid">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={listPath}
            className="text-xs font-medium text-primary hover:underline"
          >
            ← Voltar para {asset.type === "STOCK" ? "ações" : "FIIs"}
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {asset.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.logoUrl}
                alt=""
                aria-hidden="true"
                className="size-9 rounded-full bg-muted object-contain"
              />
            ) : null}
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              {asset.ticker}
            </h1>
            <Badge variant="secondary">{asset.classification}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{asset.name}</p>
        </div>
        <div className="flex gap-2">
          <FavoriteButton
            ticker={asset.ticker}
            assetType={asset.type}
            initialFavorited={initiallyFavorited}
            showLabel
          />
          <Button asChild>
            <Link href={`/carteira/movimentacoes?ticker=${asset.ticker}`}>
              Registrar movimentação
            </Link>
          </Button>
        </div>
      </div>

      <EducationalNotice compact />

      {detail.fundamentalsWarning ? (
        <Alert>
          <Info className="size-4" aria-hidden="true" />
          <AlertDescription>
            {detail.fundamentalsWarning} Os indicadores exibidos são os últimos
            gravados; o que nunca foi carregado aparece como indisponível.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <p className="text-xs text-muted-foreground">Preço</p>
            <p className="numeric mt-1 text-2xl font-semibold">
              {asset.currentPriceCents > 0
                ? formatCurrencyFromCents(asset.currentPriceCents)
                : "Indisponível"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Variação do dia</p>
            <p
              className={cn(
                "numeric mt-1 text-2xl font-semibold",
                (asset.changePercent ?? 0) > 0 && "text-emerald-600 dark:text-emerald-400",
                (asset.changePercent ?? 0) < 0 && "text-red-600 dark:text-red-400",
              )}
            >
              {formatSignedPercentage(asset.changePercent)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Mín. / máx. 52 semanas</p>
            <p className="numeric mt-1 text-sm font-medium">
              {detail.fiftyTwoWeekLowCents !== null &&
              detail.fiftyTwoWeekHighCents !== null
                ? `${formatCurrencyFromCents(detail.fiftyTwoWeekLowCents)} – ${formatCurrencyFromCents(detail.fiftyTwoWeekHighCents)}`
                : "Indisponível"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {asset.type === "FII" ? "Rendimento mensal" : "Provento 12m estimado"}
            </p>
            <p className="numeric mt-1 text-sm font-medium">
              {(() => {
                if (asset.type === "FII") {
                  const monthlyDividendCents =
                    asset.fiiMetrics?.lastMonthlyDividendCents ?? null;
                  return monthlyDividendCents === null
                    ? "Indisponível"
                    : `${formatCurrencyFromCents(monthlyDividendCents)} por cota`;
                }
                const dividendYield = asset.stockMetrics?.dividendYield;
                const annualDividendCents = estimateAnnualDividendCents(
                  asset.currentPriceCents,
                  dividendYield,
                );
                return annualDividendCents === null
                  ? "Indisponível"
                  : `${formatCurrencyFromCents(annualDividendCents)} · ${formatPercentage(dividendYield ?? null)}`;
              })()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valor de mercado</p>
            <p className="numeric mt-1 text-sm font-medium">
              {formatCompactCurrencyFromCents(asset.marketCapCents ?? null)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Indicadores</CardTitle>
            <CardDescription>
              Valores de referência usados no cálculo atual
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-4">
            {getMetricCards(asset).map((metric) => (
              <div key={metric.label}>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {metric.label}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CircleHelp
                        className="size-3.5 cursor-help"
                        aria-label={`Explicação de ${metric.label}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">
                      {metricDescriptions[metric.label] ??
                        "Indicador usado como parte da análise comparativa."}
                    </TooltipContent>
                  </Tooltip>
                </p>
                <p className="numeric mt-1.5 text-lg font-semibold">{metric.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Aderência ao perfil</CardTitle>
                <CardDescription>{profileLabel(riskProfile)}</CardDescription>
              </div>
              <span className="numeric text-3xl font-semibold text-primary">
                {scoreBreakdown.score ?? "—"}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-5">
              <div className="mb-2 flex justify-between text-xs">
                <span>Confiança dos dados</span>
                <span className="numeric font-medium">
                  {scoreBreakdown.confidence}%
                </span>
              </div>
              <Progress value={scoreBreakdown.confidence} />
            </div>
            <div className="grid gap-3">
              {scoreBreakdown.contributions.map((contribution) => (
                <div key={contribution.metric}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate">{contribution.label}</span>
                    <span className="numeric shrink-0 text-muted-foreground">
                      {contribution.availability === "AVAILABLE"
                        ? `${contribution.normalizedScore} × ${contribution.weight}%`
                        : contribution.availability === "NOT_APPLICABLE"
                          ? "Não aplicável"
                          : "Ausente"}
                    </span>
                  </div>
                  {contribution.availability === "AVAILABLE" ? (
                    <Progress
                      value={contribution.normalizedScore ?? 0}
                      className="mt-1.5 h-1"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" aria-hidden="true" />
            Histórico de preço
          </CardTitle>
          <CardDescription>Fechamentos ajustados por período</CardDescription>
        </CardHeader>
        <CardContent>
          <AssetPriceChart priceHistory={detail.priceHistory} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4 text-primary" aria-hidden="true" />
              Proventos
            </CardTitle>
            <CardDescription>
              {asset.type === "STOCK"
                ? "Dividendos e JCP declarados"
                : "Rendimentos e amortizações declarados"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detail.dividends.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/30 px-5 py-10 text-center">
                <p className="text-sm font-medium">Nenhum provento registrado</p>
                <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">
                  A fonte não retornou distribuições para este ativo. Ausência de
                  registro não significa ausência de pagamento.
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data-com</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.dividends.map((dividend, dividendIndex) => (
                      <TableRow
                        key={`${dividend.paymentDate}-${dividend.label}-${dividendIndex}`}
                      >
                        <TableCell>
                          <Badge variant="outline">{dividend.label}</Badge>
                        </TableCell>
                        <TableCell className="numeric text-xs">
                          {dividend.lastDatePrior
                            ? formatDate(`${dividend.lastDatePrior}T00:00:00`)
                            : "—"}
                        </TableCell>
                        <TableCell className="numeric text-xs">
                          {dividend.paymentDate
                            ? formatDate(`${dividend.paymentDate}T00:00:00`)
                            : "—"}
                        </TableCell>
                        <TableCell className="numeric text-right text-xs">
                          {formatCurrencyFromCents(Math.round(dividend.rate * 100))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4 text-primary" aria-hidden="true" />
              Rastreabilidade
            </CardTitle>
            <CardDescription>De onde veio cada número</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Fonte</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {asset.type === "STOCK"
                    ? "Cotação e fundamentos: brapi.dev, sobre dados públicos da B3 e da CVM."
                    : "Cotação e proventos: brapi.dev. P/VP, rendimentos e idade: Informe Mensal de FII da CVM."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Data e competência</p>
                <p className="numeric mt-0.5 text-xs text-muted-foreground">
                  Cotação de {asset.quotedAt ? formatDateTime(asset.quotedAt) : "—"}
                  {detail.fundamentalsFetchedAt
                    ? ` · fundamentos de ${formatDateTime(detail.fundamentalsFetchedAt)}`
                    : " · fundamentos ainda não carregados"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Gauge className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Versão de cálculo</p>
                <p className="numeric mt-0.5 text-xs text-muted-foreground">
                  {asset.calculationVersion}
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs leading-5 text-muted-foreground">
                A cotação de fonte pública tem atraso de aproximadamente 15 minutos
                em relação ao pregão. Indicadores sem dado na fonte permanecem
                indisponíveis e saem do denominador do score, em vez de receberem
                estimativa.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {detail.businessSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>Sobre a empresa</CardTitle>
            {detail.website ? (
              <CardDescription>
                <a
                  href={detail.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {detail.website}
                </a>
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 whitespace-pre-line text-muted-foreground">
              {detail.businessSummary}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
