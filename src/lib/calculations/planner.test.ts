import { describe, expect, it } from "vitest";

import { calculatePlannerSummary } from "@/lib/calculations/planner";
import type { MonthlyFinancialPlan, PlannerEntry } from "@/types/investment";

function createPlan(
  entries: PlannerEntry[],
  contributionPercentage: number,
): MonthlyFinancialPlan {
  return {
    id: "plan",
    referenceMonth: "2026-07",
    contributionPercentage,
    entries,
  };
}

describe("planejador mensal", () => {
  const entries: PlannerEntry[] = [
    {
      id: "income",
      type: "RECEITA",
      category: "Salário",
      amountCents: 500_000,
      recurring: true,
    },
    {
      id: "monthly",
      type: "DESPESA_MENSAL",
      category: "Moradia",
      amountCents: 200_000,
      recurring: true,
    },
    {
      id: "annual",
      type: "DESPESA_ANUAL",
      category: "IPVA",
      amountCents: 120_000,
      recurring: false,
    },
  ];

  it("divide despesas anuais por 12", () => {
    const summary = calculatePlannerSummary(createPlan(entries, 20));
    expect(summary.annualProvisionCents).toBe(10_000);
    expect(summary.availableMonthlyBalanceCents).toBe(290_000);
  });

  it("nunca sugere meta negativa quando o saldo está abaixo de zero", () => {
    const negativeEntries: PlannerEntry[] = [
      ...entries,
      {
        id: "extra",
        type: "DESPESA_MENSAL",
        category: "Emergência",
        amountCents: 400_000,
        recurring: false,
      },
    ];
    const summary = calculatePlannerSummary(createPlan(negativeEntries, 20));
    expect(summary.availableMonthlyBalanceCents).toBeLessThan(0);
    expect(summary.suggestedContributionCents).toBe(0);
  });

  it("aceita percentual zero", () => {
    expect(
      calculatePlannerSummary(createPlan(entries, 0)).suggestedContributionCents,
    ).toBe(0);
  });

  it("limita percentual de 100% ao saldo disponível", () => {
    const summary = calculatePlannerSummary(createPlan(entries, 100));
    expect(summary.suggestedContributionCents).toBe(
      summary.availableMonthlyBalanceCents,
    );
  });
});
