"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDatabase } from "@/db";
import {
  monthlyFinancialPlan,
  plannerEntry,
} from "@/db/schema";
import { requireCurrentUser } from "@/lib/dal/session";
import { parseBrazilianCurrencyToCents } from "@/lib/parsers";

const plannerEntrySchema = z.object({
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  type: z.enum([
    "RECEITA",
    "DESPESA_MENSAL",
    "DESPESA_ANUAL",
    "INVESTIMENTO_PLANEJADO",
  ]),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional(),
  amountCents: z.number().int().positive(),
  dueDate: z.union([z.iso.date(), z.literal("")]).optional(),
  recurring: z.boolean(),
});

const planPreferenceSchema = z.object({
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  contributionPercentage: z.coerce.number().int().min(0).max(100),
});

export interface PlannerActionState {
  success: boolean;
  message: string;
}

async function getOrCreateMonthlyPlan(
  userId: string,
  referenceMonth: string,
): Promise<string> {
  const database = getDatabase();
  await database
    .insert(monthlyFinancialPlan)
    .values({
      userId,
      referenceMonth: `${referenceMonth}-01`,
    })
    .onConflictDoNothing();
  const planRecord = await database.query.monthlyFinancialPlan.findFirst({
    where: and(
      eq(monthlyFinancialPlan.userId, userId),
      eq(monthlyFinancialPlan.referenceMonth, `${referenceMonth}-01`),
    ),
    columns: { id: true },
  });

  if (!planRecord) {
    throw new Error("Não foi possível abrir o planejamento do mês.");
  }

  return planRecord.id;
}

export async function createPlannerEntryAction(
  _previousState: PlannerActionState,
  formData: FormData,
): Promise<PlannerActionState> {
  const currentUser = await requireCurrentUser();
  const parsedEntry = plannerEntrySchema.safeParse({
    referenceMonth: formData.get("referenceMonth"),
    type: formData.get("type"),
    category: formData.get("category"),
    description: String(formData.get("description") ?? ""),
    amountCents: parseBrazilianCurrencyToCents(
      String(formData.get("amount") ?? ""),
    ),
    dueDate: String(formData.get("dueDate") ?? ""),
    recurring: formData.get("recurring") === "on",
  });

  if (!parsedEntry.success) {
    return {
      success: false,
      message: "Revise a categoria, o valor e a data do lançamento.",
    };
  }

  const planId = await getOrCreateMonthlyPlan(
    currentUser.id,
    parsedEntry.data.referenceMonth,
  );
  await getDatabase().insert(plannerEntry).values({
    planId,
    type: parsedEntry.data.type,
    category: parsedEntry.data.category,
    description: parsedEntry.data.description || undefined,
    amountCents: parsedEntry.data.amountCents,
    dueDate: parsedEntry.data.dueDate || undefined,
    recurring: parsedEntry.data.recurring,
  });

  revalidatePath("/planejador");
  revalidatePath("/painel");

  return { success: true, message: "Lançamento adicionado." };
}

export async function updatePlanPreferenceAction(
  _previousState: PlannerActionState,
  formData: FormData,
): Promise<PlannerActionState> {
  const currentUser = await requireCurrentUser();
  const parsedPreference = planPreferenceSchema.safeParse({
    referenceMonth: formData.get("referenceMonth"),
    contributionPercentage: formData.get("contributionPercentage"),
  });

  if (!parsedPreference.success) {
    return {
      success: false,
      message: "O percentual deve estar entre 0% e 100%.",
    };
  }

  const planId = await getOrCreateMonthlyPlan(
    currentUser.id,
    parsedPreference.data.referenceMonth,
  );
  await getDatabase()
    .update(monthlyFinancialPlan)
    .set({
      contributionPercentage: parsedPreference.data.contributionPercentage,
      updatedAt: new Date(),
    })
    .where(eq(monthlyFinancialPlan.id, planId));

  revalidatePath("/planejador");
  revalidatePath("/painel");
  return { success: true, message: "Meta mensal atualizada." };
}

