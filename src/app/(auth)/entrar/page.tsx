import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <>
      <div className="mb-7">
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">
          Acesse sua conta
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Continue de onde parou e acompanhe sua evolução financeira.
        </p>
      </div>
      <AuthForm mode="login" />
      <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">
        Seus dados são privados e usados somente para organizar sua experiência.
      </p>
    </>
  );
}
