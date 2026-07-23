"use client";

import {
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { FavoriteButton } from "@/components/assets/favorite-button";
import { useLiveQuotes } from "@/components/assets/use-live-quotes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  applyProfileWeights,
  type AssetMetricPercentiles,
} from "@/lib/calculations/score";
import {
  estimateAnnualDividendCents,
  formatCompactCurrencyFromCents,
  formatCurrencyFromCents,
  formatPercentage,
  formatRelativeTime,
  formatSectorLabel,
  formatSignedPercentage,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  AssetType,
  MarketAsset,
  RiskProfile,
  ScoreBreakdown,
} from "@/types/investment";

interface AssetScreenerProps {
  assets: MarketAsset[];
  percentiles: AssetMetricPercentiles[];
  assetType: AssetType;
  initialRiskProfile: RiskProfile;
  favoriteTickers: string[];
}

const riskProfileOptions: Array<{ value: RiskProfile; label: string }> = [
  { value: "CONSERVATIVE", label: "Conservador" },
  { value: "MODERATE", label: "Moderado" },
  { value: "AGGRESSIVE", label: "Arrojado" },
];

const pageSize = 50;

function getScoreBadgeVariant(score: number | null) {
  if (score === null) {
    return "secondary" as const;
  }
  if (score >= 70) {
    return "default" as const;
  }
  if (score >= 45) {
    return "secondary" as const;
  }
  return "outline" as const;
}

function getPrimaryMetrics(asset: MarketAsset) {
  if (asset.type === "STOCK") {
    return [
      { label: "DY", value: formatPercentage(asset.stockMetrics?.dividendYield ?? null) },
      { label: "ROE", value: formatPercentage(asset.stockMetrics?.roe ?? null) },
      {
        label: "Dív./EBITDA",
        value:
          asset.stockMetrics?.netDebtToEbitda === null ||
          asset.stockMetrics?.netDebtToEbitda === undefined
            ? "Indisponível"
            : asset.stockMetrics.netDebtToEbitda.toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              }),
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
      label: "DY 12M",
      value: formatPercentage(
        asset.fiiMetrics?.dividendYieldTwelveMonths ?? null,
      ),
    },
    {
      label: "Liquidez",
      value: formatCompactCurrencyFromCents(
        asset.fiiMetrics?.averageDailyLiquidityCents ?? null,
      ),
    },
  ];
}

function getDividendYield(asset: MarketAsset): number | null {
  const dividendYield =
    asset.type === "STOCK"
      ? asset.stockMetrics?.dividendYield
      : asset.fiiMetrics?.dividendYieldTwelveMonths;
  return dividendYield ?? null;
}

/**
 * Dividendo por cota/ação.
 *
 * Para FII mostra o último rendimento mensal declarado (valor real da CVM); para
 * ação, que não distribui todo mês, mostra o provento anual estimado a partir do
 * DY e do preço — este acompanha o preço em tempo real.
 */
function DividendCell({
  asset,
  align = "end",
}: {
  asset: MarketAsset;
  align?: "start" | "end";
}) {
  const alignmentClass = align === "start" ? "items-start" : "items-end";

  if (asset.type === "FII") {
    const monthlyDividendCents = asset.fiiMetrics?.lastMonthlyDividendCents ?? null;
    if (monthlyDividendCents === null) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    return (
      <span className={cn("inline-flex flex-col", alignmentClass)}>
        <span className="numeric text-sm font-medium">
          {formatCurrencyFromCents(monthlyDividendCents)}
        </span>
        <span className="text-[10px] text-muted-foreground">por mês/cota</span>
      </span>
    );
  }

  const dividendYield = getDividendYield(asset);
  const annualDividendCents = estimateAnnualDividendCents(
    asset.currentPriceCents,
    dividendYield,
  );

  if (annualDividendCents === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <span className={cn("inline-flex flex-col", alignmentClass)}>
      <span className="numeric text-sm font-medium">
        {formatCurrencyFromCents(annualDividendCents)}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {formatPercentage(dividendYield)} a.a.
      </span>
    </span>
  );
}

