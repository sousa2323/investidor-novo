import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchFundamentusIndicators } from "@/lib/market-data/fundamentus";

function buildRow(cells: string[]): string {
  return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
}

const headerCells = [
  "Papel", "Cotação", "P/L", "P/VP", "PSR", "Div.Yield", "P/Ativo",
  "P/Cap.Giro", "P/EBIT", "P/Ativ Circ.Liq", "EV/EBIT", "EV/EBITDA",
  "Mrg Bruta", "Mrg Ebit", "Mrg. Líq.", "Liq. Corr.", "ROIC", "ROE",
  "Liq.2meses", "Patrim. Líq", "Dív.Líq/ Patrim.", "Cresc. Rec.5a",
];

function buildHtml(dataRows: string[][]): string {
  const header = `<tr>${headerCells.map((cell) => `<th>${cell}</th>`).join("")}</tr>`;
  return `<table>${header}${dataRows.map(buildRow).join("")}</table>`;
}

function mockFundamentusResponse(html: string) {
  const latin1Bytes = Buffer.from(html, "latin1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => latin1Bytes,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("indicadores do fundamentus", () => {
  it("interpreta números no formato brasileiro e converte liquidez em centavos", async () => {
    mockFundamentusResponse(
      buildHtml([
        // PETR4: uma ação com indicadores completos.
        [
          `<a href="detalhes.php?papel=PETR4">PETR4</a>`, "42,58", "5,10", "1,23",
          "0,000", "6,97%", "0,000", "0,00", "0,00", "0,00", "0,00", "0,00",
          "0,00%", "0,00%", "21,69%", "0,00", "16,79%", "24,17%",
          "434.443.000,00", "186.520.000.000,00", "0,74", "-2,88%",
        ],
      ]),
    );

    const indicators = await fetchFundamentusIndicators();
    const petr4 = indicators.get("PETR4");

    expect(petr4?.dividendYield).toBeCloseTo(6.97, 2);
    expect(petr4?.roe).toBeCloseTo(24.17, 2);
    expect(petr4?.roic).toBeCloseTo(16.79, 2);
    expect(petr4?.netMargin).toBeCloseTo(21.69, 2);
    expect(petr4?.revenueGrowthFiveYears).toBeCloseTo(-2.88, 2);
    // 434.443.000,00 reais → centavos.
    expect(petr4?.averageDailyLiquidityCents).toBe(43_444_300_000);
  });

  it("trata zero como dado ausente nos indicadores de qualidade", async () => {
    mockFundamentusResponse(
      buildHtml([
        // ITUB4 é banco: ROIC e margem líquida vêm zerados na fonte.
        [
          `<a href="detalhes.php?papel=ITUB4">ITUB4</a>`, "42,90", "10,19",
          "2,37", "0,000", "8,08%", "0,000", "0,00", "0,00", "0,00", "0,00",
          "0,00", "0,00%", "0,00%", "0,00%", "0,00", "0,00%", "23,24%",
          "100.000,00", "0,00", "0,00", "71,55%",
        ],
      ]),
    );

    const itub4 = (await fetchFundamentusIndicators()).get("ITUB4");

    expect(itub4?.roe).toBeCloseTo(23.24, 2);
    // Zero em ROIC e margem vira ausência, não valor real.
    expect(itub4?.roic).toBeNull();
    expect(itub4?.netMargin).toBeNull();
  });

  it("ignora linhas cujo primeiro campo não é um ticker válido", async () => {
    mockFundamentusResponse(
      buildHtml([
        Array.from({ length: 22 }, () => "0,00"),
        [
          `<a href="detalhes.php?papel=WEGE3">WEGE3</a>`, "46,74", "31,37",
          "10,40", "0,000", "4,66%", "0,000", "0,00", "0,00", "0,00", "0,00",
          "0,00", "0,00%", "0,00%", "16,63%", "0,00", "24,33%", "33,16%",
          "1.000,00", "0,00", "0,00", "11,24%",
        ],
      ]),
    );

    const indicators = await fetchFundamentusIndicators();

    expect(indicators.has("WEGE3")).toBe(true);
    expect(indicators.get("0")).toBeUndefined();
    expect(indicators.size).toBe(1);
  });
});
