// Yapay zekâ asistanı kapalıyken site sunucusuz, statik dosyalar olarak üretilir (out/ klasörü).
// Böylece ücretsiz statik barındırma hizmetlerinde yayınlanabilir.
// Statik modda sadece .jsx uzantılı dosyalar sayfa sayılır; bu sayede asistanın sunucu kodu
// (app/api/chat/route.js) derlemeye girmez. app/ altına eklenecek yeni sayfalar .jsx olmalı.
const assistantEnabled = process.env.NEXT_PUBLIC_ASSISTANT_ENABLED === "true";

/** @type {import('next').NextConfig} */
const nextConfig = assistantEnabled
  ? {}
  : {
      output: "export",
      images: { unoptimized: true },
      pageExtensions: ["jsx"],
    };

export default nextConfig;
