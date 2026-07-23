import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default function RegistrationPage() {
  return (
    <>
      <div className="mb-7">
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">
          Comece com tranquilidade
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Crie sua conta e escolha um perfil para personalizar as análises.
        </p>
      </div>
      <AuthForm mode="registration" />
      <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">
        Ao criar a conta, você reconhece que o conteúdo é educacional e não
        constitui recomendação de investimento.
      </p>
    </>
  );
}
