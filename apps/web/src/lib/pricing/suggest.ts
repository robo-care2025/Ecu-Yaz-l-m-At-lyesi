import type { BrandGroup } from "@scoot/shared";
import type { PriceItemRow } from "./match";

export type PriceSuggestion = {
  itemName: string;
  group: BrandGroup;
  currentMin: number;
  currentMax: number;
  actualTl: number;
  message: string;
};

const TOLERANCE = 0.25;
const fmt = (n: number) => n.toLocaleString("tr-TR");

/** Gerçek fiyat tablodaki aralığın %25'inden fazla dışına çıktıysa güncelleme önerir. */
export function suggestPriceUpdate(actualTl: number, row: PriceItemRow | null): PriceSuggestion | null {
  if (!row) return null;
  const tooLow = actualTl < row.minTl * (1 - TOLERANCE);
  const tooHigh = actualTl > row.maxTl * (1 + TOLERANCE);
  if (!tooLow && !tooHigh) return null;
  return {
    itemName: row.itemName,
    group: row.group,
    currentMin: row.minTl,
    currentMax: row.maxTl,
    actualTl,
    message: `${row.group} grubunda '${row.itemName}' için gerçek fiyat ${fmt(actualTl)} TL, tablodaki aralık ${fmt(row.minTl)}–${fmt(row.maxTl)} TL. Güncellemek ister misiniz?`,
  };
}