function ChangeBadge({ changePercent }: { changePercent: number | null | undefined }) {
  if (changePercent === null || changePercent === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <span
      className={cn(
        "numeric text-xs font-medium",
        changePercent > 0 && "text-emerald-600 dark:text-emerald-400",
        changePercent < 0 && "text-red-600 dark:text-red-400",
        changePercent === 0 && "text-muted-foreground",
      )}
    >
      {formatSignedPercentage(changePercent)}
    </span>
  );
}

function AssetIdentity({ asset }: { asset: MarketAsset }) {
  const detailHref = `/${asset.type === "STOCK" ? "acoes" : "fiis"}/${asset.ticker}`;

  return (
    <div className="flex items-center gap-2.5">
      {asset.logoUrl ? (
        // Logos vêm de um CDN externo variável; <img> evita configurar cada host
        // no next/image só para um ícone de 28px.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.logoUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="size-7 shrink-0 rounded-full bg-muted object-contain"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
        >
          {asset.ticker.slice(0, 2)}
        </span>
      )}
      <div className="min-w-0">
        <Link href={detailHref} className="font-semibold hover:text-primary">
          {asset.ticker}
        </Link>
        <p className="mt-0.5 max-w-48 truncate text-xs text-muted-foreground">
          {asset.name}
        </p>
      </div>
    </div>
  );
}

