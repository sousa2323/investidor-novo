"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  EmailField,
  PasswordField,
  TextField,
} from "@/components/forms/form-fields";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { authenticationClient } from "@/lib/auth-client";

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});

const registrationSchema = loginSchema
  .extend({
    name: z
      .string()
      .trim()
      .min(2, "Informe seu nome com pelo menos 2 caracteres.")
      .max(80, "O nome deve ter no máximo 80 caracteres."),
    passwordConfirmation: z.string(),
  })
  .refine(
    (formValues) => formValues.password === formValues.passwordConfirmation,
    {
      path: ["passwordConfirmation"],
      message: "As senhas não coincidem.",
    },
  );

type LoginValues = z.infer<typeof loginSchema>;
type RegistrationValues = z.infer<typeof registrationSchema>;

interface AuthFormProps {
  mode: "login" | "registration";
}

export function AuthForm({ mode }: AuthFormProps) {
  return mode === "registration" ? <RegistrationForm /> : <LoginForm />;
}

function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function submitLogin(formValues: LoginValues) {
    setFormError(undefined);
    const loginResult = await authenticationClient.signIn.email({
      email: formValues.email,
      password: formValues.password,
      rememberMe: true,
    });

    if (loginResult.error) {
      setFormError("E-mail ou senha incorretos.");
      return;
    }

    toast.success("Bem-vindo de volta.");
    router.push("/painel");
    router.refresh();
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit(submitLogin)}
      noValidate
    >
      <EmailField
        label="E-mail"
        placeholder="voce@exemplo.com"
        error={form.formState.errors.email?.message}
        required
        {...form.register("email")}
      />

      <PasswordField
        label="Senha"
        placeholder="Mínimo de 8 caracteres"
        autoComplete="current-password"
        error={form.formState.errors.password?.message}
        required
        {...form.register("password")}
      />

      <FormMessage message={formError} />

      <Button
        type="submit"
        size="lg"
        className="mt-1 h-11 w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight aria-hidden="true" />
        )}
        Entrar
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem uma conta?{" "}
        <Link
          href="/cadastro"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}

function RegistrationForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const form = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      passwordConfirmation: "",
    },
  });

  async function submitRegistration(formValues: RegistrationValues) {
    setFormError(undefined);
    const registrationResult = await authenticationClient.signUp.email({
      name: formValues.name,
      email: formValues.email,
      password: formValues.password,
    });

    if (registrationResult.error) {
      setFormError(
        registrationResult.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
          ? "Já existe uma conta com este e-mail."
          : "Não foi possível criar sua conta. Revise os dados e tente novamente.",
      );
      return;
    }

    toast.success("Conta criada com sucesso.");
    router.push("/perfil?primeiro-acesso=1");
    router.refresh();
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit(submitRegistration)}
      noValidate
    >
      <TextField
        label="Nome"
        placeholder="Como você quer ser chamado?"
        autoComplete="name"
        error={form.formState.errors.name?.message}
        required
        {...form.register("name")}
      />
      <EmailField
        label="E-mail"
        placeholder="voce@exemplo.com"
        error={form.formState.errors.email?.message}
        required
        {...form.register("email")}
      />
      <PasswordField
        label="Senha"
        placeholder="Mínimo de 8 caracteres"
        autoComplete="new-password"
        error={form.formState.errors.password?.message}
        hint="Use pelo menos 8 caracteres. Evite senhas reutilizadas."
        required
        {...form.register("password")}
      />
      <PasswordField
        label="Confirme sua senha"
        placeholder="Digite a senha novamente"
        autoComplete="new-password"
        error={form.formState.errors.passwordConfirmation?.message}
        required
        {...form.register("passwordConfirmation")}
      />
      <FormMessage message={formError} />
      <Button
        type="submit"
        size="lg"
        className="mt-1 h-11 w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight aria-hidden="true" />
        )}
        Criar minha conta
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{" "}
        <Link
          href="/entrar"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
