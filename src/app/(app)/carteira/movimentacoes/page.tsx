import { FileUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { DeleteTransactionButton } from "@/components/portfolio/delete-transaction-button";
import { TransactionForm } from "@/components/portfolio/transaction-form";
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
import { listMarketAssets } from "@/lib/dal/assets";
import { getPortfolioTransactionsDto } from "@/lib/dal/portfolio";
import { requireCurrentUser } from "@/lib/dal/session";
import { formatCurrencyFromCents, formatDate } from "@/lib/formatters";

export const metadata: Metadata = {
  title: "Movimentações",
};

interface TransactionsPageProps {
  searchParams: Promise<{ ticker?: string }>;
}

const transactionLabels = {
  COMPRA: "Compra",
  VENDA: "Venda",
  DIVIDENDO: "Dividendo",
  JCP: "JCP",
  RENDIMENTO_FII: "Rendimento FII",
  AMORTIZACAO: "Amortização",
} as const;

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  await requireCurrentUser();
  const [{ ticker }, transactions, stockListing, fiiListing] = await Promise.all([
    searchParams,
    getPortfolioTransactionsDto(),
    listMarketAssets("STOCK"),
    listMarketAssets("FII"),
  ]);
  const selectableAssets = [...stockListing.assets, ...fiiListing.assets];

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Carteira"
        title="Movimentações"
        description="Compras, vendas, proventos e amortizações são recalculados em ordem cronológica."
        actions={
          <Button variant="outline" asChild>
            <Link href="/carteira/importar">
              <FileUp aria-hidden="true" />
              Importar CSV
            </Link>
          </Button>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nova movimentação</CardTitle>
            <CardDescription>
              Valores monetários usam o formato brasileiro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionForm
              assets={selectableAssets}
              initialTicker={ticker?.toUpperCase()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>
              {transactions.length} movimentações registradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                Nenhuma movimentação registrada.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...transactions].reverse().map((transaction) => {
                      const displayValueCents =
                        transaction.type === "COMPRA" ||
                        transaction.type === "VENDA"
                          ? transaction.quantity * transaction.unitPriceCents
                          : transaction.valueCents;
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell className="numeric text-xs">
                            {formatDate(`${transaction.operationDate}T12:00:00`)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {transactionLabels[transaction.type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {transaction.ticker}
                          </TableCell>
                          <TableCell className="numeric text-right">
                            {transaction.quantity
                              ? transaction.quantity.toLocaleString("pt-BR", {
                                  maximumFractionDigits: 8,
                                })
                              : "—"}
                          </TableCell>
                          <TableCell className="numeric text-right">
                            {formatCurrencyFromCents(displayValueCents)}
                          </TableCell>
                          <TableCell>
                            <DeleteTransactionButton
                              transactionId={transaction.id}
                            />
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
    </div>
  );
}
