import { describe, expect, it } from "vitest";
import { BATTERY_WARNING, sanitizeDiagnosis, teshisEt, type ErrorCodeRow, type SimilarRepair } from "@/lib/agents/teshis";
import { createFakeLlm } from "@/lib/agents/fake-llm";
import type { Diagnosis, ParsedJob } from "@scoot/shared";

const diag = (over: Partial<Diagnosis> = {}): Diagnosis => ({
  causes: [], checks: [], questions: [], safetyWarnings: [], unknownCodes: [], ...over,
});
const cause = (title: string, probability: number, priceItem: string | null = null) =>
  ({ title, probability, reasoning: "r", priceItem });
const ctx = { priceItemNames: ["Gaz kolu değişimi", "BMS değişimi"], jobCodes: [], knownCodes: [] };

describe("sanitizeDiagnosis", () => {
  it("listede olmayan fiyat kalemini null yapar", () => {
    const r = sanitizeDiagnosis(diag({ causes: [cause("a", 50, "Uydurma iş"), cause("b", 40, "Gaz kolu değişimi")] }), ctx);
    expect(r.causes.map((c) => c.priceItem)).toEqual([null, "Gaz kolu değişimi"]);
  });

  it("olasılıkları kırpar, yuvarlar, sıralar ve 100'e ölçekler", () => {
    const r = sanitizeDiagnosis(diag({ causes: [cause("düşük", 30.4), cause("yüksek", 150), cause("eksi", -5)] }), ctx);
    expect(r.causes.map((c) => c.title)).toEqual(["yüksek", "düşük", "eksi"]);
    expect(r.causes.every((c) => Number.isInteger(c.probability))).toBe(true);
    expect(r.causes.reduce((s, c) => s + c.probability, 0)).toBeLessThanOrEqual(100);
    expect(r.causes[2].probability).toBe(0);
  });

  it("tabloda olmayan kodları koddan hesaplar", () => {
    const r = sanitizeDiagnosis(diag({ unknownCodes: ["E99"] }), { ...ctx, jobCodes: ["E10", "E21"], knownCodes: ["E10"] });
    expect(r.unknownCodes).toEqual(["E21"]);
  });

  it("batarya nedeni varken uyarı yoksa ekler", () => {
    const r = sanitizeDiagnosis(diag({ causes: [cause("BMS arızası", 60)] }), ctx);
    expect(r.safetyWarnings).toEqual([BATTERY_WARNING]);
  });

  it("uyarı zaten varsa eklemez", () => {
    const r = sanitizeDiagnosis(diag({ causes: [cause("Batarya hücresi", 60)], safetyWarnings: ["dikkat"] }), ctx);
    expect(r.safetyWarnings).toEqual(["dikkat"]);
  });
});

describe("teshisEt", () => {
  const job: ParsedJob = {
    brand: "Xiaomi", model: "Pro 2", errorCodes: ["E10", "E77"], symptoms: ["gaz vermiyor"],
    customerName: null, customerPhone: null, missingInfo: [],
  };
  const errorCodes: ErrorCodeRow[] = [
    { brand: "Xiaomi", modelFamily: null, code: "E10", meaning: "Motor-kontrol kartı iletişim hatası", causes: ["kablo"], verified: false },
  ];
  const similar: SimilarRepair[] = [
    { brand: "Xiaomi", model: "Pro 2", symptoms: ["gaz vermiyor"], actualFault: "Gaz kolu hall sensörü", actions: ["gaz kolu değişti"] },
  ];

  it("bağlamı istemde gönderir, yüksek effort kullanır ve çıktıyı temizler", async () => {
    const llm = createFakeLlm([diag({ causes: [cause("Gaz kolu", 70, "Uydurma")] })]);
    const r = await teshisEt(job, { errorCodes, similar, priceItemNames: ["Gaz kolu değişimi"], measurements: ["Batarya 41V"] }, llm);
    const { user, effort } = llm.calls[0];
    expect(effort).toBe("high");
    expect(user).toContain("Motor-kontrol kartı iletişim hatası");
    expect(user).toContain("doğrulanmamış");
    expect(user).toContain("Gaz kolu hall sensörü");
    expect(user).toContain("Gaz kolu değişimi");
    expect(user).toContain("Batarya 41V");
    expect(r.causes[0].priceItem).toBeNull();
    expect(r.unknownCodes).toEqual(["E77"]);
  });
});
