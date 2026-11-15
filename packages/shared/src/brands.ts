export const BRAND_GROUPS = [
  "Ducati",
  "Xiaomi / Segway-Ninebot",
  "Dualtron / Yüksek Voltaj",
  "Diğer",
] as const;

export type BrandGroup = (typeof BRAND_GROUPS)[number];

export type BrandDef = { name: string; group: BrandGroup; aliases: string[] };

/** Seçim listelerindeki sıra. Ducati en sık gelen marka olduğu için ilk sırada. */
export const BRANDS: readonly BrandDef[] = [
  { name: "Ducati", group: "Ducati", aliases: ["ducati"] },
  { name: "Segway", group: "Xiaomi / Segway-Ninebot", aliases: ["segway"] },
  { name: "Ninebot", group: "Xiaomi / Segway-Ninebot", aliases: ["ninebot", "nine bot"] },
  { name: "Xiaomi", group: "Xiaomi / Segway-Ninebot", aliases: ["xiaomi", "mi scooter", "m365", "şaomi", "shaomi"] },
  { name: "Onvo", group: "Diğer", aliases: ["onvo"] },
  { name: "Dualtron", group: "Dualtron / Yüksek Voltaj", aliases: ["dualtron", "minimotors"] },
];

/** Serbest yazılmış marka metnini bilinen bir markaya ve fiyat grubuna çevirir. */
export function normalizeBrand(input: string | null): { brand: string | null; group: BrandGroup } {
  if (!input) return { brand: null, group: "Diğer" };
  const text = input.toLocaleLowerCase("tr-TR");
  let best: { def: BrandDef; pos: number } | null = null;
  for (const def of BRANDS) {
    for (const alias of def.aliases) {
      const pos = text.indexOf(alias);
      if (pos >= 0 && (best === null || pos < best.pos)) best = { def, pos };
    }
  }
  return best ? { brand: best.def.name, group: best.def.group } : { brand: null, group: "Diğer" };
}
