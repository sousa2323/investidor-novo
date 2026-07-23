"use client";

import { Check, LoaderCircle, Save } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  updateProfileAction,
  type ProfileActionState,
} from "@/app/actions/profile-actions";
import { PercentageField } from "@/components/forms/form-fields";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RiskProfile } from "@/types/investment";

const profileOptions: Array<{
  value: RiskProfile;
  label: string;
  description: string;
  emphasis: string;
}> = [
  {
    value: "CONSERVATIVE",
    label: "Conservador",
    description: "Prioriza previsibilidade, risco e histórico.",
    emphasis: "Risco e renda",
  },
  {
    value: "MODERATE",
    label: "Moderado",
    description: "Equilibra qualidade, crescimento e renda.",
    emphasis: "Equilíbrio",
  },
  {
    value: "AGGRESSIVE",
    label: "Arrojado",
    description: "Dá mais peso a crescimento e eficiência.",
    emphasis: "Crescimento",
  },
];

const initialState: ProfileActionState = {
  success: false,
  message: "",
};

export function ProfileForm({
  initialRiskProfile,
  initialContributionPercentage,
}: {
  initialRiskProfile: RiskProfile;
  initialContributionPercentage: number;
}) {
  const [riskProfile, setRiskProfile] =
    useState<RiskProfile>(initialRiskProfile);
  const [actionState, formAction, pending] = useActionState(
    updateProfileAction,
    initialState,
  );

  useEffect(() => {
    if (actionState.success && actionState.message) {
      toast.success(actionState.message);
    }
  }, [actionState]);

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="riskProfile" value={riskProfile} />
      <fieldset>
        <legend className="text-sm font-medium">Perfil de risco</legend>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          O perfil altera apenas os pesos e a explicação dos scores.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {profileOptions.map((profileOption) => {
            const selected = riskProfile === profileOption.value;
            return (
              <button
                key={profileOption.value}
                type="button"
                className={cn(
                  "relative rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/40",
                  selected && "border-primary ring-2 ring-primary/15",
                )}
                onClick={() => setRiskProfile(profileOption.value)}
                aria-pressed={selected}
              >
                {selected ? (
                  <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                ) : null}
                <span className="text-sm font-semibold">{profileOption.label}</span>
                <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                  {profileOption.description}
                </span>
                <span className="mt-3 inline-flex rounded-full bg-muted px-2 py-1 text-[10px] font-medium">
                  {profileOption.emphasis}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="max-w-sm">
        <PercentageField
          id="profile-contribution-percentage"
          name="monthlyContributionPercentage"
          label="Percentual mensal de aporte"
          defaultValue={initialContributionPercentage}
          hint="Ponto de partida do planejador. Pode ser alterado em cada mês."
        />
      </div>

      <FormMessage
        message={
          actionState.message && !actionState.success
            ? actionState.message
            : undefined
        }
      />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Save aria-hidden="true" />
          )}
          Salvar preferências
        </Button>
      </div>
    </form>
  );
}
