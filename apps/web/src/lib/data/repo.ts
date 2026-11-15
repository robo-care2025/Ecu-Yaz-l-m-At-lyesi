import type { Diagnosis, ParsedJob, PriceMatch, RepairRecordDraft } from "@scoot/shared";
import type { WorkshopInfo } from "../agents/cevap";
import type { ErrorCodeRow, SimilarRepair } from "../agents/teshis";
import type { PriceItemRow } from "../pricing/match";

export type JobStatus = "yeni" | "analiz_edildi" | "analiz_hatasi" | "musteriye_yazildi" | "tamirde" | "bitti";

export type JobRow = {
  id: string;
  workshopId: string;
  status: JobStatus;
  rawText: string;
  parsed: ParsedJob | null;
  measurements: string[];
};

export type JobPatch = Partial<{
  status: JobStatus;
  parsed: ParsedJob;
  brand: string | null;
  model: string | null;
  customerName: string | null;
  customerPhone: string | null;
  measurements: string[];
}>;

/** Yönetici akışın veriye eriştiği tek arayüz. Testlerde bellek içi, gerçekte Supabase uygulaması kullanılır. */
export interface Repo {
  getWorkshop(workshopId: string): Promise<WorkshopInfo>;
  getPriceItems(workshopId: string): Promise<PriceItemRow[]>;
  getErrorCodes(workshopId: string, brand: string | null, codes: string[]): Promise<ErrorCodeRow[]>;
  findSimilarRepairs(workshopId: string, brand: string | null, symptoms: string[], limit: number): Promise<SimilarRepair[]>;
  createJob(workshopId: string, rawText: string): Promise<{ id: string }>;
  updateJob(jobId: string, patch: JobPatch): Promise<void>;
  getJob(jobId: string): Promise<JobRow | null>;
  saveAnalysis(a: { workshopId: string; jobId: string; diagnosis: Diagnosis; prices: PriceMatch[]; message: string; model: string }): Promise<void>;
  saveRepairRecord(r: {
    workshopId: string;
    jobId: string;
    job: ParsedJob;
    draft: RepairRecordDraft;
    actualPriceTl: number | null;
    actualDuration: string | null;
  }): Promise<void>;
}
