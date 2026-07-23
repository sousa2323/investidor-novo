"use client";

import { CheckCircle2, Copy, LoaderCircle, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  closeMonthlyPlanAction,
  copyRecurringEntriesAction,
  deletePlannerEntryAction,
} from "@/app/actions/planner-actions";
import { Button } from "@/components/ui/button";

export function DeletePlannerEntryButton({ entryId }: { entryId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label="Remover lançamento"
      onClick={() =>
        startTransition(async () => {
          const result = await deletePlannerEntryAction(entryId);
          toast[result.success ? "success" : "error"](result.message);
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}

export function CopyRecurringButton({
  referenceMonth,
}: {
  referenceMonth: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await copyRecurringEntriesAction(referenceMonth);
          toast[result.success ? "success" : "error"](result.message);
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <Copy />}
      Copiar recorrentes
    </Button>
  );
}

export function ClosePlanButton({
  referenceMonth,
  closed,
}: {
  referenceMonth: string;
  closed: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending || closed}
      onClick={() =>
        startTransition(async () => {
          const result = await closeMonthlyPlanAction(referenceMonth);
          toast[result.success ? "success" : "error"](result.message);
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
      {closed ? "Mês fechado" : "Fechar mês"}
    </Button>
  );
}
