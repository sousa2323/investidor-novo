import "server-only";

import { and, eq, gte, lt } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  monthlyFinancialPlan,
  plannerEntry,
  portfolio,
  portfolioTransaction,
  userProfile,
} from "@/db/schema";
import { calculatePlannerSummary } from "@/lib/calculations/planner";
import { requireCurrentUser } from "@/lib/dal/session";
import type {
  MonthlyFinancialPlan,
  PlannerEntry,
  PlannerSummary,
} from "@/types/investment";

function currentReferenceMonth(): string {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = dateParts.find((datePart) => datePart.type === "year")?.value;
  const month = dateParts.find((datePart) => datePart.type === "month")?.value;

  if (!year || !month) {
    throw new Error("Não foi possível determinar a competência atual.");
  }

  return `${year}-${month}`;
}

function nextMonth(referenceMonth: string): string {
  const [year, month] = referenceMonth.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month, 1));
  return nextDate.toISOString().slice(0, 7);
}

export async function getMonthlyFinancialPlanDto(
  requestedReferenceMonth?: string,
): Promise<{
  plan: MonthlyFinancialPlan;
  summary: PlannerSummary;
}> {
  const currentUser = await requireCurrentUser();
  const referenceMonth = /^\d{4}-\d{2}$/.test(requestedReferenceMonth ?? "")
    ? (requestedReferenceMonth as string)
    : currentReferenceMonth();
  const database = getDatabase();
  const planRecord = await database.query.monthlyFinancialPlan.findFirst({
    where: and(
      eq(monthlyFinancialPlan.userId, currentUser.id),
      eq(monthlyFinancialPlan.referenceMonth, `${referenceMonth}-01`),
    ),
  });
  const profileRecord = await database.query.userProfile.findFirst({
    where: eq(userProfile.userId, currentUser.id),
    columns: { monthlyContributionPercentage: true },
  });
  const entryRecords = planRecord
    ? await database.query.plannerEntry.findMany({
        where: eq(plannerEntry.planId, planRecord.id),
        orderBy: (entryTable, { asc }) => [
          asc(entryTable.type),
          asc(entryTable.createdAt),
        ],
      })
    : [];
  const planEntries: PlannerEntry[] = entryRecords.map((entryRecord) => ({
    id: entryRecord.id,
    type: entryRecord.type,
    category: entryRecord.category,
    description: entryRecord.description ?? undefined,
    amountCents: entryRecord.amountCents,
    dueDate: entryRecord.dueDate ?? undefined,
    recurring: entryRecord.recurring,
  }));
  const monthAfterReference = nextMonth(referenceMonth);
  const userPortfolio = await database.query.portfolio.findFirst({
    where: eq(portfolio.userId, currentUser.id),
    columns: { id: true },
  });
  const monthlyPurchases = userPortfolio
    ? await database
        .select({
          quantity: portfolioTransaction.quantity,
          unitPriceCents: portfolioTransaction.unitPriceCents,
          feesCents: portfolioTransaction.feesCents,
          taxesCents: portfolioTransaction.taxesCents,
        })
        .from(portfolioTransaction)
        .where(
          and(
            eq(portfolioTransaction.portfolioId, userPortfolio.id),
            eq(portfolioTransaction.type, "COMPRA"),
            gte(portfolioTransaction.operationDate, `${referenceMonth}-01`),
            lt(portfolioTransaction.operationDate, `${monthAfterReference}-01`),
          ),
        )
    : [];
  const actualContributionCents = monthlyPurchases.reduce(
    (totalCents, purchase) =>
      totalCents +
      Number(purchase.quantity) * purchase.unitPriceCents +
      purchase.feesCents +
      purchase.taxesCents,
    0,
  );
  const plan: MonthlyFinancialPlan = {
    id: planRecord?.id ?? "new",
    referenceMonth,
    contributionPercentage:
      planRecord?.contributionPercentage ??
      profileRecord?.monthlyContributionPercentage ??
      20,
    entries: planEntries,
    closedAt: planRecord?.closedAt?.toISOString(),
  };

  return {
    plan,
    summary: calculatePlannerSummary(plan, actualContributionCents),
  };
}
