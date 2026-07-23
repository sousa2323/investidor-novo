import { CircleCheck, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/profile/profile-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserProfileDto } from "@/lib/dal/profile";
import { requireCurrentUser } from "@/lib/dal/session";

export const metadata: Metadata = {
  title: "Perfil",
};

interface ProfilePageProps {
  searchParams: Promise<{ "primeiro-acesso"?: string }>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const currentUser = await requireCurrentUser();
  const [profile, parameters] = await Promise.all([
    getUserProfileDto(),
    searchParams,
  ]);

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Preferências"
        title="Seu perfil"
        description="Personalize os pesos das análises e o ponto de partida do seu planejamento mensal."
      />

      {parameters["primeiro-acesso"] === "1" ? (
        <Alert className="border-primary/25 bg-primary/[0.05]">
          <CircleCheck className="text-primary" />
          <AlertTitle>Conta criada, {currentUser.name.split(" ")[0]}!</AlertTitle>
          <AlertDescription>
            Escolha o perfil que melhor descreve seu momento. Você pode mudar
            isso quando quiser.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Preferências de análise</CardTitle>
          <CardDescription>
            Nenhum perfil elimina risco ou transforma score em indicação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initialRiskProfile={profile.riskProfile}
            initialContributionPercentage={
              profile.monthlyContributionPercentage
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Conta e privacidade
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Nome</p>
            <p className="mt-1 font-medium">{currentUser.name}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">E-mail</p>
            <p className="mt-1 font-medium">{currentUser.email}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
