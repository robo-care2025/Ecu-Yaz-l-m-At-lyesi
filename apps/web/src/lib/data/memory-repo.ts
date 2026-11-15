import type { WorkshopInfo } from "../agents/cevap";
import type { ErrorCodeRow, SimilarRepair } from "../agents/teshis";
import type { PriceItemRow } from "../pricing/match";
import type { JobRow, Repo } from "./repo";

type Seed = {
  workshops?: Record<string, WorkshopInfo>;
  priceItems?: Record<string, PriceItemRow[]>;
  errorCodes?: ErrorCodeRow[];
  repairs?: Record<string, SimilarRepair[]>;
};

/** Testler için bellek içi veri deposu. */
export function createMemoryRepo(seed: Seed = {}) {
  const jobs = new Map<string, JobRow>();
  const analyses: Parameters<Repo["saveAnalysis"]>[0][] = [];
  const repairs: Record<string, SimilarRepair[]> = structuredClone(seed.repairs ?? {});
  let seq = 0;

  const repo: Repo = {
    async getWorkshop(id) {
      const w = seed.workshops?.[id];
      if (!w) throw new Error(`Atölye bulunamadı: ${id}`);
      return w;
    },
    async getPriceItems(id) {
      return seed.priceItems?.[id] ?? [];
    },
    async getErrorCodes(_id, brand, codes) {
      return (seed.errorCodes ?? []).filter(
        (e) => codes.includes(e.code) && (!brand || e.brand.toLowerCase() === brand.toLowerCase()),
      );
    },
    async findSimilarRepairs(id, brand, _symptoms, limit) {
      const all = [...(repairs[id] ?? [])].reverse();
      return all.filter((r) => !brand || r.brand?.toLowerCase() === brand.toLowerCase()).slice(0, limit);
    },
    async createJob(workshopId, rawText) {
      const id = `job-${++seq}`;
      jobs.set(id, { id, workshopId, status: "yeni", rawText, parsed: null, measurements: [] });
      return { id };
    },
    async updateJob(jobId, patch) {
      const j = jobs.get(jobId);
      if (!j) throw new Error(`İş bulunamadı: ${jobId}`);
      if (patch.status) j.status = patch.status;
      if (patch.parsed) j.parsed = patch.parsed;
      if (patch.measurements) j.measurements = patch.measurements;
    },
    async getJob(jobId) {
      const j = jobs.get(jobId);
      return j ? structuredClone(j) : null;
    },
    async saveAnalysis(a) {
      analyses.push(a);
    },
    async saveRepairRecord(r) {
      (repairs[r.workshopId] ??= []).push({
        brand: r.job.brand,
        model: r.job.model,
        symptoms: r.job.symptoms,
        actualFault: r.draft.actualFault,
        actions: r.draft.actions,
      });
    },
  };

  return Object.assign(repo, {
    analyses,
    jobCount: () => jobs.size,
    repairsOf: (id: string) => repairs[id] ?? [],
  });
}
