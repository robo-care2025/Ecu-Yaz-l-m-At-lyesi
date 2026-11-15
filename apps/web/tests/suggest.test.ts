import { describe, expect, it } from "vitest";
import { suggestPriceUpdate } from "@/lib/pricing/suggest";
import type { PriceItemRow } from "@/lib/pricing/match";

const row: PriceItemRow = { itemName: "Kontrol kartı tamiri", group: "Ducati", minTl: 1500, maxTl: 2500, duration: "2 gün" };

describe("suggestPriceUpdate", () => {
  it("aralığın çok üstündeyse öneri verir", () => {
    const s = suggestPriceUpdate(4000, row);
    expect(s).toMatchObject({ itemName: "Kontrol kartı tamiri", group: "Ducati", currentMin: 1500, currentMax: 2500, actualTl: 4000 });
    expect(s!.message).toBe(
      "Ducati grubunda 'Kontrol kartı tamiri' için gerçek fiyat 4.000 TL, tablodaki aralık 1.500–2.500 TL. Güncellemek ister misiniz?",
    );
  });
  it("aralığın çok altındaysa öneri verir", () => {
    expect(suggestPriceUpdate(1000, row)).not.toBeNull();
  });
  it("%25 tolerans içindeyse öneri vermez", () => {
    expect(suggestPriceUpdate(2600, row)).toBeNull();
    expect(suggestPriceUpdate(1200, row)).toBeNull();
  });
  it("tablo satırı yoksa öneri vermez", () => {
    expect(suggestPriceUpdate(4000, null)).toBeNull();
  });
});
