"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ChatAssistant from "@/components/ChatAssistant";
import Image from "next/image";

const WHATSAPP_NUMBER = "905356471111";

// Ön teşhis formunda seçilen belirtiye göre müşteriye gösterilen olası sebepler
const SYMPTOMS = {
  "Hiç açılmıyor / çıkış vermiyor":
    "En sık sebep, bir hücre grubunun voltajı düştüğü için BMS'nin koruma moduna girmesidir. BMS arızası veya bağlantı kopukluğu da olabilir. Çoğu durumda bataryanın tamamını değiştirmeden onarılabilir.",
  "Şarj olmuyor":
    "Şarj hattı veya BMS'nin şarj koruması, şarj soketi ya da şarj cihazı arızası olabilir.",
  "Menzil çok düştü":
    "Hücrelerin yaşlanması veya bir hücre grubunun kapasite kaybetmesi. Kapasite testi ile zayıf grup tespit edilip değiştirilebilir.",
  "Kullanırken aniden kapanıyor":
    "Zayıf bir hücre grubunun yük altında voltajının düşmesi veya BMS'nin aşırı akım koruması devreye giriyor olabilir.",
  "Diğer": "Arızayı açıklama kısmında anlatın, size en kısa sürede dönüş yapalım.",
};

export default function HomePage() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    device: "",
    model: "",
    symptom: "",
    details: "",
  });
  const [chatOpen, setChatOpen] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  // Form bilgilerini hazır bir WhatsApp mesajına çevirip açar
  const handleDiagnosisSubmit = (e) => {
    e.preventDefault();
    const message = [
      "Merhaba, batarya ön teşhis talebim var.",
      `İsim: ${form.name}`,
      `Telefon: ${form.phone}`,
      `Şehir: ${form.city || "-"}`,
      `Cihaz: ${form.device}`,
      `Marka / Model: ${form.model || "-"}`,
      `Belirti: ${form.symptom}`,
      `Açıklama: ${form.details || "-"}`,
    ].join("\n");
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="bg-black text-white min-h-screen font-sans">
      {/* Navbar */}
      <header className="p-6 flex justify-between items-center border-b border-gray-800">
        <div className="flex items-center space-x-4">
          <Image src="/logo.png" alt="ECU Yazılım Atölyesi Logo" width={40} height={40} />
          <h1 className="text-2xl font-bold text-orange-500">ECU Yazılım Atölyesi</h1>
        </div>
        <nav className="space-x-6">
          <a href="#" className="hover:text-orange-400">Ana Sayfa</a>
          <a href="#hakkimizda" className="hover:text-orange-400">Hakkımızda</a>
          <a href="#hizmetler" className="hover:text-orange-400">Hizmetler</a>
          <a href="#scooter" className="hover:text-orange-400">Scooter Batarya</a>
          <a href="#iletisim" className="hover:text-orange-400">İletişim</a>
          <a href="#" className="hover:text-orange-400">EN</a>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="px-8 py-24 text-center bg-gradient-to-br from-gray-900 to-black">
        <h2 className="text-4xl md:text-5xl font-extrabold mb-4">ECU PROGRAMLAMA VE TAMİRİ</h2>
        <p className="text-lg mb-2 text-gray-300">ECU yazılımı konusunda uzman hizmetler sunuyoruz.</p>
        <p className="text-lg mb-6 text-gray-300">Elektrikli scooter ve bisiklet batarya / BMS onarımı da yapıyoruz.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button className="bg-orange-500 text-white px-6 py-2 rounded-full hover:bg-orange-600">Bize Ulaşın</Button>
          <Button asChild className="bg-transparent border border-orange-500 text-orange-400 px-6 py-2 rounded-full hover:bg-orange-500 hover:text-white">
            <a href="#on-teshis">Batarya Ön Teşhis</a>
          </Button>
        </div>
      </section>

      {/* Hakkımızda */}
      <section id="hakkimizda" className="px-8 py-16 bg-gray-900">
        <h3 className="text-3xl font-bold mb-4">Hakkımızda</h3>
        <p className="text-gray-300 max-w-3xl">
          ECU Yazılım Atölyesi olarak, her türlü motor kontrol ünitesi (ECU) programlama ve onarımı konularında geniş kapsamlı hizmetler sunmaktayız. Deneyimli ekibimizle, araçlarınızın performansını en iyi seviyeye çıkarmak için buradayız.
        </p>
      </section>

      {/* Hizmetler */}
      <section id="hizmetler" className="px-8 py-16 bg-black">
        <h3 className="text-3xl font-bold mb-8">Hizmetler</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-4">
              <h4 className="text-xl font-semibold mb-2">ECU Yazılım Güncelleme</h4>
              <p>Optimize edilmiş, güvenilir ve güncel yazılımlarla ECU'nuzu en iyi hale getirin.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h4 className="text-xl font-semibold mb-2">Arıza Tespiti ve Onarım</h4>
              <p>Uzman analiz ve kaliteli onarım hizmeti ile ECU arızalarına çözüm.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h4 className="text-xl font-semibold mb-2">Özelleştirilmiş Çözümler</h4>
              <p>Araçlarınıza özel performans ve çözüm odaklı ECU yazılım hizmetleri.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h4 className="text-xl font-semibold mb-2">Scooter Batarya ve BMS Onarımı</h4>
              <p>Hücre grubu değişimi, BMS onarımı ve kapasite testi ile bataryanızı yenisini almadan kurtarın.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Scooter Batarya ve BMS Onarımı */}
      <section id="scooter" className="px-8 py-16 bg-gray-900">
        <h3 className="text-3xl font-bold mb-4">Scooter Batarya ve BMS Onarımı</h3>
        <p className="text-gray-300 max-w-3xl mb-8">
          Elektrikli scooter veya bisiklet bataryanız çalışmıyorsa yenisini almadan önce bize danışın. Arızaların çoğu tek bir hücre grubundan, balans hattından veya BMS kartından kaynaklanır ve bataryanın tamamını değiştirmeden onarılabilir.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardContent className="p-4">
              <h4 className="text-xl font-semibold mb-2">Hücre Grubu Değişimi</h4>
              <p>Voltajı düşen veya kapasitesi biten hücre grubu, eşleştirilmiş yeni hücrelerle punta kaynağı yapılarak değiştirilir.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h4 className="text-xl font-semibold mb-2">BMS Onarımı ve Değişimi</h4>
              <p>Koruma kartı ölçümlerle test edilir; arızalı MOSFET, şönt ve bağlantılar onarılır ya da uyumlu BMS takılır.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h4 className="text-xl font-semibold mb-2">Balans Hattı ve Bağlantı Onarımı</h4>
              <p>Kopan balans telleri, soğuk lehimler ve oksitlenmiş soketler yenilenir.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h4 className="text-xl font-semibold mb-2">Kapasite ve Yük Testi</h4>
              <p>Onarım sonrası her grup ölçülür, batarya yük altında test edilerek teslim edilir.</p>
            </CardContent>
          </Card>
        </div>

        <h4 className="text-2xl font-semibold mb-6">Nasıl Çalışıyoruz?</h4>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            ["1", "Arızayı bize anlatın", "Ön teşhis formunu doldurun veya yapay zekâ asistanımızla konuşun."],
            ["2", "Fiyat bilgisi alın", "WhatsApp üzerinden size tahmini fiyat ve süre bildirelim."],
            ["3", "Bataryanızı gönderin", "İstanbul içinden elden ya da kargoyla. Gönderim koşullarını WhatsApp'tan öğrenebilirsiniz."],
            ["4", "Test edilmiş bataryanızı teslim alın", "Onarım sonrası ölçüm ve yük testlerinden geçen bataryanız size ulaşır."],
          ].map(([step, title, text]) => (
            <div key={step} className="p-4 rounded border border-gray-800">
              <span className="text-3xl font-extrabold text-orange-500">{step}</span>
              <h5 className="text-lg font-semibold mt-2 mb-1">{title}</h5>
              <p className="text-gray-400">{text}</p>
            </div>
          ))}
        </div>

        <p className="text-gray-400 text-sm mt-8">
          ⚠️ Lityum bataryaları kendiniz açmaya çalışmayın. Kısa devre yangına ve ciddi yaralanmalara yol açabilir.
        </p>
      </section>

      {/* Batarya Ön Teşhis Formu */}
      <section id="on-teshis" className="px-8 py-16 bg-black">
        <h3 className="text-3xl font-bold mb-4">Batarya Ön Teşhis</h3>
        <p className="text-gray-300 max-w-3xl mb-8">
          Formu doldurun, bilgileriniz hazır bir WhatsApp mesajı olarak bize ulaşsın. Arızalı bataryanın ve varsa ekranındaki hata kodunun fotoğraflarını aynı sohbete ekleyebilirsiniz.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <form className="space-y-4" onSubmit={handleDiagnosisSubmit}>
            <Input placeholder="İsim" value={form.name} onChange={update("name")} required />
            <Input type="tel" placeholder="Telefon (WhatsApp)" value={form.phone} onChange={update("phone")} required />
            <Input placeholder="Şehir" value={form.city} onChange={update("city")} />
            <select className="w-full p-2 rounded bg-gray-800 text-white" value={form.device} onChange={update("device")} required>
              <option value="" disabled>Cihaz türü</option>
              <option>Elektrikli Scooter</option>
              <option>Elektrikli Bisiklet</option>
              <option>Diğer</option>
            </select>
            <Input placeholder="Marka / Model (ör. Ducati Pro-I)" value={form.model} onChange={update("model")} />
            <select className="w-full p-2 rounded bg-gray-800 text-white" value={form.symptom} onChange={update("symptom")} required>
              <option value="" disabled>Arıza belirtisi</option>
              {Object.keys(SYMPTOMS).map((symptom) => (
                <option key={symptom}>{symptom}</option>
              ))}
            </select>
            <textarea
              className="w-full p-2 rounded bg-gray-800 text-white"
              placeholder="Arızayı kısaca anlatın (ne zamandır, düşme veya ıslanma oldu mu, son şarj ne zaman yapıldı...)"
              rows={4}
              value={form.details}
              onChange={update("details")}
            ></textarea>
            <Button type="submit" className="bg-orange-500 hover:bg-orange-600">WhatsApp ile Gönder</Button>
          </form>
          <div className="space-y-4">
            {form.symptom ? (
              <div className="p-4 rounded border border-orange-500 bg-gray-900">
                <p className="font-semibold text-orange-400 mb-2">Olası sebepler</p>
                <p className="text-gray-300">{SYMPTOMS[form.symptom]}</p>
                <p className="text-gray-500 text-sm mt-3">Kesin teşhis, atölyemizde hücre ve BMS ölçümleriyle yapılır.</p>
              </div>
            ) : (
              <div className="p-4 rounded border border-gray-800 text-gray-400">
                Arıza belirtisini seçtiğinizde olası sebepler burada görünecek.
              </div>
            )}
            <div className="p-4 rounded border border-gray-800">
              <p className="font-semibold mb-2">Yapay zekâ asistanına sorun</p>
              <p className="text-gray-400 mb-4">
                Arızayı yazın veya fotoğrafını gönderin. Asistanımız birkaç soruyla olası sebepleri anlatsın, sonra bilgileri tek tıkla ustamıza iletin.
              </p>
              <Button onClick={() => setChatOpen(true)} className="bg-orange-500 hover:bg-orange-600">Asistanla Konuş</Button>
            </div>
          </div>
        </div>
      </section>

      {/* İletişim */}
      <section id="iletisim" className="px-8 py-16 bg-gray-900">
        <h3 className="text-3xl font-bold mb-8">İletişim</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <form className="space-y-4">
            <Input placeholder="İsim" />
            <Input type="email" placeholder="E-posta" />
            <textarea className="w-full p-2 rounded bg-gray-800 text-white" placeholder="Mesaj" rows={5}></textarea>
            <Button className="bg-orange-500 hover:bg-orange-600">Gönder</Button>
          </form>
          <div className="text-gray-300 space-y-2">
            <p><strong>Adres:</strong> İstanbul, Türkiye</p>
            <p><strong>Telefon:</strong> +90 555 555 55 55</p>
            <p><strong>E-posta:</strong> info@ecuyazilimatolyesi.com</p>
            <p><strong>WhatsApp:</strong> <a className="text-orange-400" href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank">0535 647 11 11</a></p>
          </div>
        </div>
      </section>

      <footer className="p-4 text-center text-gray-500 text-sm border-t border-gray-800">
        © 2025 ECU Yazılım Atölyesi. Tüm hakları saklıdır.
      </footer>

      <ChatAssistant open={chatOpen} onOpenChange={setChatOpen} whatsappNumber={WHATSAPP_NUMBER} />
    </div>
  );
}
