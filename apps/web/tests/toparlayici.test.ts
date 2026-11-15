import { describe, expect, it } from "vitest";
import { toparla } from "@/lib/agents/toparlayici";
import { createFakeLlm } from "@/lib/agents/fake-llm";
import type { ParsedJob } from "@scoot/shared";

const base: ParsedJob = {
  brand: null, model: null, errorCodes: [], symptoms: ["gaz vermiyor"],
  customerName: null, customerPhone: null, missingInfo: [],
};

describe("toparla", () => {
  it("markayı ve kodları normalize eder", async () => {
    const llm = createFakeLlm([{ ...base, brand: "ninebot", errorCodes: ["e 10"] }]);
    const r = await toparla({ rawText: "ninebot e 10 gaz vermiyor" }, llm);
    expect(r.brand).toBe("Ninebot");
    expect(r.errorCodes).toEqual(["E10"]);
  });

  it("formdaki marka ipucu metindekinden önceliklidir", async () => {
    const llm = createFakeLlm([{ ...base, brand: "Xiaomi" }]);
    const r = await toparla({ rawText: "x", brandHint: "Ducati", modelHint: "Pro-III" }, llm);
    expect(r.brand).toBe("Ducati");
    expect(r.model).toBe("Pro-III");
  });

  it("formdaki kod önce gelir, tekrarlar atılır", async () => {
    const llm = createFakeLlm([{ ...base, errorCodes: ["E10", "e14"] }]);
    const r = await toparla({ rawText: "x", errorCodeHint: "14" }, llm);
    expect(r.errorCodes).toEqual(["E14", "E10"]);
  });

  it("sayı içermeyen kodlar atılır", async () => {
    const llm = createFakeLlm([{ ...base, errorCodes: ["yanıp sönüyor", "E21"] }]);
    const r = await toparla({ rawText: "x" }, llm);
    expect(r.errorCodes).toEqual(["E21"]);
  });

  it("ham metni gönderir, düşük effort kullanır", async () => {
    const llm = createFakeLlm([base]);
    await toparla({ rawText: "Selam abi scooter şarj olmuyor" }, llm);
    expect(llm.calls[0].user).toContain("Selam abi scooter şarj olmuyor");
    expect(llm.calls[0].effort).toBe("low");
  });

  it("tanınmayan markayı LLM'in yazdığı haliyle bırakır", async () => {
    const llm = createFakeLlm([{ ...base, brand: "Kugoo" }]);
    const r = await toparla({ rawText: "kugoo" }, llm);
    expect(r.brand).toBe("Kugoo");
  });
});
