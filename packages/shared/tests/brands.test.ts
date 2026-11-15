import { describe, expect, it } from "vitest";
import { BRANDS, BRAND_GROUPS, normalizeBrand } from "../src/brands";

describe("normalizeBrand", () => {
  it.each([
    ["ninebot max g30", "Ninebot", "Xiaomi / Segway-Ninebot"],
    ["SEGWAY", "Segway", "Xiaomi / Segway-Ninebot"],
    ["Xiaomi m365 pro 2", "Xiaomi", "Xiaomi / Segway-Ninebot"],
    ["dualtron thunder", "Dualtron", "Dualtron / Yüksek Voltaj"],
    ["ducati pro-iii", "Ducati", "Ducati"],
    ["Onvo", "Onvo", "Diğer"],
    ["Kugoo", null, "Diğer"],
    [null, null, "Diğer"],
  ] as const)("normalizeBrand(%s)", (inp, brand, group) => {
    expect(normalizeBrand(inp)).toEqual({ brand, group });
  });

  it("Ducati listede ilk", () => {
    expect(BRANDS[0].name).toBe("Ducati");
    expect(BRAND_GROUPS[0]).toBe("Ducati");
  });
});
