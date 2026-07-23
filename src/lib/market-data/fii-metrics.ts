import type { FiiRegistryEntry } from "@/lib/market-data/cvm-fii";
import type { FiiMetrics } from "@/types/investment";

export interface FiiMetricsInput {
  priceCents: number | null;
  registryEntry: FiiRegistryEntry;
  averageDailyLiquidityCents: number | null;
  referenceDate?: Date;
}

/** Competências consideradas na janela de 12 meses do DY e da regularidade. */
const trailingMonths = 12;

function calculateAgeYears(
  inceptionDate: string | null,
  referenceDate: Date,
): number | null {
  if (!inceptionDate) {
    return null;
  }

  const inception = new Date(`${inceptionDate}T00:00:00Z`);

  if (Number.isNaN(inception.getTime())) {
    return null;
  }

  const elapsedYears =
    (referenceDate.getTime() - inception.getTime()) / (365.25 * 24 * 60 * 60 * 1_000);

  return elapsedYears < 0 ? null : Math.round(elapsedYears * 10) / 10;
}

/**
 * Regularidade dos rendimentos: penaliza tanto a ausência de distribuição em
 * algum mês quanto a oscilação do valor distribuído. Um fundo que paga todo mês
 * um valor estável tende a 100; um que concentra tudo em um mês excepcional cai.
 */
function calculateIncomeRegularityScore(
  monthlyYields: Array<number | null>,
): number | null {
  if (monthlyYields.length < 6) {
    return null;
  }

  const paidYields = monthlyYields.filter(
    (monthlyYield): monthlyYield is number =>
      monthlyYield !== null && monthlyYield > 0,
  );

  if (paidYields.length === 0) {
    return 0;
  }

  const paymentFrequency = paidYields.length / monthlyYields.length;
  // A dispersão percorre a série inteira, com mês sem distribuição valendo zero.
  // Medir só os meses pagos daria estabilidade máxima a quem pagou uma única vez.
  const observedYields = monthlyYields.map((monthlyYield) => monthlyYield ?? 0);
  const averageYield =
    observedYields.reduce((total, monthlyYield) => total + monthlyYield, 0) /
    observedYields.length;

  if (averageYield <= 0) {
    return 0;
  }

  const variance =
    observedYields.reduce(
      (total, monthlyYield) => total + (monthlyYield - averageYield) ** 2,
      0,
    ) / observedYields.length;
  const coefficientOfVariation = Math.sqrt(variance) / averageYield;
  // Coeficiente de variação de 0 vale 100; a partir de 1 a estabilidade zera.
  const stabilityScore = Math.max(0, 1 - coefficientOfVariation);
  const score = (paymentFrequency * 0.6 + stabilityScore * 0.4) * 100;

  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}

/**
 * Risco do fundo combinando a natureza da carteira com a regularidade
 * observada. Sem a vacância — que só existe no informe trimestral — a carteira
 * de tijolo é avaliada pela consistência da distribuição, e a de papel recebe um
 * teto menor por carregar risco de crédito não observável aqui.
 */
function calculateRiskScore(
  registryEntry: FiiRegistryEntry,
  incomeRegularityScore: number | null,
): { riskScore: number | null; riskLabel: string | null } {
  const realEstateAssets = registryEntry.realEstateAssetsCents ?? 0;
  const creditAssets = registryEntry.creditAssetsCents ?? 0;
  const totalAssets = realEstateAssets + creditAssets;

  if (totalAssets === 0 || incomeRegularityScore === null) {
    return { riskScore: null, riskLabel: null };
  }

  const creditShare = creditAssets / totalAssets;
  const isPaperFund = creditShare >= 0.5;
  const ceiling = isPaperFund ? 80 : 100;
  const riskScore = Math.round(Math.min(ceiling, incomeRegularityScore) * 10) / 10;
  const riskLabel =
    riskScore >= 70
      ? "Baixo risco"
      : riskScore >= 40
        ? "Médio risco"
        : "Alto risco";

  return { riskScore, riskLabel };
}

/**
 * Métricas de FII a partir do informe mensal da CVM.
 *
 * `vacancyRate` fica ausente de propósito: o informe mensal não traz vacância, e
 * o score trata `null` como dado faltante em vez de estimar.
 */
export function deriveFiiMetrics({
  priceCents,
  registryEntry,
  averageDailyLiquidityCents,
  referenceDate = new Date(),
}: FiiMetricsInput): FiiMetrics {
  const recentReports = registryEntry.monthlyReports.slice(-trailingMonths);
  const latestReport = registryEntry.monthlyReports.at(-1) ?? null;
  const bookValuePerShare = latestReport?.bookValuePerShare ?? null;
  // Rendimento por cota do mês mais recente com distribuição. O DY mensal da CVM
  // é apurado sobre o valor patrimonial da cota, então DY × VP reconstrói o valor
  // em reais efetivamente pago — conferido contra o rendimento real do MXRF11.
  const lastPaidReport = [...registryEntry.monthlyReports]
    .reverse()
    .find(
      (report) =>
        report.dividendYieldPercent !== null &&
        report.dividendYieldPercent > 0 &&
        report.bookValuePerShare !== null,
    );
  const lastMonthlyDividendCents =
    lastPaidReport &&
    lastPaidReport.dividendYieldPercent !== null &&
    lastPaidReport.bookValuePerShare !== null
      ? Math.round(
          (lastPaidReport.dividendYieldPercent / 100) *
            lastPaidReport.bookValuePerShare *
            100,
        )
      : null;
  const priceToBook =
    priceCents !== null && bookValuePerShare !== null && bookValuePerShare > 0
      ? Math.round((priceCents / 100 / bookValuePerShare) * 100) / 100
      : null;
  const monthlyYields = recentReports.map((report) => report.dividendYieldPercent);
  const observedYields = monthlyYields.filter(
    (monthlyYield): monthlyYield is number => monthlyYield !== null,
  );
  // Só faz sentido anunciar "DY 12 meses" com a janela completa; séries parciais
  // subestimariam o indicador sem avisar.
  const dividendYieldTwelveMonths =
    observedYields.length >= trailingMonths
      ? Math.round(
          observedYields.reduce((total, monthlyYield) => total + monthlyYield, 0) * 100,
        ) / 100
      : null;
  const incomeRegularityScore = calculateIncomeRegularityScore(monthlyYields);
  const { riskScore, riskLabel } = calculateRiskScore(
    registryEntry,
    incomeRegularityScore,
  );

  return {
    priceToBook,
    dividendYieldTwelveMonths,
    incomeRegularityScore,
    averageDailyLiquidityCents,
    riskScore,
    riskLabel,
    vacancyRate: null,
    ageYears: calculateAgeYears(registryEntry.inceptionDate, referenceDate),
    lastMonthlyDividendCents,
  };
}
