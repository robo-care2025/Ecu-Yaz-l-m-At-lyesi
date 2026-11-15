import { DiagnosisSchema, type Diagnosis, type ParsedJob } from "@scoot/shared";
import type { LlmCall } from "./llm";

export type ErrorCodeRow = {
  brand: string;
  modelFamily: string | null;
  code: string;
  meaning: string;
  causes: string[];
  verified: boolean;
};

export type SimilarRepair = {
  brand: string | null;
  model: string | null;
  symptoms: string[];
  actualFault: string;
  actions: string[];
};

export type TeshisContext = {
  errorCodes: ErrorCodeRow[];
  similar: SimilarRepair[];
  priceItemNames: string[];
  measurements: string[];
};

export const BATTERY_WARNING =
  "Lityum batarya ile çalışırken kısa devre ve ısınma riskine dikkat edin; hasarlı/şişmiş hücreleri şarj etmeyin.";

const BATTERY_RE = /batarya|bms|hücre|şarj/i;

export const TESHIS_SYSTEM = `Sen deneyimli bir elektrikli scooter elektronik teknisyeninin teşhis asistanısın.
Kullanıcın bir elektronik teknisyeni: ölçü aleti kullanır, kart tamiri yapar. Ona kısa, net ve ölçülebilir yönlendirme ver.

Görevin:
1. causes: olası arıza nedenlerini en olasıdan başlayarak sırala. probability 0-100 arası tam sayı; toplam 100'ü geçmesin. reasoning: tek cümlelik gerekçe.
2. checks: ustanın sırayla yapacağı kontrol ve ölçüm adımları. expected alanına ölçülebilir beklenen değeri yaz (örn. "Gaz kolu sinyal ucu: boşta ~0.8 V, tam gazda ~4.2 V"). Değerden emin değilsen expected = null bırak, tahmin uydurma.
3. questions: teşhisi netleştirmek için ustaya veya müşteriye sorulacak kısa sorular.
4. safetyWarnings: gerekiyorsa güvenlik uyarıları (özellikle lityum batarya, yüksek voltaj).
5. unknownCodes: boş liste bırakabilirsin (sistem hesaplar).

Kesin kurallar:
- Hata kodlarının anlamını YALNIZCA verilen "Hata kodu tablosu"ndan al. Tabloda olmayan bir kod için anlam uydurma; "bu kod tabloda yok" diye belirt ve belirtilere göre ilerle.
- Tabloda "doğrulanmamış" işaretli satırları kullanırken bunu gerekçede belirt.
- Aynı kod farklı model ailelerinde farklı anlama gelebilir (tabloda parantez içinde model ailesi yazar). Scooterın modeline uyan satırı kullan; model bilinmiyorsa veya tablodaki ailelerden değilse olası anlamları birlikte belirt ve questions alanında modeli sor.
- priceItem alanına YALNIZCA verilen "Fiyat listesindeki iş kalemleri" arasından birebir bir ad yaz; uygun kalem yoksa null.
- "Atölyenin geçmiş tamirleri" varsa onlara ağırlık ver: bu atölyenin gerçek tecrübesidir.`;

/** Teşhis çıktısını düz kodla denetler: uydurma fiyat kalemi, olasılık, bilinmeyen kod, batarya uyarısı. */
export function sanitizeDiagnosis(
  d: Diagnosis,
  ctx: { priceItemNames: string[]; jobCodes: string[]; knownCodes: string[] },
): Diagnosis {
  const allowed = new Set(ctx.priceItemNames);
  let causes = d.causes.map((c) => ({
    ...c,
    priceItem: c.priceItem && allowed.has(c.priceItem) ? c.priceItem : null,
    probability: Math.min(100, Math.max(0, Number.isFinite(c.probability) ? c.probability : 0)),
  }));
  const total = causes.reduce((s, c) => s + c.probability, 0);
  const scale = total > 100 ? 100 / total : 1;
  causes = causes
    .map((c) => ({ ...c, probability: scale < 1 ? Math.floor(c.probability * scale) : Math.round(c.probability) }))
    .sort((a, b) => b.probability - a.probability);

  const known = new Set(ctx.knownCodes);
  const unknownCodes = ctx.jobCodes.filter((c) => !known.has(c));

  const safetyWarnings = [...d.safetyWarnings];
  if (safetyWarnings.length === 0 && causes.some((c) => BATTERY_RE.test(c.title))) {
    safetyWarnings.push(BATTERY_WARNING);
  }
  return { ...d, causes, unknownCodes, safetyWarnings };
}

function section(title: string, lines: string[], empty: string): string {
  return [`## ${title}`, ...(lines.length ? lines : [empty])].join("\n");
}

export function buildTeshisPrompt(job: ParsedJob, ctx: TeshisContext): string {
  return [
    section("Scooter", [
      `Marka: ${job.brand ?? "bilinmiyor"}`,
      `Model: ${job.model ?? "bilinmiyor"}`,
      `Ekrandaki hata kodları: ${job.errorCodes.length ? job.errorCodes.join(", ") : "yok / belirtilmedi"}`,
    ], ""),
    section("Belirtiler", job.symptoms.map((s) => `- ${s}`), "- belirtilmedi"),
    section("Ustanın ölçümleri", ctx.measurements.map((m) => `- ${m}`), "- henüz ölçüm yok"),
    section(
      "Hata kodu tablosu",
      ctx.errorCodes.map(
        (e) =>
          `- ${e.brand}${e.modelFamily ? ` (${e.modelFamily})` : ""} ${e.code}: ${e.meaning}` +
          (e.causes.length ? ` | olası nedenler: ${e.causes.join(", ")}` : "") +
          (e.verified ? "" : " [doğrulanmamış]"),
      ),
      "- bu kodlar için tabloda kayıt yok",
    ),
    section(
      "Atölyenin geçmiş tamirleri (benzer vakalar)",
      ctx.similar.map(
        (s) =>
          `- ${s.brand ?? "?"} ${s.model ?? ""} | belirtiler: ${s.symptoms.join(", ")} | gerçek arıza: ${s.actualFault} | yapılan: ${s.actions.join(", ")}`,
      ),
      "- henüz benzer kayıt yok",
    ),
    section("Fiyat listesindeki iş kalemleri", ctx.priceItemNames.map((n) => `- ${n}`), "- liste boş"),
  ].join("\n\n");
}

/** Teşhis ajanı: olası arızaları, kontrol sırasını ve soruları çıkarır. */
export async function teshisEt(job: ParsedJob, ctx: TeshisContext, llm: LlmCall): Promise<Diagnosis> {
  const raw = await llm({
    schema: DiagnosisSchema,
    system: TESHIS_SYSTEM,
    user: buildTeshisPrompt(job, ctx),
    effort: "high",
  });
  return sanitizeDiagnosis(raw, {
    priceItemNames: ctx.priceItemNames,
    jobCodes: job.errorCodes,
    knownCodes: ctx.errorCodes.map((e) => e.code),
  });
}
