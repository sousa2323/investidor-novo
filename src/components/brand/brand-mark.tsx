import { Sprout } from "lucide-react";

import { cn } from "@/lib/utils";

interface BrandMarkProps {
  compact?: boolean;
  className?: string;
}

export function BrandMark({ compact = false, className }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Sprout className="size-5" aria-hidden="true" />
      </span>
      {!compact ? (
        <span className="text-base font-semibold tracking-[-0.02em]">
          Investidor Novo
        </span>
      ) : null}
    </div>
  );
}
