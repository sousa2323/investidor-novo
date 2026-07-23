import { Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface EducationalNoticeProps {
  compact?: boolean;
}

export function EducationalNotice({ compact = false }: EducationalNoticeProps) {
  return (
    <Alert className="border-primary/20 bg-primary/[0.045] text-foreground">
      <Info className="text-primary" aria-hidden="true" />
      {!compact ? <AlertTitle>Leitura educacional</AlertTitle> : null}
      <AlertDescription>
        Scores ajudam a organizar a análise, mas não são recomendação de compra.
        Confira a fonte, a competência e os riscos antes de decidir.
      </AlertDescription>
    </Alert>
  );
}
