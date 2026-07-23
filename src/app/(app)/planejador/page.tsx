import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  PiggyBank,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import {
  ClosePlanButton,
  CopyRecurringButton,
  DeletePlannerEntryButton,
} from "@/components/planner/planner-action-buttons";
import {
  PlanPreferenceForm,
  PlannerEntryForm,
} from "@/components/planner/planner-forms";
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
import { plannerCategoryExamples } from "@/data/reference-assets";
import { getMonthlyFinancialPlanDto } from "@/lib/dal/planner";
import { requireCurrentUser } from "@/lib/dal/session";
import { formatCurrencyFromCents } from "@/lib/formatters";
import type { PlannerEntryType } from "@/types/investment";

export const metadata: Metadata = {
  title: "Planejador financeiro",
};

interface PlannerPageProps {
  searchParams: Promise<{ mes?: string }>;
}

const entryTypeLabels: Record<PlannerEntryType, string> = {
  RECEITA: "Receita",
  DESPESA_MENSAL: "Despesa mensal",
  DESPESA_ANUAL: "Despesa anual",
  INVESTIMENTO_PLANEJADO: "Investimento planejado",
};

function adjacentMonth(referenceMonth: string, increment: number): string {
  const [year, month] = referenceMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + increment, 1))
    .toISOString()
    .slice(0, 7);
}

export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  await requireCurrentUser();
  const { mes } = await searchParams;
  const { plan, summary } = await getMonthlyFinancialPlanDto(mes);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${plan.referenceMonth}-01T12:00:00Z`));
  const contributionProgress =
    summary.suggestedContributionCents === 0
      ? 0
      : Math.min(
          100,
          (summary.actualContributionCents /
            summary.suggestedContributionCents) *
            100,
        );
  const allCategoryExamples = [
    ...plannerCategoryExamples.income,
    ...plannerCategoryExamples.monthlyExpenses,
    ...plannerCategoryExamples.annualExpenses,
    ...plannerCategoryExamples.plannedInvestments,
  ];

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Organização mensal"
        title="Planejador financeiro"
        description="Categorias são livres. As sugestões vêm da estrutura da planilha, nunca dos valores pessoais nela preenchidos."
        actions={
          <div className="flex gap-2">
            <CopyRecurringButton referenceMonth={plan.referenceMonth} />
            <ClosePlanButton
              referenceMonth={plan.referenceMonth}
              closed={Boolean(plan.closedAt)}
            />
          </div>
        }
      />

      <Card size="sm">
        <CardContent className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/planejador?mes=${adjacentMonth(plan.referenceMonth, -1)}`}>
              <ArrowLeft />
              Anterior
            </Link>
          </Button>
          <div className="text-center">
            <p className="flex items-center gap-2 text-sm font-semibold capitalize">
              <CalendarDays className="size-4 text-primary" />
              {monthLabel}
            </p>
            {plan.closedAt ? (
              <Badge variant="secondary" className="mt-1">
                Fechado
              </Badge>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/planejador?mes=${adjacentMonth(plan.referenceMonth, 1)}`}>
              Próximo
              <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PlannerSummaryCard
          label="Receitas"
          valueCents={summary.incomeCents}
          icon={CircleDollarSign}
        />
        <PlannerSummaryCard
          label="Despesas + provisão"
          valueCents={
            summary.monthlyExpenseCents + summary.annualProvisionCents
          }
          helper={`${formatCurrencyFromCents(summary.annualProvisionCents)} reservados para anuais`}
          icon={ReceiptText}
        />
        <PlannerSummaryCard
          label="Saldo disponível"
          valueCents={summary.availableMonthlyBalanceCents}
          icon={PiggyBank}
        />
        <PlannerSummaryCard
          label="Meta sugerida"
          valueCents={summary.suggestedContributionCents}
          helper={`${plan.contributionPercentage}% das receitas, limitado ao saldo`}
          icon={TrendingUp}
        />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[420px_1fr]">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Novo lançamento</CardTitle>
              <CardDescription>
                Use categorias próprias ou escolha um exemplo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlannerEntryForm
                referenceMonth={plan.referenceMonth}
                categoryExamples={allCategoryExamples}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Meta de aporte</CardTitle>
              <CardDescription>
                Percentual editável de 0% a 100%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlanPreferenceForm
                referenceMonth={plan.referenceMonth}
                contributionPercentage={plan.contributionPercentage}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Acompanhamento do aporte</CardTitle>
              <CardDescription>
                Compras reais da carteira no mês comparadas com sua meta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Meta sugerida</p>
                  <p className="numeric mt-1 text-lg font-semibold">
                    {formatCurrencyFromCents(summary.suggestedContributionCents)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Compras reais</p>
                  <p className="numeric mt-1 text-lg font-semibold text-primary">
                    {formatCurrencyFromCents(summary.actualContributionCents)}
                  </p>
                </div>
              </div>
              <Progress value={contributionProgress} className="mt-4" />
              <div className="mt-4 flex justify-between text-xs text-muted-foreground">
                <span>
                  Planejado:{" "}
                  {formatCurrencyFromCents(summary.plannedInvestmentCents)}
                </span>
                <span className="numeric">
                  {contributionProgress.toLocaleString("pt-BR", {
                    maximumFractionDigits: 0,
                  })}
                  %
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lançamentos do mês</CardTitle>
              <CardDescription>
                A provisão mensal das despesas anuais é a soma dividida por 12
              </CardDescription>
            </CardHeader>
            <CardContent>
              {plan.entries.length === 0 ? (
                <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                  Nenhum lançamento neste mês.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">Ações</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Badge variant="secondary">
                              {entryTypeLabels[entry.type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{entry.category}</span>
                            {entry.recurring ? (
                              <span className="ml-2 text-[10px] text-muted-foreground">
                                recorrente
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="numeric text-right">
                            {formatCurrencyFromCents(entry.amountCents)}
                          </TableCell>
                          <TableCell>
                            <DeletePlannerEntryButton entryId={entry.id} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function PlannerSummaryCard({
  label,
  valueCents,
  helper,
  icon: Icon,
}: {
  label: string;
  valueCents: number;
  helper?: string;
  icon: typeof CircleDollarSign;
}) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="numeric mt-2 text-xl font-semibold">
              {formatCurrencyFromCents(valueCents)}
            </p>
          </div>
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        </div>
        {helper ? (
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
            {helper}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
