"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { deletePortfolioTransactionAction } from "@/app/actions/portfolio-actions";
import { Button } from "@/components/ui/button";

export function DeleteTransactionButton({
  transactionId,
}: {
  transactionId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label="Remover movimentação"
      onClick={() =>
        startTransition(async () => {
          const result = await deletePortfolioTransactionAction(transactionId);
          toast[result.success ? "success" : "error"](result.message);
        })
      }
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 aria-hidden="true" />
      )}
    </Button>
  );
}
