import { SearchX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          O endereço pode ter mudado ou o ativo ainda não está no catálogo.
        </p>
        <Button className="mt-5" asChild>
          <Link href="/painel">Voltar ao painel</Link>
        </Button>
      </div>
    </main>
  );
}