export async function deletePlannerEntryAction(
  entryId: string,
): Promise<{ success: boolean; message: string }> {
  const currentUser = await requireCurrentUser();
  const ownedEntry = await getDatabase()
    .select({ id: plannerEntry.id })
    .from(plannerEntry)
    .innerJoin(
      monthlyFinancialPlan,
      eq(plannerEntry.planId, monthlyFinancialPlan.id),
    )
    .where(
      and(
        eq(plannerEntry.id, entryId),
        eq(monthlyFinancialPlan.userId, currentUser.id),
      ),
    )
    .limit(1);

  if (!ownedEntry[0]) {
    return { success: false, message: "Lançamento não encontrado." };
  }

  await getDatabase().delete(plannerEntry).where(eq(plannerEntry.id, entryId));
  revalidatePath("/planejador");
  revalidatePath("/painel");
  return { success: true, message: "Lançamento removido." };
}

export async function copyRecurringEntriesAction(
  referenceMonth: string,
): Promise<{ success: boolean; message: string }> {
  const currentUser = await requireCurrentUser();
  const parsedReferenceMonth = z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .safeParse(referenceMonth);

  if (!parsedReferenceMonth.success) {
    return { success: false, message: "Mês inválido." };
  }

  const [year, month] = parsedReferenceMonth.data.split("-").map(Number);
  const nextReferenceMonth = new Date(Date.UTC(year, month, 1))
    .toISOString()
    .slice(0, 7);
  const sourcePlan = await getDatabase().query.monthlyFinancialPlan.findFirst({
    where: and(
      eq(monthlyFinancialPlan.userId, currentUser.id),
      eq(
        monthlyFinancialPlan.referenceMonth,
        `${parsedReferenceMonth.data}-01`,
      ),
    ),
    columns: { id: true, contributionPercentage: true },
  });

  if (!sourcePlan) {
    return { success: false, message: "Nenhum plano encontrado neste mês." };
  }

  const recurringEntries = await getDatabase().query.plannerEntry.findMany({
    where: and(
      eq(plannerEntry.planId, sourcePlan.id),
      eq(plannerEntry.recurring, true),
    ),
  });
  const targetPlanId = await getOrCreateMonthlyPlan(
    currentUser.id,
    nextReferenceMonth,
  );

  if (recurringEntries.length > 0) {
    await getDatabase().insert(plannerEntry).values(
      recurringEntries.map((entryRecord) => ({
        planId: targetPlanId,
        type: entryRecord.type,
        category: entryRecord.category,
        description: entryRecord.description,
        amountCents: entryRecord.amountCents,
        recurring: true,
      })),
    );
  }
  await getDatabase()
    .update(monthlyFinancialPlan)
    .set({
      contributionPercentage: sourcePlan.contributionPercentage,
      updatedAt: new Date(),
    })
    .where(eq(monthlyFinancialPlan.id, targetPlanId));

  revalidatePath("/planejador");
  return {
    success: true,
    message: `${recurringEntries.length} lançamentos copiados para ${nextReferenceMonth}.`,
  };
}

export async function closeMonthlyPlanAction(
  referenceMonth: string,
): Promise<{ success: boolean; message: string }> {
  const currentUser = await requireCurrentUser();
  const parsedReferenceMonth = z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .safeParse(referenceMonth);

  if (!parsedReferenceMonth.success) {
    return { success: false, message: "Mês inválido." };
  }

  const planId = await getOrCreateMonthlyPlan(
    currentUser.id,
    parsedReferenceMonth.data,
  );
  await getDatabase()
    .update(monthlyFinancialPlan)
    .set({ closedAt: new Date(), updatedAt: new Date() })
    .where(eq(monthlyFinancialPlan.id, planId));
  revalidatePath("/planejador");

  return { success: true, message: "Mês fechado com sucesso." };
}
