import type { SupabaseClient } from "@supabase/supabase-js";
import { BRAND_GROUPS, type BrandGroup, type ParsedJob } from "@scoot/shared";
import type { JobRow, JobStatus, Repo } from "./repo";

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

function asGroup(name: string | undefined): BrandGroup {
  return (BRAND_GROUPS as readonly string[]).includes(name ?? "") ? (name as BrandGroup) : "Diğer";
}

/**
 * Supabase veri deposu. İstemci, giriş yapan kullanıcının erişim anahtarıyla oluşturulmalı;
 * böylece veritabanındaki RLS kuralları her sorguda geçerli olur.
 */
export function createSupabaseRepo(db: SupabaseClient): Repo {
  return {
    async getWorkshop(id) {
      const w = check(
        await db.from("workshops").select("name, phone, address_form").eq("id", id).single(),
        "Atölye okunamadı",
      ) as { name: string; phone: string; address_form: "siz" | "sen" };
      return { name: w.name, phone: w.phone, addressForm: w.address_form };
    },

    async getPriceItems(id) {
      const rows = check(
        await db
          .from("price_items")
          .select("item_name, min_tl, max_tl, duration, brand_groups(name)")
          .eq("workshop_id", id),
        "Fiyat listesi okunamadı",
      ) as unknown as { item_name: string; min_tl: number; max_tl: number; duration: string; brand_groups: { name: string } | null }[];
      return rows.map((r) => ({
        itemName: r.item_name,
        group: asGroup(r.brand_groups?.name),
        minTl: r.min_tl,
        maxTl: r.max_tl,
        duration: r.duration,
      }));
    },

    async getErrorCodes(_id, brand, codes) {
      if (codes.length === 0) return [];
      let q = db.from("error_codes").select("brand, model_family, code, meaning, causes, verified").in("code", codes);
      if (brand) q = q.ilike("brand", brand);
      const rows = check(await q, "Hata kodları okunamadı") as {
        brand: string; model_family: string | null; code: string; meaning: string; causes: string[]; verified: boolean;
      }[];
      return rows.map((r) => ({
        brand: r.brand, modelFamily: r.model_family, code: r.code, meaning: r.meaning, causes: r.causes, verified: r.verified,
      }));
    },

    // Benzerliği yapay zekâ değerlendirir; burada aynı markanın en yeni kayıtları getirilir.
    async findSimilarRepairs(id, brand, _symptoms, limit) {
      let q = db
        .from("repair_records")
        .select("brand, model, symptoms, actual_fault, actions")
        .eq("workshop_id", id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (brand) q = q.ilike("brand", brand);
      const rows = check(await q, "Arşiv okunamadı") as {
        brand: string | null; model: string | null; symptoms: string[]; actual_fault: string; actions: string[];
      }[];
      return rows.map((r) => ({ brand: r.brand, model: r.model, symptoms: r.symptoms, actualFault: r.actual_fault, actions: r.actions }));
    },

    async createJob(workshopId, rawText) {
      const row = check(
        await db.from("jobs").insert({ workshop_id: workshopId, raw_text: rawText, status: "yeni" }).select("id").single(),
        "İş kaydedilemedi",
      ) as { id: string };
      return { id: row.id };
    },

    async updateJob(jobId, p) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (p.status !== undefined) patch.status = p.status;
      if (p.parsed !== undefined) patch.parsed = p.parsed;
      if (p.brand !== undefined) patch.brand = p.brand;
      if (p.model !== undefined) patch.model = p.model;
      if (p.customerName !== undefined) patch.customer_name = p.customerName;
      if (p.customerPhone !== undefined) patch.customer_phone = p.customerPhone;
      if (p.measurements !== undefined) patch.measurements = p.measurements;
      check(await db.from("jobs").update(patch).eq("id", jobId), "İş güncellenemedi");
    },

    async getJob(jobId) {
      const res = await db
        .from("jobs")
        .select("id, workshop_id, status, raw_text, parsed, measurements")
        .eq("id", jobId)
        .maybeSingle();
      const r = check(res, "İş okunamadı") as {
        id: string; workshop_id: string; status: JobStatus; raw_text: string; parsed: ParsedJob | null; measurements: string[];
      } | null;
      if (!r) return null;
      const job: JobRow = {
        id: r.id, workshopId: r.workshop_id, status: r.status, rawText: r.raw_text, parsed: r.parsed, measurements: r.measurements,
      };
      return job;
    },

    async saveAnalysis(a) {
      check(
        await db.from("job_analyses").insert({
          workshop_id: a.workshopId, job_id: a.jobId, diagnosis: a.diagnosis, prices: a.prices, message: a.message, model: a.model,
        }),
        "Analiz kaydedilemedi",
      );
    },

    async saveRepairRecord(r) {
      check(
        await db.from("repair_records").insert({
          workshop_id: r.workshopId,
          job_id: r.jobId,
          brand: r.job.brand,
          model: r.job.model,
          symptoms: r.job.symptoms,
          actual_fault: r.draft.actualFault,
          actions: r.draft.actions,
          parts_replaced: r.draft.partsReplaced,
          actual_price_tl: r.actualPriceTl,
          actual_duration: r.actualDuration,
        }),
        "Tamir kaydı kaydedilemedi",
      );
    },
  };
}
