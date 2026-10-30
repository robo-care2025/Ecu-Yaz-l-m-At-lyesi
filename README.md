# ECU Yazılım Atölyesi – Web Sitesi

ECU programlama / tamiri ile elektrikli scooter ve bisiklet batarya / BMS onarımı için tanıtım sitesi.

Sitede neler var:

- Hizmetler, scooter batarya onarımı bölümü ve iletişim bilgileri
- **Batarya ön teşhis formu ve iletişim formu:** Müşterinin bilgilerini hazır bir WhatsApp mesajı olarak gönderir.
- **Yapay zekâ asistanı (şu an kapalı):** Açıldığında sağ alttaki düğmeyle görünür. Müşteriyle konuşup arızayı anlar, fotoğrafları değerlendirir, olası sebepleri anlatır ve konuşmanın özetini tek tıkla WhatsApp'tan teknisyene iletir. **Fiyat vermez.** Kullanım başına ücretli olduğu için varsayılan olarak kapalıdır.

## Neyi nereden değiştiririm?

| Ne | Dosya |
|---|---|
| Sayfa yazıları, hizmetler, iletişim bilgileri | `app/page.jsx` |
| WhatsApp numarası | `app/page.jsx` içindeki `WHATSAPP_NUMBER` |
| Asistanın talimatları (nasıl konuşacağı, neleri bileceği) | `app/api/chat/route.js` içindeki `SYSTEM_PROMPT` |
| Sohbet sınırları (mesaj, fotoğraf sayısı) | `lib/chat-limits.js` |
| Sohbet penceresinin görünümü | `components/ChatAssistant.jsx` |
| Logo | `public/logo.png` (şu an geçici, kendi logonuzla değiştirin) |

## Ücretsiz yayına alma (Cloudflare Pages)

Asistan kapalıyken site, sunucu gerektirmeyen statik dosyalardan oluşur (`npm run build` komutu `out/` klasörünü üretir). Bu hâliyle Cloudflare Pages'in ücretsiz planında yayınlanabilir: trafik limiti yoktur ve adres `proje-adi.pages.dev` şeklindedir. Kendi alan adınızı (örneğin `.com`) bağlamak isteğe bağlıdır ve alan adı ücretlidir.

1. [dash.cloudflare.com](https://dash.cloudflare.com) adresinde ücretsiz hesap açın.
2. **Workers & Pages → Create → Pages → Connect to Git** yolunu izleyin, GitHub hesabınızı bağlayıp bu depoyu seçin.
3. **Production branch** olarak sitenin güncel hâlinin bulunduğu dalı seçin.
4. Derleme ayarları:
   - **Framework preset:** Next.js (Static HTML Export)
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
5. **Save and Deploy** düğmesine basın. Birkaç dakika sonra site yayında olur. Bu dala gönderilen her değişiklik siteyi otomatik günceller.

Menü adları Cloudflare panelinde zamanla biraz değişebilir.

> Not: Vercel'in ücretsiz (Hobby) planı yalnızca kişisel, ticari olmayan kullanıma izin verir. Bir işletmenin sitesi ticari sayıldığı için Vercel'de Pro plan gerekir.

## Yapay zekâ asistanını açma (ücretli)

Asistan açıkken site sunucu tarafı ve Claude API anahtarı gerektirir, yani statik barındırmada çalışmaz.

1. Sunucu çalıştırabilen bir barındırma seçin (örneğin Vercel Pro).
2. Ortam değişkenlerine `NEXT_PUBLIC_ASSISTANT_ENABLED=true` ve `ANTHROPIC_API_KEY` ekleyin.
3. Siteyi yeniden yayınlayın.

### Claude API anahtarı

1. [platform.claude.com](https://platform.claude.com) adresinde hesap açın ve ödeme yöntemi ekleyin.
2. **API Keys** bölümünden yeni bir anahtar oluşturun.
3. Sürpriz fatura olmaması için **aylık harcama limiti** koyun.

Anahtarı kimseyle paylaşmayın ve koda yazmayın; sadece barındırma hizmetindeki ortam değişkenine girin.

### Model ve maliyet

Asistan varsayılan olarak `claude-opus-5-5` modelini kullanır. Maliyeti düşürmek isterseniz `ANTHROPIC_MODEL=claude-haiku-5-5` ortam değişkenini ekleyin. Bu model çok daha ucuzdur ama cevap kalitesi biraz düşebilir.

## Bilgisayarda çalıştırma (geliştirme için)

```bash
npm install
npm run dev
```

Ardından tarayıcıda http://localhost:3000 adresini açın. Asistanı denemek için `.env.example` dosyasını `.env.local` adıyla kopyalayıp içine `NEXT_PUBLIC_ASSISTANT_ENABLED=true` ve API anahtarını yazın.

## Güvenlik notları

- Asistan aynı IP'den 10 dakikada en fazla 40 istek kabul eder. Bu kaba bir korumadır; asıl güvence API hesabındaki harcama limitidir.
- Claude'un güvenlik filtresi bir isteği reddederse sistem isteği otomatik olarak uygun bir yedek modelle tekrar dener (`fallbacks: "default"` ayarı).
