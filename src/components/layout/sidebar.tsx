import { BrandMark } from "@/components/brand/brand-mark";
import { Separator } from "@/components/ui/separator";

import { NavigationList } from "./navigation-list";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar lg:flex lg:flex-col">
      <div className="flex h-18 items-center px-5">
        <BrandMark />
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto p-3">
        <NavigationList />
      </div>
      <div className="border-t p-4">
        <div className="rounded-xl bg-muted/70 p-3">
          <p className="text-xs font-medium">Conteúdo educacional</p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            Indicadores ajudam a estudar ativos, mas não garantem retorno.
          </p>
        </div>
      </div>
    </aside>
  );
}
