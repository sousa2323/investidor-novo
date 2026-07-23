import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Plus,
  WalletCards,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  AllocationChart,
  PortfolioEvolutionChart,
} from "@/components/portfolio/portfolio-charts";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentPricesByTicker } from "@/lib/dal/assets";
import {
  getPortfolioSnapshotsDto,
  getPortfolioSummaryDto,
} from "@/lib/dal/portfolio";
import { requireCurrentUser } from "@/lib/dal/session";
import { formatCurrencyFromCents } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Carteira",
};

export default async function PortfolioPage() {
  await requireCurrentUser();
  const currentPricesCents = await getCurrentPricesByTicker();
  const [portfolioSummary, portfolioSnapshots] = await Promise.all([
    getPortfolioSummaryDto(currentPricesCents),
    getPortfolioSnapshotsDto(),
  ]);

  const summaryCards = [
    {
      label: "Patrimônio",
      value: portfolioSummary.totalMarketValueCents,
      helper: "Valor de mercado",
    },
    {
      label: "Custo atual",
      value: portfolioSummary.totalCostBasisCents,
      helper: "Inclui taxas de compra",
    },
    {
      label: "Resultado total",
      value: portfolioSummary.totalResultCents,
      helper: "Realizado, em aberto e proventos",
    },
    {
      label: "Proventos",
      value: portfolioSummary.incomeCents,
      helper: "Dividendos, JCP e rendimentos",
    },
  ];

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Sua posição"
        title="Carteira"
        description="Acompanhe preço médio, patrimônio, resultados e proventos da sua carteira principal."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/carteira/importar">
                <Download aria-hidden="true" />
                Importar CSV
              </Link>
            </Button>
            <Button asChild>
              <Link href="/carteira/movimentacoes">
                <Plus aria-hidden="true" />
                Nova movimentação
              </Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((summaryCard) => (
          <Card key={summaryCard.label} size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">{summaryCard.label}</p>
              <p
                className={cn(
                  "numeric mt-2 text-xl font-semibold",
                  summaryCard.label === "Resultado total" &&
                    summaryCard.value > 0 &&
                    "text-primary",
                  summaryCard.label === "Resultado total" &&
                    summaryCard.value < 0 &&
                    "text-destructive",
                )}
              >
                {formatCurrencyFromCents(summaryCard.value)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {summaryCard.helper}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Evolução patrimonial</CardTitle>
            <CardDescription>
              {portfolioSnapshots.length > 0
                ? "Fechamentos diários registrados pela rotina de mercado"
                : "Snapshots diários aparecerão após a primeira rotina de fechamento"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PortfolioEvolutionChart snapshots={portfolioSnapshots} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alocação por ativo</CardTitle>
            <CardDescription>Distribuição pelo valor de mercado</CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationChart
              positions={portfolioSummary.positions}
              currentPricesCents={currentPricesCents}
            />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Posições</CardTitle>
            <CardDescription>
              Venda parcial não altera o preço médio restante
            </CardDescription>
          </div>
          <Badge variant="secondary">
            {portfolioSummary.positions.filter((position) => position.quantity > 0).length} ativos
          </Badge>
        </CardHeader>
        <CardContent>
          {portfolioSummary.positions.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center">
              <WalletCards className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Sua carteira está vazia</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Registre uma compra ou importe seu CSV para começar.
              </p>
              <Button className="mt-4" size="sm" asChild>
                <Link href="/carteira/movimentacoes">Registrar compra</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Preço médio</TableHead>
                    <TableHead className="text-right">Posição</TableHead>
                    <TableHead className="text-right">Resultado em aberto</TableHead>
                    <TableHead className="text-right">Proventos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolioSummary.positions.map((position) => {
                    const marketValueCents =
                      position.quantity *
                      (currentPricesCents[position.ticker] ??
                        position.averagePriceCents);
                    const openResultCents =
                      marketValueCents - position.costBasisCents;
                    const ResultIcon =
                      openResultCents >= 0 ? ArrowUpRight : ArrowDownRight;
                    return (
                      <TableRow key={position.ticker}>
                        <TableCell>
                          <span className="font-semibold">{position.ticker}</span>
                          <Badge variant="outline" className="ml-2">
                            {position.assetType === "STOCK" ? "Ação" : "FII"}
                          </Badge>
                        </TableCell>
                        <TableCell className="numeric text-right">
                          {position.quantity.toLocaleString("pt-BR", {
                            maximumFractionDigits: 8,
                          })}
                        </TableCell>
                        <TableCell className="numeric text-right">
                          {formatCurrencyFromCents(position.averagePriceCents)}
                        </TableCell>
                        <TableCell className="numeric text-right">
                          {formatCurrencyFromCents(marketValueCents)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "numeric text-right",
                            openResultCents >= 0
                              ? "text-primary"
                              : "text-destructive",
                          )}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            <ResultIcon className="size-3.5" aria-hidden="true" />
                            {formatCurrencyFromCents(openResultCents)}
                          </span>
                        </TableCell>
                        <TableCell className="numeric text-right">
                          {formatCurrencyFromCents(position.incomeCents)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
