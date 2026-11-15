import { normalizeBrand, normalizeErrorCode, ParsedJobSchema, type ParsedJob } from "@scoot/shared";
import type { LlmCall } from "./llm";

export const TOPARLAYICI_SYSTEM = `Sen bir elektrikli scooter tamir atölyesinin kayıt asistanısın.
Görevin: müşteriden gelen dağınık mesajı (WhatsApp yazısı, sesli notun dökümü veya ustanın kısa notu) yapılandırılmış bir iş kaydına çevirmek.

Kurallar:
- Metinde açıkça geçmeyen bilgiyi UYDURMA. Bilinmeyen alanları null veya boş liste bırak.
- brand: scooter markası (örn. Ducati, Xiaomi, Segway, Ninebot, Dualtron, Onvo). model: model adı (örn. "Pro 2", "Max G30").
- errorCodes: ekranda görünen hata kodları, yazıldığı gibi (örn. "E10", "hata 21").
- symptoms: arıza belirtilerini kısa, sade Türkçe maddeler olarak yaz (örn. "gaz verince tepki yok", "şarj %100 olmuyor").
- customerName / customerPhone: yalnızca metinde varsa.
- missingInfo: teşhis için önemli olup metinde olmayan bilgiler (örn. "model bilgisi", "hata kodu var mı", "düşme/su teması oldu mu").`;

export type RawIntake = {
  rawText: string;
  brandHint?: string | null;
  modelHint?: string | null;
  errorCodeHint?: string | null;
};

function uniq(list: string[]): string[] {
  return [...new Set(list)];
}

/** Toparlayıcı ajan: dağınık şikâyet metnini yapılandırılmış iş kaydına çevirir. */
export async function toparla(input: RawIntake, llm: LlmCall): Promise<ParsedJob> {
  const hints = [
    input.brandHint ? `Formda seçilen marka: ${input.brandHint}` : null,
    input.modelHint ? `Formda yazılan model: ${input.modelHint}` : null,
    input.errorCodeHint ? `Formda yazılan hata kodu: ${input.errorCodeHint}` : null,
  ].filter(Boolean);

  const user = [
    "Müşteri / usta metni:",
    "<<<",
    input.rawText,
    ">>>",
    ...(hints.length ? ["", ...hints] : []),
  ].join("\n");

  const parsed = await llm({ schema: ParsedJobSchema, system: TOPARLAYICI_SYSTEM, user, effort: "low" });

  const brandText = input.brandHint || parsed.brand;
  const known = normalizeBrand(brandText);
  const codes = [input.errorCodeHint ?? null, ...parsed.errorCodes]
    .filter((c): c is string => !!c)
    .map(normalizeErrorCode)
    .filter((c): c is string => c !== null);

  return {
    ...parsed,
    brand: known.brand ?? (brandText?.trim() || null),
    model: input.modelHint || parsed.model,
    errorCodes: uniq(codes),
  };
}