export function AssetScreener({
  assets,
  percentiles,
  assetType,
  initialRiskProfile,
  favoriteTickers,
}: AssetScreenerProps) {
  const [riskProfile, setRiskProfile] = useState<RiskProfile>(initialRiskProfile);
  const [searchTerm, setSearchTerm] = useState("");
  const [classification, setClassification] = useState("ALL");
  const [sortMode, setSortMode] = useState<"SCORE" | "TICKER" | "DY" | "CHANGE">(
    "SCORE",
  );
  const [comparisonTickers, setComparisonTickers] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const { quotesByTicker, refreshedAt } = useLiveQuotes(assetType);

  const classifications = useMemo(
    () => [...new Set(assets.map((asset) => asset.classification))].sort(),
    [assets],
  );

  // O polling só traz preço, variação e volume; os fundamentos continuam sendo
  // os que o servidor renderizou.
  const livedAssets = useMemo(() => {
    if (quotesByTicker.size === 0) {
      return assets;
    }

    return assets.map((asset) => {
      const quote = quotesByTicker.get(asset.ticker);

      if (!quote) {
        return asset;
      }

      return {
        ...asset,
        currentPriceCents: quote.priceCents,
        changePercent: quote.changePercent,
        dailyVolumeCents: quote.dailyVolumeCents,
        quotedAt: quote.quotedAt,
        fiiMetrics:
          asset.fiiMetrics && quote.lastMonthlyDividendCents !== undefined
            ? {
                ...asset.fiiMetrics,
                lastMonthlyDividendCents: quote.lastMonthlyDividendCents,
              }
            : asset.fiiMetrics,
      };
    });
  }, [assets, quotesByTicker]);

  const rankedAssets = useMemo(() => {
    const percentilesByTicker = new Map(
      percentiles.map((entry) => [entry.ticker, entry]),
    );

    return livedAssets.map((asset) => {
      const assetPercentiles = percentilesByTicker.get(asset.ticker);

      return {
        asset,
        breakdown: assetPercentiles
          ? applyProfileWeights(assetPercentiles, riskProfile)
          : ({
              ticker: asset.ticker,
              score: null,
              confidence: 0,
              eligibleForRanking: false,
              contributions: [],
            } satisfies ScoreBreakdown),
      };
    });
  }, [livedAssets, percentiles, riskProfile]);

  const visibleAssets = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const filteredAssets = rankedAssets.filter(({ asset }) => {
      const matchesSearch =
        !normalizedSearchTerm ||
        asset.ticker.toLowerCase().includes(normalizedSearchTerm) ||
        asset.name.toLowerCase().includes(normalizedSearchTerm);
      const matchesClassification =
        classification === "ALL" || asset.classification === classification;
      return matchesSearch && matchesClassification;
    });

    return filteredAssets.sort((firstEntry, secondEntry) => {
      if (sortMode === "TICKER") {
        return firstEntry.asset.ticker.localeCompare(secondEntry.asset.ticker);
      }
      if (sortMode === "CHANGE") {
        return (
          (secondEntry.asset.changePercent ?? Number.NEGATIVE_INFINITY) -
          (firstEntry.asset.changePercent ?? Number.NEGATIVE_INFINITY)
        );
      }
      if (sortMode === "DY") {
        const firstDividendYield =
          firstEntry.asset.type === "STOCK"
            ? firstEntry.asset.stockMetrics?.dividendYield
            : firstEntry.asset.fiiMetrics?.dividendYieldTwelveMonths;
        const secondDividendYield =
          secondEntry.asset.type === "STOCK"
            ? secondEntry.asset.stockMetrics?.dividendYield
            : secondEntry.asset.fiiMetrics?.dividendYieldTwelveMonths;
        return (secondDividendYield ?? -1) - (firstDividendYield ?? -1);
      }
      if (
        firstEntry.breakdown.eligibleForRanking !==
        secondEntry.breakdown.eligibleForRanking
      ) {
        return firstEntry.breakdown.eligibleForRanking ? -1 : 1;
      }
      return (
        (secondEntry.breakdown.score ?? -1) - (firstEntry.breakdown.score ?? -1)
      );
    });
  }, [classification, rankedAssets, searchTerm, sortMode]);

  const pageCount = Math.max(1, Math.ceil(visibleAssets.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pagedAssets = visibleAssets.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize,
  );

  const comparedAssets = comparisonTickers
    .map((ticker) => rankedAssets.find(({ asset }) => asset.ticker === ticker))
    .filter(
      (entry): entry is { asset: MarketAsset; breakdown: ScoreBreakdown } =>
        Boolean(entry),
    );

  // Todo filtro volta para a primeira página: manter a página 7 depois de uma
  // busca que devolve 3 itens mostraria uma tela vazia.
  function changeSearchTerm(nextSearchTerm: string) {
    setSearchTerm(nextSearchTerm);
    setPageIndex(0);
  }

  function changeClassification(nextClassification: string) {
    setClassification(nextClassification);
    setPageIndex(0);
  }

  function changeSortMode(nextSortMode: string) {
    setSortMode(nextSortMode as "SCORE" | "TICKER" | "DY" | "CHANGE");
    setPageIndex(0);
  }

  function toggleComparison(ticker: string) {
    setComparisonTickers((currentTickers) => {
      if (currentTickers.includes(ticker)) {
        return currentTickers.filter((currentTicker) => currentTicker !== ticker);
      }
      if (currentTickers.length >= 3) {
        return currentTickers;
      }
      return [...currentTickers, ticker];
    });
  }

  return (
    <div className="grid gap-5">
      <Card className="overflow-visible">
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_220px_180px_auto]">
          <div className="relative">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="h-10 bg-background pl-9"
              value={searchTerm}
              onChange={(event) => changeSearchTerm(event.target.value)}
              placeholder="Buscar por ticker ou nome"
              aria-label="Buscar ativo"
            />
          </div>
          <Select value={classification} onValueChange={changeClassification}>
            <SelectTrigger className="h-10 w-full bg-background">
              <SelectValue placeholder="Setor ou segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os setores</SelectItem>
              {classifications.map((classificationOption) => (
                <SelectItem key={classificationOption} value={classificationOption}>
                  {formatSectorLabel(classificationOption)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortMode}
            onValueChange={changeSortMode}
          >
            <SelectTrigger className="h-10 w-full bg-background">
              <ArrowUpDown aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SCORE">Maior aderência</SelectItem>
              <SelectItem value="DY">Maior DY</SelectItem>
              <SelectItem value="CHANGE">Maior alta do dia</SelectItem>
              <SelectItem value="TICKER">Ticker A–Z</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
            {riskProfileOptions.map((profileOption) => (
              <Button
                key={profileOption.value}
                type="button"
                size="sm"
                variant={riskProfile === profileOption.value ? "secondary" : "ghost"}
                className="flex-1"
                onClick={() => setRiskProfile(profileOption.value)}
              >
                {profileOption.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {comparedAssets.length > 0 ? (
        <ComparisonPanel
          entries={comparedAssets}
          onRemove={(ticker) => toggleComparison(ticker)}
        />
      ) : null}

      <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <span className="sr-only">Comparar</span>
              </TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead>Setor / segmento</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Dia</TableHead>
              <TableHead className="text-right">Dividendo</TableHead>
              <TableHead className="text-right">Indicadores</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedAssets.map(({ asset, breakdown }) => (
              <TableRow key={asset.ticker}>
                <TableCell>
                  <Checkbox
                    checked={comparisonTickers.includes(asset.ticker)}
                    disabled={
                      comparisonTickers.length >= 3 &&
                      !comparisonTickers.includes(asset.ticker)
                    }
                    onCheckedChange={() => toggleComparison(asset.ticker)}
                    aria-label={`Comparar ${asset.ticker}`}
                  />
                </TableCell>
                <TableCell>
                  <AssetIdentity asset={asset} />
                </TableCell>
                <TableCell>
                  <span
                    className="block max-w-40 truncate"
                    title={asset.classification}
                  >
                    {formatSectorLabel(asset.classification)}
                  </span>
                </TableCell>
                <TableCell className="numeric text-right">
                  {asset.currentPriceCents > 0
                    ? formatCurrencyFromCents(asset.currentPriceCents)
                    : "Indisponível"}
                </TableCell>
                <TableCell className="text-right">
                  <ChangeBadge changePercent={asset.changePercent} />
                </TableCell>
                <TableCell className="text-right">
                  <DividendCell asset={asset} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-4">
                    {getPrimaryMetrics(asset)
                      .slice(0, 2)
                      .map((metric) => (
                        <span key={metric.label} className="text-right">
                          <span className="block text-[10px] text-muted-foreground uppercase">
                            {metric.label}
                          </span>
                          <span className="numeric text-xs">{metric.value}</span>
                        </span>
                      ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <ScoreBadge breakdown={breakdown} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <FavoriteButton
                      ticker={asset.ticker}
                      assetType={asset.type}
                      initialFavorited={favoriteTickers.includes(asset.ticker)}
                    />
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        href={`/${asset.type === "STOCK" ? "acoes" : "fiis"}/${asset.ticker}`}
                      >
                        Ver
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {pagedAssets.map(({ asset, breakdown }) => (
          <Card key={asset.ticker} size="sm">
            <CardHeader className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
              <Checkbox
                className="mt-1"
                checked={comparisonTickers.includes(asset.ticker)}
                disabled={
                  comparisonTickers.length >= 3 &&
                  !comparisonTickers.includes(asset.ticker)
                }
                onCheckedChange={() => toggleComparison(asset.ticker)}
                aria-label={`Comparar ${asset.ticker}`}
              />
              <div>
                <Link
                  href={`/${asset.type === "STOCK" ? "acoes" : "fiis"}/${asset.ticker}`}
                  className="text-base font-semibold"
                >
                  {asset.ticker}
                </Link>
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={asset.classification}
                >
                  {formatSectorLabel(asset.classification)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <ScoreBadge breakdown={breakdown} />
                <FavoriteButton
                  ticker={asset.ticker}
                  assetType={asset.type}
                  initialFavorited={favoriteTickers.includes(asset.ticker)}
                />
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 border-t pt-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Preço</p>
                <p className="numeric mt-1 text-sm font-medium">
                  {asset.currentPriceCents > 0
                    ? formatCurrencyFromCents(asset.currentPriceCents)
                    : "Indisponível"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Dia</p>
                <p className="mt-1">
                  <ChangeBadge changePercent={asset.changePercent} />
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">
                  Dividendo
                </p>
                <p className="mt-1 flex justify-start">
                  <DividendCell asset={asset} align="start" />
                </p>
              </div>
              {getPrimaryMetrics(asset).map((metric) => (
                <div key={metric.label}>
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {metric.label}
                  </p>
                  <p className="numeric mt-1 text-sm font-medium">{metric.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {visibleAssets.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <SlidersHorizontal className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nenhum ativo encontrado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ajuste a busca ou remova algum filtro.
          </p>
        </div>
      ) : null}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Página {safePageIndex + 1} de {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePageIndex === 0}
              onClick={() => setPageIndex((currentPage) => currentPage - 1)}
            >
              <ChevronLeft aria-hidden="true" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePageIndex >= pageCount - 1}
              onClick={() => setPageIndex((currentPage) => currentPage + 1)}
            >
              Próxima
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs leading-5 text-muted-foreground">
        {visibleAssets.length} ativos no filtro atual, de {assets.length} listados na
        B3. Cotações atualizadas {formatRelativeTime(refreshedAt)} · dado público
        com atraso de aproximadamente 15 minutos. A comparação usa o próprio setor
        quando há amostra suficiente; caso contrário, usa a mesma classe de ativo.
        Marque até 3 ativos para comparar.
      </p>
    </div>
  );
}

function ScoreBadge({ breakdown }: { breakdown: ScoreBreakdown }) {
  if (!breakdown.eligibleForRanking) {
    return (
      <Badge variant="outline" className="whitespace-nowrap">
        Dados insuficientes
      </Badge>
    );
  }

  return (
    <Badge
      variant={getScoreBadgeVariant(breakdown.score)}
      className={cn(
        "numeric min-w-12 justify-center",
        (breakdown.score ?? 0) >= 70 && "bg-primary text-primary-foreground",
      )}
      title={`Confiança dos dados: ${breakdown.confidence}%`}
    >
      {breakdown.score?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
    </Badge>
  );
}

function ComparisonPanel({
  entries,
  onRemove,
}: {
  entries: Array<{ asset: MarketAsset; breakdown: ScoreBreakdown }>;
  onRemove: (ticker: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <p className="font-medium">Comparação rápida</p>
          <p className="text-xs text-muted-foreground">Até 3 ativos lado a lado</p>
        </div>
        <Badge variant="secondary">{entries.length}/3</Badge>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(({ asset, breakdown }) => (
          <div key={asset.ticker} className="rounded-lg border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{asset.ticker}</p>
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={asset.classification}
                >
                  {formatSectorLabel(asset.classification)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onRemove(asset.ticker)}
                aria-label={`Remover ${asset.ticker} da comparação`}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">
                  Score
                </span>
                <p className="numeric mt-0.5 text-sm font-semibold">
                  {breakdown.score ?? "—"}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">
                  Confiança
                </span>
                <p className="numeric mt-0.5 text-sm font-semibold">
                  {breakdown.confidence}%
                </p>
              </div>
              {getPrimaryMetrics(asset)
                .slice(0, 2)
                .map((metric) => (
                  <div key={metric.label}>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {metric.label}
                    </span>
                    <p className="numeric mt-0.5 text-sm font-semibold">
                      {metric.value}
                    </p>
                  </div>
                ))}
            </div>
            <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Check className="size-3 text-primary" aria-hidden="true" />
              Fonte e competência visíveis no detalhe
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
