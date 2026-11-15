import { RepairRecordDraftSchema, type ParsedJob, type RepairRecordDraft } from "@scoot/shared";
import type { LlmCall } from "./llm";

export const ARSIVCI_SYSTEM = `Sen bir elektrikli scooter atölyesinin tamir arşivi asistanısın.
Görevin: iş bittiğinde ustanın yazdığı veya söylediği kısa notu, ileride benzer arızalarda kullanılacak düzenli bir kayda çevirmek.

Kurallar:
- Notta olmayan bilgiyi EKLEME.
- actualFault: gerçekte bulunan arıza, kısa ve teknik (örn. "Kontrol kartında Q5 MOSFET kısa devre").
- actions: yapılan işlemler, kısa maddeler.
- partsReplaced: değiştirilen parçalar; yoksa boş liste.`;

/** Arşivci ajan: ustanın kapanış notunu yapılandırılmış tamir kaydına çevirir. */
export async function arsivle(input: { job: ParsedJob; note: string }, llm: LlmCall): Promise<RepairRecordDraft> {
  const user = [
    `Scooter: ${[input.job.brand, input.job.model].filter(Boolean).join(" ") || "belirtilmedi"}`,
    `İlk şikâyet: ${input.job.symptoms.join("; ") || "belirtilmedi"}`,
    "",
    "Ustanın notu:",
    "<<<",
    input.note,
    ">>>",
  ].join("\n");
  return llm({ schema: RepairRecordDraftSchema, system: ARSIVCI_SYSTEM, user, effort: "low" });
}
