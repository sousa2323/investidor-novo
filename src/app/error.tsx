"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ApplicationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <CircleAlert className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Não foi possível carregar esta área
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Seus dados não foram alterados. Tente novamente; se o problema
          continuar, confira a conexão com o banco.
        </p>
        <Button className="mt-5" onClick={reset}>
          <RotateCcw />
          Tentar novamente
        </Button>
      </div>
    </main>
  );
}
