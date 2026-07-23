import { describe, expect, it } from "vitest";

import { parseCvmCsv } from "@/lib/market-data/cvm";

const anonymizedDfpFixture =
  "CD_CVM;DENOM_CIA;CD_CONTA;DS_CONTA;VL_CONTA;DT_REFER\n99999;COMPANHIA ANONIMIZADA;3.11;Lucro Líquido;123456,78;2025-12-31";

describe("parser CSV CVM", () => {
  it("preserva códigos de conta e competência", () => {
    const parsed = parseCvmCsv(anonymizedDfpFixture);
    expect(parsed.headers).toContain("CD_CONTA");
    expect(parsed.rows[0]).toMatchObject({
      CD_CVM: "99999",
      CD_CONTA: "3.11",
      DT_REFER: "2025-12-31",
    });
  });
});
