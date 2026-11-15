import type { BrandGroup, Diagnosis, PriceMatch } from "@scoot/shared";

export type PriceItemRow = {
  itemName: string;
  group: BrandGroup;
  minTl: number;
  maxTl: number;
  duration: string;
};

/**
 * Fiyat eşleştirici (yapay zekâ değil, düz kod): teşhisteki iş kalemlerini atölyenin fiyat tablosunda arar.
 * Önce markanın grubu, yoksa "Diğer" grubu; o da yoksa "fiyat yok" işareti döner.
 */
export function matchPrices(diag: Diagnosis, group: BrandGroup, items: PriceItemRow[]): PriceMatch[] {
  const seen = new Set<string>();
  const out: PriceMatch[] = [];
  for (const cause of diag.causes) {
    const name = cause.priceItem;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const row =
      items.find((i) => i.itemName === name && i.group === group) ??
      items.find((i) => i.itemName === name && i.group === "Diğer");
    out.push(
      row
        ? { priceItem: name, group: row.group, minTl: row.minTl, maxTl: row.maxTl, duration: row.duration }
        : { priceItem: name, missing: true },
    );
  }
  return out;
}
