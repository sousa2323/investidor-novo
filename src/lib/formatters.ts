export const brazilianCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export const brazilianNumberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

export const brazilianPercentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatCurrencyFromCents(valueCents: number): string {
  return brazilianCurrencyFormatter.format(valueCents / 100);
}

export function formatPercentage(value: number | null): string {
  return value === null
    ? "Indisponível"
    : `${brazilianNumberFormatter.format(value)}%`;
}

export function formatCompactCurrencyFromCents(valueCents: number | null): string {
  if (valueCents === null) {
    return "Indisponível";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(valueCents / 100);
}

/**
 * Rótulos curtos de setor para a listagem.
 *
 * O brapi devolve o setor das ações em inglês quando não há subsetor, e alguns
 * subsetores em português são longos demais para a coluna. O mapa cobre esses
 * casos; o que não está aqui é exibido como veio (e truncado via CSS, com o
 * texto completo no title).
 */
const sectorLabelOverrides: Record<string, string> = {
  "Finance": "Financeiro",
  "Energy Minerals": "Petróleo e gás",
  "Non-Energy Minerals": "Mineração",
  "Commercial Services": "Serviços",
  "Retail Trade": "Varejo",
  "Producer Manufacturing": "Indústria",
  "Utilities": "Utilidade pública",
  "Consumer Non-Durables": "Consumo não durável",
  "Consumer Services": "Serviços ao consumidor",
  "Health Services": "Saúde",
  "Transportation": "Transporte",
  "Consumer Durables": "Consumo durável",
  "Communications": "Comunicações",
  "Technology Services": "Tecnologia",
  "Process Industries": "Processo industrial",
  "Miscellaneous": "Diversos",
  "Electronic Technology": "Eletrônicos",
  "Health Technology": "Saúde",
  "Distribution Services": "Distribuição",
  "Industrial Services": "Serviços industriais",
  "Government": "Governo",
  "Serv.Méd.Hospit..Análises e Diagnósticos": "Saúde e diagnósticos",
  "Serv.Méd.Hospit.,Análises e Diagnósticos": "Saúde e diagnósticos",
  "Comércio e Distribuição": "Comércio",
  "Máquinas e Equipamentos": "Máquinas",
  "Programas e Serviços": "Software e serviços",
};

export function formatSectorLabel(classification: string): string {
  return sectorLabelOverrides[classification] ?? classification;
}

/**
 * Provento anual estimado por ação/cota, a partir do dividend yield e do preço.
 * É uma projeção sobre o preço atual, não um valor declarado — daí o "estimado"
 * onde aparece.
 */
export function estimateAnnualDividendCents(
  priceCents: number,
  dividendYieldPercent: number | null | undefined,
): number | null {
  if (
    !priceCents ||
    dividendYieldPercent === null ||
    dividendYieldPercent === undefined ||
    !Number.isFinite(dividendYieldPercent)
  ) {
    return null;
  }
  return Math.round((priceCents * dividendYieldPercent) / 100);
}

/** Variação do dia com sinal explícito, como as telas de cotação mostram. */
export function formatSignedPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  const formattedValue = brazilianNumberFormatter.format(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formattedValue}%`;
}

export function formatCompactNumber(value: number | null): string {
  if (value === null) {
    return "Indisponível";
  }

  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Distância em linguagem natural, para indicar a idade da cotação. */
export function formatRelativeTime(dateValue: string | Date | null): string {
  if (!dateValue) {
    return "sem horário";
  }

  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;

  if (Number.isNaN(date.getTime())) {
    return "sem horário";
  }

  const elapsedSeconds = Math.round((Date.now() - date.getTime()) / 1_000);

  if (elapsedSeconds < 60) {
    return "agora";
  }
  if (elapsedSeconds < 3_600) {
    return `há ${Math.floor(elapsedSeconds / 60)} min`;
  }
  if (elapsedSeconds < 86_400) {
    return `há ${Math.floor(elapsedSeconds / 3_600)} h`;
  }

  return `há ${Math.floor(elapsedSeconds / 86_400)} d`;
}

export function formatDateTime(dateValue: string | Date): string {
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function formatDate(dateValue: string | Date): string {
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
