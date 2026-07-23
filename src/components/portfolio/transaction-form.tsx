"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  DateField,
  MoneyField,
  QuantityField,
  SelectField,
  TextField,
} from "@/components/forms/form-fields";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MarketAsset, PortfolioTransactionType } from "@/types/investment";
import {
  createPortfolioTransactionAction,
  type TransactionActionState,
} from "@/app/actions/portfolio-actions";

const initialActionState: TransactionActionState = {
  success: false,
  message: "",
};

const transactionTypeOptions: Array<{
  value: PortfolioTransactionType;
  label: string;
}> = [
  { value: "COMPRA", label: "Compra" },
  { value: "VENDA", label: "Venda" },
  { value: "DIVIDENDO", label: "Dividendo" },
  { value: "JCP", label: "Juros sobre capital próprio" },
  { value: "RENDIMENTO_FII", label: "Rendimento de FII" },
  { value: "AMORTIZACAO", label: "Amortização" },
];

interface TransactionFormProps {
  assets: MarketAsset[];
  initialTicker?: string;
}

export function TransactionForm({
  assets,
  initialTicker,
}: TransactionFormProps) {
  const [actionState, formAction, pending] = useActionState(
    createPortfolioTransactionAction,
    initialActionState,
  );
  const [transactionType, setTransactionType] =
    useState<PortfolioTransactionType>("COMPRA");
  const [ticker, setTicker] = useState(
    assets.some((asset) => asset.ticker === initialTicker)
      ? initialTicker
      : undefined,
  );
  const isTrade = transactionType === "COMPRA" || transactionType === "VENDA";

  useEffect(() => {
    if (!actionState.message) {
      return;
    }
    if (actionState.success) {
      toast.success(actionState.message);
    }
  }, [actionState]);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="type" value={transactionType} />
      <input type="hidden" name="ticker" value={ticker ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="transaction-type"
          label="Tipo"
          value={transactionType}
          options={transactionTypeOptions}
          onValueChange={(value) =>
            setTransactionType(value as PortfolioTransactionType)
          }
          required
        />
        <SelectField
          id="transaction-ticker"
          label="Ativo"
          value={ticker}
          placeholder="Selecione o ticker"
          options={assets.map((asset) => ({
            value: asset.ticker,
            label: `${asset.ticker} · ${asset.name}`,
          }))}
          onValueChange={setTicker}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DateField
          id="operationDate"
          name="operationDate"
          label="Data da operação"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
        {isTrade ? (
          <QuantityField
            id="quantity"
            name="quantity"
            label="Quantidade"
            placeholder="0"
            required
          />
        ) : (
          <MoneyField
            id="value"
            name="value"
            label="Valor recebido"
            placeholder="R$ 0,00"
            required
          />
        )}
      </div>

      {isTrade ? (
        <MoneyField
          id="unitPrice"
          name="unitPrice"
          label="Preço unitário"
          placeholder="R$ 0,00"
          required
        />
      ) : (
        <>
          <input type="hidden" name="quantity" value="0" />
          <input type="hidden" name="unitPrice" value="0" />
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          id="fees"
          name="fees"
          label="Taxas"
          defaultValue={0}
        />
        <MoneyField
          id="taxes"
          name="taxes"
          label="Impostos informados"
          defaultValue={0}
        />
      </div>

      <TextField
        id="broker"
        name="broker"
        label="Corretora"
        placeholder="Opcional"
        maxLength={80}
      />

      <div className="grid gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          Observação
        </label>
        <Textarea
          id="notes"
          name="notes"
          className="min-h-20 bg-card"
          placeholder="Informação opcional sobre a movimentação"
          maxLength={300}
        />
      </div>

      {!isTrade ? null : <input type="hidden" name="value" value="0" />}
      <FormMessage
        message={
          actionState.message && !actionState.success
            ? actionState.message
            : undefined
        }
      />
      <Button type="submit" className="h-10" disabled={pending || !ticker}>
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Plus aria-hidden="true" />
        )}
        Registrar movimentação
      </Button>
    </form>
  );
}
