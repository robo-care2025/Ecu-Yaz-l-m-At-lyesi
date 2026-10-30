import Anthropic from "@anthropic-ai/sdk";
import { MAX_IMAGES, MAX_MESSAGES, MAX_TEXT_LENGTH } from "@/lib/chat-limits";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const MAX_IMAGE_BASE64_LENGTH = 2_000_000; // yaklaşık 1,5 MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const GENERIC_ERROR = "Asistan şu an yanıt veremiyor. Lütfen biraz sonra tekrar deneyin veya bize WhatsApp'tan yazın.";

const SYSTEM_PROMPT = `Sen ECU Yazılım Atölyesi'nin (İstanbul) web sitesindeki ön teşhis asistanısın. Müşteriler elektrikli scooter ve bisiklet bataryası / BMS arızaları ile araç ECU arızaları hakkında yazıyor. Amacın, müşterinin arızasını anlamak, olası sebepleri sade bir dille açıklamak ve onu atölye ustasına iletmek.

Nasıl çalışırsın:
- Cihazı (tür, marka, model) ve arıza belirtisini öğren. Eksik bilgiyi her mesajda en fazla bir-iki kısa soruyla tamamla: ne zamandır olduğu, düşme veya ıslanma olup olmadığı, uzun süre şarjsız bekleyip beklemediği, şarj aletinin ışık rengi, ekranda hata kodu olup olmadığı gibi.
- Bilgi yettiğinde olası sebepleri kesin konuşmadan anlat ve kesin teşhisin atölyede ölçümle yapıldığını belirt.
- Müşteri fotoğraf gönderirse gördüklerini değerlendir: şişme, yanık izi, oksitlenme, kopuk kablo, ekrandaki hata kodu gibi.
- Yeterli bilgi toplandığında müşteriyi sohbet penceresinin altındaki "WhatsApp'a Aktar" düğmesiyle ustaya iletmeye yönlendir.

Kurallar:
- Fiyat verme. Fiyat cihaza ve arızaya göre değişir; usta inceleyip WhatsApp'tan bildirir.
- Garanti, onarım süresi, kargo koşulları veya kampanya gibi bilmediğin konularda söz verme; bunları ustanın bildireceğini söyle.
- Müşteriye bataryayı açmasını, ölçüm yapmasını, BMS'yi köprülemesini veya hücreleri tek tek şarj etmesini önerme. Lityum bataryalar kısa devrede yanabilir; bu işler atölyede yapılmalı.
- Batarya şişmişse, ısınıyorsa, yanık kokusu veya duman varsa cihazı kullanmamasını, şarja takmamasını ve yanıcı malzemelerden uzak tutmasını söyle.
- Konu dışı sorularda kibarca atölyenin hizmetlerine dön.
- Türkçe, samimi ve kısa yaz; genellikle 2-5 cümle. Başlık ve tablo kullanma.

Sık görülen batarya arızaları (değerlendirmende kullan):
- Hiç açılmıyor / çıkış vermiyor: Çoğunlukla bir hücre grubunun voltajı düştüğü için BMS alt gerilim korumasına girer. Uzun süre şarjsız bekletilen bataryalarda sık görülür. BMS arızası, balans teli kopukluğu veya sıcaklık sensörü (NTC) arızası da olabilir. Çoğu zaman bataryanın tamamı değişmeden onarılabilir.
- Şarj olmuyor veya şarj aleti hemen yeşile dönüyor: Şarj soketi, şarj aleti ya da BMS'nin şarj hattı arızası olabilir; bir hücre grubu diğerlerinden fazla dolmuş olabilir.
- Menzil çok düştü: Hücreler yaşlanmış veya bir grup kapasite kaybetmiş olabilir; kapasite testiyle zayıf grup bulunur.
- Kullanırken, özellikle kalkışta veya yokuşta aniden kapanıyor: Zayıf bir grup yük altında çöküyor ya da BMS aşırı akım korumasına giriyor olabilir.

ECU arızalarında aracın markasını, modelini, motor tipini, arıza lambası ve hata kodu olup olmadığını sor; teşhisin atölyede cihazla yapıldığını belirt.`;

