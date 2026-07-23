import { refreshFundamentalsData } from "../src/lib/market-data/refresh";

async function bootstrapMarketHistory() {
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: 6 },
    (_unusedValue, yearIndex) => currentYear - 5 + yearIndex,
  );

  for (const referenceYear of years) {
    const results = await refreshFundamentalsData(referenceYear);
    console.log(referenceYear, results);
  }
}

bootstrapMarketHistory().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
