export function parseBrazilianNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (!value) {
    return 0;
  }

  const normalizedValue = value
    .trim()
    .replace(/^R\$\s?/, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
}

export function parseBrazilianCurrencyToCents(
  value: string | number | null | undefined,
): number {
  const parsedValue = parseBrazilianNumber(value);
  return Number.isFinite(parsedValue) ? Math.round(parsedValue * 100) : Number.NaN;
}
