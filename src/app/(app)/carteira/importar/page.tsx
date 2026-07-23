import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { CsvImporter } from "@/components/portfolio/csv-importer";
import { requireCurrentUser } from "@/lib/dal/session";

export const metadata: Metadata = {
  title: "Importar carteira",
};

export default async function PortfolioImportPage() {
  await requireCurrentUser();

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Carteira"
        title="Importar movimentações"
        description="Revise todas as linhas antes de confirmar. Duplicados exatos são ignorados e qualquer erro bloqueia a importação atômica."
      />
      <CsvImporter />
    </div>
  );
}
