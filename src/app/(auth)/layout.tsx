import { BrandMark } from "@/components/brand/brand-mark";
import { Globe } from "@/components/ui/globe";

export default function AuthenticationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="grid min-h-dvh bg-card lg:grid-cols-[minmax(420px,0.9fr)_1.1fr]">
      <section className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <BrandMark className="mb-10" />
          {children}
        </div>
      </section>

      <aside className="relative hidden overflow-hidden border-l bg-[#f1f7f2] p-12 lg:flex lg:flex-col">
        <div
          className="absolute -top-32 -right-28 size-96 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative max-w-xl shrink-0 pt-8">
          <p className="mb-4 text-sm font-medium text-primary">
            Clareza antes de investir
          </p>
          <h2 className="text-4xl leading-[1.1] font-semibold tracking-[-0.04em]">
            Decisões melhores começam com uma vida financeira organizada.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            Entenda indicadores, acompanhe sua carteira e planeje seus aportes
            sem transformar finanças em um labirinto.
          </p>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <Globe className="w-[min(100%,calc(100dvh-22rem))] max-w-[34rem]" />
        </div>
      </aside>
    </main>
  );
}
