import { describe, expect, it } from "vitest";
import { analyzeJob, buildWhatsappUrl } from "@/lib/pipeline/analyze";
import { closeJob } from "@/lib/pipeline/close";
import { createMemoryRepo } from "@/lib/data/memory-repo";
import { createFakeLlm } from "@/lib/agents/fake-llm";
import { LlmError, type LlmArgs } from "@/lib/agents/llm";
import { TOPARLAYICI_SYSTEM } from "@/lib/agents/toparlayici";
import { TESHIS_SYSTEM } from "@/lib/agents/teshis";
import { ARSIVCI_SYSTEM } from "@/lib/agents/arsivci";
import type { Diagnosis, ParsedJob } from "@scoot/shared";

const WS = "ws-1";

function makeRepo() {
  return createMemoryRepo({
    workshops: { [WS]: { name: "E-Scooter Tamir Merkezi", phone: "0535 647 11 11", addressForm: "siz" } },
    priceItems: {
      [WS]: [
        { itemName: "Gaz kolu değişimi", group: "Diğer", minTl: 400, maxTl: 700, duration: "Aynı gün" },
        { itemName: "Kontrol kartı tamiri", group: "Xiaomi / Segway-Ninebot", minTl: 1500, maxTl: 2500, duration: "2 gün" },
      ],
    },
    errorCodes: [
      { brand: "Ninebot", modelFamily: null, code: "E10", meaning: "İletişim hatası (test)", causes: [], verified: true },
    ],
    repairs: {
      [WS]: [{ brand: "Ninebot", model: "Max G30", symptoms: ["gaz vermiyor"], actualFault: "Kablo kopuk (test vakası)", actions: ["kablo onarıldı"] }],
    },
  });
}

const parsed: ParsedJob = {
  brand: "Ninebot", model: "Max G30", errorCodes: ["E10"], symptoms: ["gaz vermiyor"],
  customerName: "Ali", customerPhone: "0532 111 22 33", missingInfo: [],
};
const diagnosis: Diagnosis = {
  causes: [
    { title: "Gaz kolu sensörü", probability: 50, reasoning: "", priceItem: "Gaz kolu değişimi" },
    { title: "Kontrol kartı", probability: 30, reasoning: "", priceItem: "Kontrol kartı tamiri" },
  ],
  checks: [], questions: [], safetyWarnings: [], unknownCodes: [],
};

/** Hangi ajan çağrıldıysa ona uygun sahte cevap döner. */
function agentLlm(over: Partial<Record<"toparla" | "teshis" | "cevap" | "arsiv", unknown>> = {}) {
  return createFakeLlm((args: LlmArgs<unknown>) => {
    if (args.system === TOPARLAYICI_SYSTEM) return over.toparla ?? parsed;
    if (args.system === TESHIS_SYSTEM) return over.teshis ?? diagnosis;
    if (args.system === ARSIVCI_SYSTEM)
      return over.arsiv ?? { actualFault: "Kontrol kartı MOSFET", actions: ["MOSFET değişti"], partsReplaced: ["MOSFET"] };
    return over.cevap ?? { text: "Merhaba Ali, tahmini 400 – 700 TL." };
  });
}

const RAW = "Ninebot max g30, ekranda e10 yazıyor gaz vermiyor, Ali 0532 111 22 33";

describe("analyzeJob", () => {
  it("uçtan uca: iş açar, analiz eder, kaydeder", async () => {
    const repo = makeRepo();
    const llm = agentLlm();
    const r = await analyzeJob({ repo, llm, model: "m" }, { workshopId: WS, rawText: RAW });
    expect(r.message).toContain("400");
    expect(r.prices).toHaveLength(2);
    expect(r.prices[1]).toMatchObject({ group: "Xiaomi / Segway-Ninebot", minTl: 1500 });
    expect(r.whatsappUrl?.startsWith("https://wa.me/905321112233?text=")).toBe(true);
    const job = await repo.getJob(r.jobId);
    expect(job?.status).toBe("analiz_edildi");
    expect(job?.rawText).toBe(RAW);
    expect(repo.analyses).toHaveLength(1);
  });

  it("teşhise tablodaki kod anlamını ve benzer vakayı verir", async () => {
    const llm = agentLlm();
    await analyzeJob({ repo: makeRepo(), llm, model: "m" }, { workshopId: WS, rawText: RAW });
    const teshisCall = llm.calls.find((c) => c.system === TESHIS_SYSTEM)!;
    expect(teshisCall.user).toContain("İletişim hatası (test)");
    expect(teshisCall.user).toContain("Kablo kopuk (test vakası)");
  });

  it("toparlayıcı hata verirse iş analiz_hatasi olur, ham metin korunur", async () => {
    const repo = makeRepo();
    const llm = agentLlm({ toparla: new LlmError("api", "x") });
    const err = await analyzeJob({ repo, llm, model: "m" }, { workshopId: WS, rawText: RAW }).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.jobId).toBeTruthy();
    const job = await repo.getJob(err.jobId);
    expect(job?.status).toBe("analiz_hatasi");
    expect(job?.rawText).toBe(RAW);
  });

  it("jobId ile yeniden analiz: yeni iş açmaz, ölçümü ekler", async () => {
    const repo = makeRepo();
    const first = await analyzeJob({ repo, llm: agentLlm(), model: "m" }, { workshopId: WS, rawText: RAW });
    const llm = agentLlm();
    await analyzeJob({ repo, llm, model: "m" }, { workshopId: WS, jobId: first.jobId, rawText: "", measurements: ["Batarya 36V"] });
    expect(repo.jobCount()).toBe(1);
    expect((await repo.getJob(first.jobId))?.measurements).toEqual(["Batarya 36V"]);
    expect(llm.calls.find((c) => c.system === TESHIS_SYSTEM)!.user).toContain("Batarya 36V");
  });
});

describe("closeJob", () => {
  it("kaydı arşivler, işi bitirir, fiyat önerisi verir", async () => {
    const repo = makeRepo();
    const a = await analyzeJob({ repo, llm: agentLlm(), model: "m" }, { workshopId: WS, rawText: RAW });
    const r = await closeJob(
      { repo, llm: agentLlm() },
      { workshopId: WS, jobId: a.jobId, note: "MOSFET yanmış", actualPriceTl: 4000, actualDuration: "2 gün", priceItem: "Kontrol kartı tamiri" },
    );
    expect(r.suggestion?.actualTl).toBe(4000);
    expect((await repo.getJob(a.jobId))?.status).toBe("bitti");
    expect(repo.repairsOf(WS)).toHaveLength(2);
  });
});

describe("buildWhatsappUrl", () => {
  it.each([
    ["0532 111 22 33", "905321112233"],
    ["+90 532 111 22 33", "905321112233"],
    ["5321112233", "905321112233"],
  ])("%s", (phone, digits) => {
    expect(buildWhatsappUrl(phone, "a b")).toBe(`https://wa.me/${digits}?text=a%20b`);
  });
  it("telefon yoksa null", () => expect(buildWhatsappUrl(null, "x")).toBeNull());
});
