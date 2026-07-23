import type {
  MonthlyFinancialPlan,
  PlannerEntryType,
  PlannerSummary,
} from "@/types/investment";

function sumEntries(
  financialPlan: MonthlyFinancialPlan,
  entryType: PlannerEntryType,
): number {
  return financialPlan.entries
    .filter((entry) => entry.type === entryType)
    .reduce((totalCents, entry) => totalCents + entry.amountCents, 0);
}

export function calculatePlannerSummary(
  financialPlan: MonthlyFinancialPlan,
  actualContributionCents = 0,
): PlannerSummary {
  const boundedContributionPercentage = Math.min(
    100,
    Math.max(0, financialPlan.contributionPercentage),
  );
  const incomeCents = sumEntries(financialPlan, "RECEITA");
  const monthlyExpenseCents = sumEntries(financialPlan, "DESPESA_MENSAL");
  const annualExpenseCents = sumEntries(financialPlan, "DESPESA_ANUAL");
  const annualProvisionCents = Math.round(annualExpenseCents / 12);
  const availableMonthlyBalanceCents =
    incomeCents - monthlyExpenseCents - annualProvisionCents;
  const percentageContributionCents = Math.round(
    incomeCents * (boundedContributionPercentage / 100),
  );
  const suggestedContributionCents = Math.max(
    0,
    Math.min(percentageContributionCents, availableMonthlyBalanceCents),
  );

  return {
    incomeCents,
    monthlyExpenseCents,
    annualExpenseCents,
    annualProvisionCents,
    availableMonthlyBalanceCents,
    suggestedContributionCents,
    plannedInvestmentCents: sumEntries(financialPlan, "INVESTIMENTO_PLANEJADO"),
    actualContributionCents: Math.max(0, actualContributionCents),
  };
}
