import { normalizeBrand } from "@scoot/shared";
import { arsivle } from "../agents/arsivci";
import type { LlmCall } from "../agents/llm";
import type { Repo } from "../data/repo";
import { suggestPriceUpdate, type PriceSuggestion } from "../pricing/suggest";

export type CloseInput = {
  workshopId: string;
  jobId: string;
  note: string;
  actualPriceTl: number | null;
  actualDuration: string | null;
  priceItem: string | null;
};

/** İş kapanışı: Arşivci → tamir kaydı → iş "bitti" → gerekirse fiyat güncelleme önerisi. */
export async function closeJob(deps: { repo: Repo; llm: LlmCall }, input: CloseInput): Promise<{ suggestion: PriceSuggestion | null }> {
  const job = await deps.repo.getJob(input.jobId);
  if (!job || job.workshopId !== input.workshopId) throw new Error("İş bulunamadı.");
  const parsed = job.parsed ?? {
    brand: null, model: null, errorCodes: [], symptoms: [job.rawText], customerName: null, customerPhone: null, missingInfo: [],
  };

  const draft = await arsivle({ job: parsed, note: input.note }, deps.llm);
  await deps.repo.saveRepairRecord({
    workshopId: input.workshopId,
    jobId: input.jobId,
    job: parsed,
    draft,
    actualPriceTl: input.actualPriceTl,
    actualDuration: input.actualDuration,
  });
  await deps.repo.updateJob(input.jobId, { status: "bitti" });

  if (input.actualPriceTl == null || !input.priceItem) return { suggestion: null };
  const group = normalizeBrand(parsed.brand).group;
  const items = await deps.repo.getPriceItems(input.workshopId);
  const row =
    items.find((i) => i.itemName === input.priceItem && i.group === group) ??
    items.find((i) => i.itemName === input.priceItem && i.group === "Diğer") ??
    null;
  return { suggestion: suggestPriceUpdate(input.actualPriceTl, row) };
}
