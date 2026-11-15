import { describe, expect, it } from "vitest";
import { cevapYaz, fallbackMessage, guardPrices, NO_PRICE_TEXT, type WorkshopInfo } from "@/lib/agents/cevap";
import { createFakeLlm } from "@/lib/agents/fake-llm";
import { LlmError } from "@/lib/agents/llm";
import type { Diagnosis, ParsedJob, PriceMatch } from "@scoot/shared";

const prices: PriceMatch[] = [
  { priceItem: "Kontrol kartı tamiri", group: "Ducati", minTl: 1500, maxTl: 2500, duration: "2 gün" },
];
const job: ParsedJob = {
  brand: "Ducati", model: "Pro-III", errorCodes: [], symptoms: ["gaz vermiyor"],
  customerName: "Ali", customerPhone: null, missingInfo: [],
};
const diag: Diagnosis = {
  causes: [{ title: "Kontrol kartı arızası", probability: 60, reasoning: "", priceItem: "Kontrol kartı tamiri" }],
  checks: [], questions: [], safetyWarnings: [], unknownCodes: [],
};
const workshop: WorkshopInfo = { name: "E-Scooter Tamir Merkezi", phone: "0535 647 11 11", addressForm: "siz" };

describe("guardPrices", () => {
  it.each([
    ["Tahmini ücret 1.500 – 2.500 TL", true],
    ["Tahmini ücret 1500-2500 TL", true],
    ["Ücret 2.500₺ civarı", true],
    ["Ücret 3.000 TL", false],
    ["Fiyat inceleme sonrası", true],
    ["1.500 - 9.000 TL", false],
  ])("%s → %s", (text, ok) => {
    expect(guardPrices(text, prices)).toBe(ok);
  });
});

describe("cevapYaz", () => {
  it("geçerli mesajı döner, düşük effort kullanır", async () => {
    const llm = createFakeLlm([{ text: "Merhaba Ali Bey, tahmini 1.500 – 2.500 TL." }]);
    const r = await cevapYaz({ job, diag, prices, workshop }, llm);
    expect(r.text).toContain("1.500");
    expect(llm.calls[0].effort).toBe("low");
    expect(llm.calls[0].user).toContain("1500");
  });

  it("listede olmayan tutar varsa bir kez yeniden dener", async () => {
    const llm = createFakeLlm([{ text: "Ücret 9.999 TL" }, { text: "Ücret 1.500 – 2.500 TL" }]);
    const r = await cevapYaz({ job, diag, prices, workshop }, llm);
    expect(r.text).toBe("Ücret 1.500 – 2.500 TL");
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1].user).toContain("listede olmayan");
  });

  it("iki kez geçersiz tutarda şablona düşer (fiyat tablodan kodla yazılır)", async () => {
    const llm = createFakeLlm([{ text: "9.999 TL" }, { text: "8.888 TL" }]);
    const r = await cevapYaz({ job, diag, prices, workshop }, llm);
    expect(r.text).toContain("1.500 – 2.500 TL");
    expect(r.text).not.toContain("9.999");
    expect(r.text).toContain("E-Scooter Tamir Merkezi · 0535 647 11 11");
    expect(guardPrices(r.text, prices)).toBe(true);
  });

  it("şablonda fiyatı olmayan kalem varsa 'inceleme sonrası' cümlesi yer alır", async () => {
    const llm = createFakeLlm([new LlmError("api", "x")]);
    const r = await cevapYaz({ job, diag, prices: [{ priceItem: "BMS değişimi", missing: true }], workshop }, llm);
    expect(r.text).toContain(NO_PRICE_TEXT);
  });

  it("yapay zekâ hata verirse şablona düşer", async () => {
    const llm = createFakeLlm([new LlmError("api", "x")]);
    const r = await cevapYaz({ job, diag, prices, workshop }, llm);
    expect(r.text).toContain("Kontrol kartı arızası");
  });
});

describe("fallbackMessage", () => {
  it("'sen' hitabında 'siz' kelimesi geçmez", () => {
    const r = fallbackMessage({ job, diag, prices, workshop: { ...workshop, addressForm: "sen" } });
    expect(r.text.toLocaleLowerCase("tr-TR")).not.toMatch(/\bsiz/);
  });
});
