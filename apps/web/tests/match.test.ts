import { describe, expect, it } from "vitest";
import { matchPrices, type PriceItemRow } from "@/lib/pricing/match";
import type { Diagnosis } from "@scoot/shared";

const items: PriceItemRow[] = [
  { itemName: "Kontrol kartı tamiri", group: "Ducati", minTl: 2000, maxTl: 3000, duration: "2 gün" },
  { itemName: "Kontrol kartı tamiri", group: "Diğer", minTl: 1500, maxTl: 2500, duration: "2 gün" },
  { itemName: "Gaz kolu değişimi", group: "Diğer", minTl: 400, maxTl: 700, duration: "Aynı gün" },
];
const diag = (...priceItems: (string | null)[]): Diagnosis => ({
  causes: priceItems.map((p, i) => ({ title: `n${i}`, probability: 50 - i, reasoning: "", priceItem: p })),
  checks: [], questions: [], safetyWarnings: [], unknownCodes: [],
});

describe("matchPrices", () => {
  it("marka grubunun kendi satırını seçer", () => {
    expect(matchPrices(diag("Kontrol kartı tamiri"), "Ducati", items)).toEqual([
      { priceItem: "Kontrol kartı tamiri", group: "Ducati", minTl: 2000, maxTl: 3000, duration: "2 gün" },
    ]);
  });
  it("grup satırı yoksa Diğer satırına düşer", () => {
    expect(matchPrices(diag("Gaz kolu değişimi"), "Ducati", items)[0]).toMatchObject({ group: "Diğer", minTl: 400 });
  });
  it("hiç satır yoksa missing döner", () => {
    expect(matchPrices(diag("BMS değişimi"), "Ducati", items)).toEqual([{ priceItem: "BMS değişimi", missing: true }]);
  });
  it("priceItem null olanları atlar, tekrarları bir kez listeler", () => {
    const r = matchPrices(diag(null, "Gaz kolu değişimi", "Gaz kolu değişimi"), "Diğer", items);
    expect(r).toHaveLength(1);
  });
});
