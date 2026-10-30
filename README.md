# ECU Yazılım Atölyesi – Web Sitesi

ECU programlama / tamiri ile elektrikli scooter ve bisiklet batarya / BMS onarımı için tanıtım sitesi.

Sitede neler var:

- Hizmetler, scooter batarya onarımı bölümü ve iletişim bilgileri
- **Batarya ön teşhis formu:** Müşterinin bilgilerini hazır bir WhatsApp mesajı olarak gönderir.
- **Yapay zekâ asistanı:** Sağ alttaki düğmeyle açılır. Müşteriyle konuşup arızayı anlar, fotoğrafları değerlendirir, olası sebepleri anlatır ve konuşmanın özetini tek tıkla WhatsApp'tan teknisyene iletir. **Fiyat vermez.**

## Neyi nereden değiştiririm?

| Ne | Dosya |
|---|---|
| Sayfa yazıları, hizmetler, iletişim bilgileri | `app/page.jsx` |
| WhatsApp numarası | `app/page.jsx` içindeki `WHATSAPP_NUMBER` |
| Asistanın talimatları (nasıl konuşacağı, neleri bileceği) | `app/api/chat/route.js` içindeki `SYSTEM_PROMPT` |
| Sohbet sınırları (mesaj, fotoğraf sayısı) | `lib/chat-limits.js` |
| Sohbet penceresinin görünümü | `components/ChatAssistant.jsx` |
| Logo | `public/logo.png` (şu an geçici, kendi logonuzla değiştirin) |

## Yayına alma (Vercel)

1. [vercel.com](https://vercel.com) adresine GitHub hesabınızla girin.
2. **Add New → Project** deyip bu depoyu seçin.
3. **Environment Variables** bölümüne `ANTHROPIC_API_KEY` ekleyin (aşağıya bakın).
4. **Deploy** düğmesine basın.

### Claude API anahtarı

1. [platform.claude.com](https://platform.claude.com) adresinde hesap açın ve ödeme yöntemi ekleyin.
2. **API Keys** bölümünden yeni bir anahtar oluşturun.
3. Sürpriz fatura olmaması için **aylık harcama limiti** koyun.

Anahtarı kimseyle paylaşmayın ve koda yazmayın; sadece Vercel'deki ortam değişkenine girin.

### Model ve maliyet

Asistan varsayılan olarak `claude-opus-5-5` modelini kullanır. Maliyeti düşürmek isterseniz Vercel'de `ANTHROPIC_MODEL=claude-haiku-5-5` ortam değişkenini ekleyin. Bu model çok daha ucuzdur ama cevap kalitesi biraz düşebilir.

## Bilgisayarda çalıştırma (geliştirme için)

```bash
npm install
cp .env.example .env.local   # sonra .env.local içine API anahtarını yazın
npm run dev
```

Ardından tarayıcıda http://localhost:3000 adresini açın.

## Güvenlik notları

- Asistan aynı IP'den 10 dakikada en fazla 40 istek kabul eder. Bu kaba bir korumadır; asıl güvence API hesabındaki harcama limitidir.
- Claude'un güvenlik filtresi bir isteği reddederse sistem isteği otomatik olarak uygun bir yedek modelle tekrar dener (`fallbacks: "default"` ayarı).
