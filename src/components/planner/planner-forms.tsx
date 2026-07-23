"use client";

import { LoaderCircle, Plus, Save } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  DateField,
  MoneyField,
  PercentageField,
  SelectField,
  TextField,
} from "@/components/forms/form-fields";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { PlannerEntryType } from "@/types/investment";
import {
  createPlannerEntryAction,
  updatePlanPreferenceAction,
  type PlannerActionState,
} from "@/app/actions/planner-actions";

const initialActionState: PlannerActionState = {
  success: false,
  message: "",
};

const entryTypeOptions = [
  { value: "RECEITA", label: "Receita" },
  { value: "DESPESA_MENSAL", label: "Despesa mensal" },
  { value: "DESPESA_ANUAL", label: "Despesa anual" },
  { value: "INVESTIMENTO_PLANEJADO", label: "Investimento planejado" },
];

export function PlannerEntryForm({
  referenceMonth,
  categoryExamples,
}: {
  referenceMonth: string;
  categoryExamples: string[];
}) {
  const [actionState, formAction, pending] = useActionState(
    createPlannerEntryAction,
    initialActionState,
  );
  const [entryType, setEntryType] = useState<PlannerEntryType>("DESPESA_MENSAL");
  const [recurring, setRecurring] = useState(false);

  useEffect(() => {
    if (actionState.success && actionState.message) {
      toast.success(actionState.message);
    }
  }, [actionState]);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="referenceMonth" value={referenceMonth} />
      <input type="hidden" name="type" value={entryType} />
      <input type="hidden" name="recurring" value={recurring ? "on" : ""} />

      <SelectField
        id="planner-entry-type"
        label="Tipo de lançamento"
        value={entryType}
        options={entryTypeOptions}
        onValueChange={(value) => setEntryType(value as PlannerEntryType)}
        required
      />
      <TextField
        id="planner-category"
        name="category"
        label="Categoria"
        placeholder="Ex.: Moradia"
        list="planner-category-examples"
        required
      />
      <datalist id="planner-category-examples">
        {categoryExamples.map((categoryExample) => (
          <option key={categoryExample} value={categoryExample} />
        ))}
      </datalist>
      <MoneyField
        id="planner-amount"
        name="amount"
        label="Valor"
        placeholder="R$ 0,00"
        required
      />
      <DateField
        id="planner-due-date"
        name="dueDate"
        label="Vencimento"
        hint="Opcional"
      />
      <TextField
        id="planner-description"
        name="description"
        label="Descrição"
        placeholder="Opcional"
        maxLength={200}
      />
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/25 p-3">
        <Checkbox
          checked={recurring}
          onCheckedChange={(checked) => setRecurring(checked === true)}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium">Lançamento recorrente</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Poderá ser copiado para o mês seguinte.
          </span>
        </span>
      </label>
      <FormMessage
        message={
          actionState.message && !actionState.success
            ? actionState.message
            : undefined
        }
      />
      <Button type="submit" disabled={pending}>
        {pending ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <Plus aria-hidden="true" />
        )}
        Adicionar lançamento
      </Button>
    </form>
  );
}

export function PlanPreferenceForm({
  referenceMonth,
  contributionPercentage,
}: {
  referenceMonth: string;
  contributionPercentage: number;
}) {
  const [actionState, formAction, pending] = useActionState(
    updatePlanPreferenceAction,
    initialActionState,
  );

  useEffect(() => {
    if (actionState.success && actionState.message) {
      toast.success(actionState.message);
    }
  }, [actionState]);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="referenceMonth" value={referenceMonth} />
      <PercentageField
        id="contribution-percentage"
        name="contributionPercentage"
        label="Percentual desejado"
        defaultValue={contributionPercentage}
        className="w-full"
      />
      <Button type="submit" variant="outline" className="mb-0 h-10" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
        Salvar
      </Button>
    </form>
  );
}
