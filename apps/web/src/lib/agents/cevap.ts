import { CustomerMessageSchema, type CustomerMessage, type Diagnosis, type ParsedJob, type PriceMatch } from "@scoot/shared";
import type { LlmCall } from "./llm";

export type WorkshopInfo = { name: string; phone: string; addressForm: "siz" | "sen" };

export type CevapInput = { job: ParsedJob; diag: Diagnosis; prices: PriceMatch[]; workshop: WorkshopInfo };

export const NO_PRICE_TEXT = "Fiyat bilgisi inceleme sonrası bildirilecektir.";

const NUM = String.raw`(?:\d{1,3}(?:\.\d{3})+|\d+)`;
const AMOUNT_RE = new RegExp(String.raw`(${NUM})(?:\s*[-–—]\s*(${NUM}))?\s*(?:TL|₺)`, "gi");

const fmt = (n: number) => n.toLocaleString("tr-TR");

/** Mesajdaki her TL tutarı, eşleşen fiyatların alt/üst sınırlarından biri mi? Değilse uydurma fiyattır. */
export function guardPrices(text: string, prices: PriceMatch[]): boolean {
  const allowed = new Set<number>();
  for (const p of prices) if (!("missing" in p)) allowed.add(p.minTl).add(p.maxTl);
  for (const m of text.matchAll(AMOUNT_RE)) {
    for (const g of [m[1], m[2]]) {
      if (g === undefined) continue;
      const n = parseInt(g.replace(/\./g, ""), 10);
      if (!allowed.has(n)) return false;
    }
  }
  return true;
}

function priceLines(prices: PriceMatch[], raw = false): { lines: string[]; anyMissing: boolean } {
  const lines: string[] = [];
  let anyMissing = false;
  for (const p of prices) {
    if ("missing" in p) anyMissing = true;
    else
      lines.push(
        `${p.priceItem}: ${fmt(p.minTl)} – ${fmt(p.maxTl)} TL, ${p.duration}` +
          (raw ? ` (alt sınır ${p.minTl}, üst sınır ${p.maxTl})` : ""),
      );
  }
  return { lines, anyMissing: anyMissing || lines.length === 0 };
}

const signature = (w: WorkshopInfo) => `${w.name} · ${w.phone}`;

export function cevapSystem(w: WorkshopInfo): string {
  return `Sen "${w.name}" adlı elektrikli scooter tamir atölyesinin müşteri iletişim asistanısın.
Görevin: ustanın teşhis notlarını, müşteriye WhatsApp'tan gönderilecek kısa ve sade bir mesaja çevirmek.

Kurallar:
- Müşteriye "${w.addressForm}" diye hitap et.
- Teknik jargon kullanma; müşterinin anlayacağı dille yaz (örn. "kontrol kartı" yerine gerekirse "scooter'ın beyni sayılan kontrol kartı").
- Kesin teşhis gibi konuşma: "ön değerlendirmemize göre", "muhtemelen" gibi ifadeler kullan; kesin tespitin inceleme sonrası yapılacağını belirt.
- Fiyat ve süreyi YALNIZCA verilen "Fiyat listesi"nden, rakamları aynen yazarak ver. Listede olmayan hiçbir TL tutarı yazma.
- Fiyatı bilinmeyen kalem varsa veya liste boşsa şu cümleyi aynen kullan: "${NO_PRICE_TEXT}"
- 4-7 cümleyi geçme. Emoji kullanma.
- Mesajın son satırı aynen şu imza olsun: ${signature(w)}`;
}

export function buildCevapPrompt(input: CevapInput): string {
  const { lines, anyMissing } = priceLines(input.prices, true);
  const top = input.diag.causes.slice(0, 3);
  return [
    `Müşteri adı: ${input.job.customerName ?? "bilinmiyor"}`,
    `Scooter: ${[input.job.brand, input.job.model].filter(Boolean).join(" ") || "belirtilmedi"}`,
    `Şikâyet: ${input.job.symptoms.join("; ") || "belirtilmedi"}`,
    "",
    "Ön teşhis (olasılık sırasıyla):",
    ...(top.length ? top.map((c) => `- ${c.title} (%${c.probability})`) : ["- henüz net değil"]),
    "",
    "Fiyat listesi:",
    ...(lines.length ? lines.map((l) => `- ${l}`) : ["- yok"]),
    ...(anyMissing ? [`Not: fiyatı bilinmeyen kalem var, "${NO_PRICE_TEXT}" cümlesini kullan.`] : []),
  ].join("\n");
}

/** Yapay zekâsız, her zaman güvenli şablon mesaj. Fiyatlar tablodan kodla yazılır. */
export function fallbackMessage(input: CevapInput): CustomerMessage {
  const sen = input.workshop.addressForm === "sen";
  const name = input.job.customerName ? ` ${input.job.customerName}` : "";
  const top = input.diag.causes[0]?.title;
  const { lines, anyMissing } = priceLines(input.prices);
  const parts = [
    `Merhaba${name},`,
    top
      ? `${sen ? "Scooter'ın" : "Scooter'ınız"} için ön değerlendirmemize göre olası sorun: ${top}.`
      : `${sen ? "Scooter'ını" : "Scooter'ınızı"} incelememiz gerekiyor.`,
    "Kesin tespit inceleme sonrası yapılacaktır.",
    ...(lines.length ? ["Tahmini ücret ve süre:", ...lines.map((l) => `- ${l}`)] : []),
    ...(anyMissing ? [NO_PRICE_TEXT] : []),
    "",
    signature(input.workshop),
  ];
  return { text: parts.join("\n") };
}

/** Cevap ajanı: müşteriye gönderilmeye hazır mesajı yazar; uydurma fiyatı engeller. */
export async function cevapYaz(input: CevapInput, llm: LlmCall): Promise<CustomerMessage> {
  const system = cevapSystem(input.workshop);
  const user = buildCevapPrompt(input);
  try {
    const first = await llm({ schema: CustomerMessageSchema, system, user, effort: "low" });
    if (guardPrices(first.text, input.prices)) return first;
    const second = await llm({
      schema: CustomerMessageSchema,
      system,
      user: `${user}\n\nUYARI: Önceki mesajında listede olmayan bir TL tutarı vardı. Yalnızca listedeki rakamları kullan.`,
      effort: "low",
    });
    if (guardPrices(second.text, input.prices)) return second;
  } catch {
    // Yapay zekâ cevap veremedi: güvenli şablona düş.
  }
  return fallbackMessage(input);
}
