import { normalizeBrand, type Diagnosis, type ParsedJob, type PriceMatch } from "@scoot/shared";
import { cevapYaz } from "../agents/cevap";
import type { LlmCall } from "../agents/llm";
import { teshisEt } from "../agents/teshis";
import { toparla } from "../agents/toparlayici";
import type { Repo } from "../data/repo";
import { matchPrices } from "../pricing/match";

export type AnalyzeInput = {
  workshopId: string;
  jobId?: string;
  rawText: string;
  brandHint?: string | null;
  modelHint?: string | null;
  errorCodeHint?: string | null;
  measurements?: string[];
};

export type AnalysisResult = {
  jobId: string;
  parsed: ParsedJob;
  diagnosis: Diagnosis;
  prices: PriceMatch[];
  message: string;
  whatsappUrl: string | null;
};

const SIMILAR_LIMIT = 5;

/** Türkiye numarasını wa.me biçimine çevirir: "0532 111 22 33" → https://wa.me/905321112233?text=... */
export function buildWhatsappUrl(phone: string | null, message: string): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10) return null;
  return `https://wa.me/90${d}?text=${encodeURIComponent(message)}`;
}

/**
 * Yönetici akış: Toparlayıcı → Teşhis → Fiyat eşleştirici → Cevap.
 * Yapay zekâ hatasında iş "analiz_hatasi" olur, ham metin kaybolmaz; hata jobId ile yeniden fırlatılır.
 */
export async function analyzeJob(
  deps: { repo: Repo; llm: LlmCall; model: string },
  input: AnalyzeInput,
): Promise<AnalysisResult> {
  const { repo, llm } = deps;
  let jobId = input.jobId;
  let parsed: ParsedJob | null = null;
  let measurements = input.measurements ?? [];

  if (jobId) {
    const existing = await repo.getJob(jobId);
    if (!existing || existing.workshopId !== input.workshopId) throw new Error("İş bulunamadı.");
    parsed = existing.parsed;
    measurements = [...existing.measurements, ...measurements.filter((m) => !existing.measurements.includes(m))];
    await repo.updateJob(jobId, { measurements });
  } else {
    jobId = (await repo.createJob(input.workshopId, input.rawText)).id;
    if (measurements.length) await repo.updateJob(jobId, { measurements });
  }

  try {
    if (!parsed) {
      const raw = input.rawText || (await repo.getJob(jobId))!.rawText;
      parsed = await toparla(
        { rawText: raw, brandHint: input.brandHint, modelHint: input.modelHint, errorCodeHint: input.errorCodeHint },
        llm,
      );
      await repo.updateJob(jobId, {
        parsed,
        brand: parsed.brand,
        model: parsed.model,
        customerName: parsed.customerName,
        customerPhone: parsed.customerPhone,
      });
    }

    const [errorCodes, similar, priceItems] = await Promise.all([
      repo.getErrorCodes(input.workshopId, parsed.brand, parsed.errorCodes),
      repo.findSimilarRepairs(input.workshopId, parsed.brand, parsed.symptoms, SIMILAR_LIMIT),
      repo.getPriceItems(input.workshopId),
    ]);
    const priceItemNames = [...new Set(priceItems.map((p) => p.itemName))];

    const diagnosis = await teshisEt(parsed, { errorCodes, similar, priceItemNames, measurements }, llm);
    const prices = matchPrices(diagnosis, normalizeBrand(parsed.brand).group, priceItems);
    const workshop = await repo.getWorkshop(input.workshopId);
    const { text: message } = await cevapYaz({ job: parsed, diag: diagnosis, prices, workshop }, llm);

    await repo.saveAnalysis({ workshopId: input.workshopId, jobId, diagnosis, prices, message, model: deps.model });
    await repo.updateJob(jobId, { status: "analiz_edildi" });

    return { jobId, parsed, diagnosis, prices, message, whatsappUrl: buildWhatsappUrl(parsed.customerPhone, message) };
  } catch (err) {
    await repo.updateJob(jobId, { status: "analiz_hatasi" }).catch(() => {});
    if (err && typeof err === "object") Object.assign(err, { jobId });
    throw err;
  }
}