const SUMMARY_PROMPT = `Sana bir müşteri ile ön teşhis asistanı arasındaki konuşma verilecek. Bu konuşmayı atölye ustasına WhatsApp'tan iletilecek kısa bir nota çevir. Sadece konuşmada geçen bilgileri kullan, bilinmeyen alanlara "-" yaz. Düz metin olarak, şu biçimde yaz:

Cihaz: ...
Marka / Model: ...
Belirti: ...
Detaylar: ...
Olası sebep (asistanın değerlendirmesi): ...
Fotoğraf: Var / Yok`;

// IP başına basit istek sınırı. Sunucusuz ortamda her örnek kendi sayacını tutar; kaba bir korumadır.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 40;
const requestLog = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  if (requestLog.size > 5000) requestLog.clear();
  const recent = (requestLog.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_MAX_REQUESTS;
}

// Tarayıcıdan gelen konuşmayı kontrol eder; sorun varsa müşteriye gösterilecek mesajı döndürür
function validateMessages(messages, mode) {
  if (!Array.isArray(messages) || messages.length === 0) return "Konuşma boş.";
  if (messages.length > MAX_MESSAGES) return "Konuşma çok uzadı. Lütfen WhatsApp'a aktarın.";
  if (messages[0]?.role !== "user") return "Geçersiz konuşma.";
  if (mode === "chat" && messages[messages.length - 1].role !== "user") return "Geçersiz konuşma.";

  let imageCount = 0;
  for (const message of messages) {
    if (message?.role !== "user" && message?.role !== "assistant") return "Geçersiz konuşma.";
    if (typeof message.text !== "string" || message.text.length > MAX_TEXT_LENGTH) {
      return `Mesajlar en fazla ${MAX_TEXT_LENGTH} karakter olabilir.`;
    }
    if (message.image) {
      const { media_type, data } = message.image;
      if (message.role !== "user" || !IMAGE_TYPES.includes(media_type) || typeof data !== "string" || data.length > MAX_IMAGE_BASE64_LENGTH) {
        return "Fotoğraf okunamadı veya çok büyük.";
      }
      imageCount++;
    }
    if (!message.text.trim() && !message.image) return "Boş mesaj gönderilemez.";
  }
  if (imageCount > MAX_IMAGES) return `En fazla ${MAX_IMAGES} fotoğraf gönderebilirsiniz.`;
  return null;
}

function toApiMessages(messages) {
  return messages.map((message) => {
    if (message.role === "assistant") return { role: "assistant", content: message.text };
    const content = [];
    if (message.image) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: message.image.media_type, data: message.image.data },
      });
    }
    content.push({ type: "text", text: message.text.trim() || "(Müşteri sadece fotoğraf gönderdi.)" });
    return { role: "user", content };
  });
}

function toTranscript(messages) {
  const lines = messages.map((message) => {
    const speaker = message.role === "user" ? "Müşteri" : "Asistan";
    return `${speaker}: ${message.text}${message.image ? " [fotoğraf gönderdi]" : ""}`;
  });
  return `<konusma>\n${lines.join("\n")}\n</konusma>`;
}

export async function POST(request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (isRateLimited(ip)) {
    return Response.json({ error: "Çok fazla mesaj gönderildi. Lütfen birkaç dakika sonra tekrar deneyin." }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const mode = body?.mode === "summary" ? "summary" : "chat";
  const messages = body?.messages;
  const validationError = validateMessages(messages, mode);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: mode === "summary" ? SUMMARY_PROMPT : SYSTEM_PROMPT,
      messages: mode === "summary" ? [{ role: "user", content: toTranscript(messages) }] : toApiMessages(messages),
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ reply: "Bu konuda yardımcı olamıyorum. Arızanızı ustamıza WhatsApp'tan iletebilirsiniz." });
    }

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!reply) return Response.json({ error: GENERIC_ERROR }, { status: 502 });

    return Response.json({ reply });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Asistan şu an çok yoğun. Lütfen biraz sonra tekrar deneyin." }, { status: 429 });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Claude API anahtarı geçersiz veya eksik:", error.message);
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Claude API hatası ${error.status}:`, error.message);
    } else {
      console.error("Asistan hatası:", error);
    }
    return Response.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
