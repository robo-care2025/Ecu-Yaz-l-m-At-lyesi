# Scooter Arıza Asistanı — Tasarım Dokümanı

*Tarih: 2026-11-15 · Durum: Onay bekliyor · Çalışma adı: "Scootechnology" (kullanıcı önerisi; marka/alan adı kontrolü mağaza öncesi)*

## 1. Amaç ve neden

Atölye sahibi elektrikli scooter tamiri yapıyor. Müşteri ilk şikâyetiyle geldiğinde iki iş çok zaman alıyor:

1. **Arıza tespiti**: Şikâyetten yola çıkıp olası arızaları ve kontrol sırasını düşünmek.
2. **Müşteriye cevap**: Ne olduğunu, ne yapılacağını, tahmini fiyatı ve süreyi anlatan mesajı yazmak.

Bu programda birden fazla yapay zekâ **alt ajanı** bu iki işi ustanın yerine hazırlar. Kararı her zaman usta verir.

İlk kullanıcı ustanın kendi atölyesi. Programı ileride başka atölyelere satmak kesin bir hedef değil, ama bu yolun açık kalması isteniyor. Bu yüzden altyapı ilk günden "birden fazla atölye" mantığıyla kurulacak.

## 2. Hedefler

- Şikâyet girildikten sonra **bir dakikadan kısa sürede** şunlar hazır olur: olası arızalar (ihtimal sırasıyla), ölçüm ve kontrol sırası, müşteriye gönderilmeye hazır mesaj.
- Üç giriş yolu: **yazarak**, **sesli** (Türkçe), **WhatsApp mesajını yapıştırarak / paylaşarak**.
- Müşteri mesajındaki fiyat ve süre **ustanın kendi fiyat tablosundan** gelir.
- İş bittiğinde usta sonucu kısaca girer. Böylece **ustanın kendi tamir arşivi** oluşur ve teşhis ajanı bu arşivden yararlanır.
- **Profesyonel görünüm**: Android'de gerçek bir uygulama, bilgisayarda kendi alan adında girişli bir web paneli.

## 3. Hedef olmayanlar (bu sürümde yok)

- iPhone uygulaması ve mağaza yayını (ikinci aşama).
- Programın müşteriye **kendi başına** mesaj göndermesi. Mesajı her zaman usta gönderir.
- WhatsApp Business API entegrasyonu.
- Ödeme / abonelik sistemi ve başka atölyelere satış (altyapı buna hazır olacak, ama özellik yapılmayacak).
- Fatura, stok ve muhasebe.
- Fotoğraftan arıza analizi (ileride eklenebilir; mimari buna engel olmamalı).

## 4. Kesinlikle olmaması gerekenler

Teknik olarak çalışsa bile şunlar olursa program başarısız sayılır:

- **Uydurma fiyat**: Fiyat tablosunda karşılığı olmayan bir iş için yapay zekâ rakam yazarsa.
- **Uydurma hata kodu anlamı**: Bilinmeyen bir kodu "biliyormuş gibi" açıklarsa. Bilmiyorsa "bu kod tabloda yok" demeli.
- **Kendiliğinden müşteriye mesaj göndermek.**
- **API anahtarının uygulamanın içinde olması.** Anahtar sadece sunucuda durur.
- Müşteriye giden mesajda teknik jargon ya da kesin söz ("kesin şu bozuk") olması. Mesaj "ön değerlendirme" dilinde olmalı.
- Güvenlik açısından tehlikeli yönlendirme. Lityum batarya işlemlerinde teşhis çıktısı gerekli uyarıyı içermeli.

## 5. Kısıtlar

- **Kullanıcı yazılımcı değil, elektronik teknisyeni.** Kurulum ve bakım adımları adım adım, Türkçe anlatılmalı. Arayüz tamamen Türkçe.
- **Markalar**: Ducati (**en sık gelen, öncelikli**), Segway, Ninebot, Xiaomi, Onvo, Dualtron ve çeşitli başka markalar.
- **Mevcut kayıt yok.** Arşiv sıfırdan başlıyor.
- **Cihazlar**: Telefon (Android) ve bilgisayar. İkisi aynı veriyi görmeli.
- **Maliyet**: Barındırma küçük kullanımda ücretsiz katmanlarda kalmalı. Yapay zekâ ücreti kullanım başına; analiz başı maliyet düşük tutulmalı.
- **Kişisel veri (KVKK)**: Müşteri adı ve telefonu saklanacaksa bu ölçülü olmalı. Sadece iş takibi için gereken bilgi tutulur.

## 6. Değerlendirilen yaklaşımlar

| Yaklaşım | Artı | Eksi | Karar |
|---|---|---|---|
| **A) Android uygulaması + bilgisayar için web paneli + ortak sunucu** | Gerçek uygulama (mikrofon, paylaş menüsü); panel kurulum gerektirmez; satılabilir yazılım modeli | İki arayüz yapılır; mağaza ücretleri | ✅ **Seçildi** |
| B) Her platformda kurulan uygulama (telefon + Windows .exe) | Bilgisayarda da "program" hissi | Her bilgisayarda kurulum ve güncelleme; satışta engel | Elendi |
| C) Ana ekrana eklenen web sitesi (PWA) | En hızlı ve ucuz | Kullanıcı "özensiz" buldu, profesyonel değil | Elendi |
| D) Telegram botu | Uygulama açmadan kullanım | Fiyat tablosu ve arşiv yönetimi zahmetli; müşteriler WhatsApp'ta | Elendi |
| E) Sadece bilgisayar programı | Basit | Elde iş varken telefondan kullanılamaz | Elendi |

Kullanıcı **A**'yı seçti, **önce Android**.

## 7. Kullanıcının verdiği kararlar

- Program önce kendi atölyesi için yapılacak.
- Program hem teşhis yapacak hem müşteri cevabı hazırlayacak.
- Konu **elektrikli scooterlar** (otomobil değil).
- Giriş: yazı, ses, WhatsApp'tan kopyala-yapıştır.
- Telefon ve bilgisayar, ikisi de desteklenecek.
- Müşteri mesajında **fiyat ve süre** olacak. Kaynağı **ustanın düzenlediği fiyat tablosu**, marka grubuna göre.
- **Ducati** fiyat tablosunda ayrı grup ve seçim listelerinde en üstte.
- Profesyonel görünüm: gerçek Android uygulaması + web paneli. Ana ekran kısayolu yok.
- Yol: Yaklaşım A, önce Android.

## 8. Tasarım

### 8.1 Genel yapı

```
 ┌──────────────────┐        ┌──────────────────┐
 │ Android uygulama │        │ Web paneli       │
 │ (telefon)        │        │ (bilgisayar)     │
 └────────┬─────────┘        └────────┬─────────┘
          │  giriş yapmış kullanıcı   │
          └────────────┬──────────────┘
                       ▼
          ┌─────────────────────────────┐
          │ Sunucu (API)                │
          │  Yönetici → alt ajanlar     │──► Claude yapay zekâ
          └────────────┬────────────────┘
                       ▼
          ┌─────────────────────────────┐
          │ Veritabanı + giriş sistemi  │
          │ (işler, arşiv, fiyat,       │
          │  hata kodları)              │
          └─────────────────────────────┘
```

### 8.2 Alt ajanlar

Yönetici **kodla yazılmış bir akış**tır: hangi ajanın ne zaman çalışacağını program belirler. Bu daha öngörülebilir ve ucuzdur. Ajanların her biri tek bir işe odaklıdır.

| # | Ajan | Girdi | Çıktı |
|---|---|---|---|
| 1 | **Toparlayıcı** | Serbest metin (yazı, ses dökümü, WhatsApp mesajı) + formda seçilenler | Yapılandırılmış iş: marka, model, hata kodu(ları), belirtiler, müşteri adı/telefonu (varsa), eksik bilgiler |
| 2 | **Teşhis** | Yapılandırılmış iş + yönetici akışın çağrıdan önce bulup verdiği bağlam: ilgili hata kodu satırları, arşivden benzer vakalar, fiyat kalemi adları, ölçümler (araç döngüsü yok: daha öngörülebilir ve ucuz) | Olası arızalar (ihtimal yüzdesiyle, gerekçesiyle), ölçüm/kontrol sırası (beklenen değerlerle), ustaya sorulacak ek sorular, güvenlik uyarıları |
| 3 | **Fiyat eşleştirici** | Teşhisteki iş kalemleri + fiyat tablosu | Eşleşen fiyat aralığı ve süre; eşleşme yoksa "fiyat yok" işareti. **Bu adım yapay zekâ değil, düz koddur** (uydurma fiyatı önlemek için). Kalemleri eşleştirmek için teşhis ajanı fiyat tablosundaki iş adlarından seçim yapar. |
| 4 | **Cevap** | Teşhis + fiyat sonucu + atölye bilgileri | Müşteriye sade Türkçe mesaj (ön değerlendirme dili, fiyat/süre varsa dahil, yoksa "inceleme sonrası bildirilecek") |
| 5 | **Arşivci** | İş sonunda ustanın kısa notu (yazı veya ses) + gerçek fiyat/süre | Yapılandırılmış tamir kaydı (gerçek arıza, yapılan işlem, değişen parça); fiyat tablosundan çok farklıysa güncelleme önerisi |

**Akış:**
`Toparlayıcı → (eksik kritik bilgi varsa ustaya sor) → Teşhis → Fiyat eşleştirici → Cevap → ustanın onayı`

Usta teşhis sonucuna yeni ölçüm değeri eklerse ("batarya 36V çıktı") teşhis yeniden çalıştırılabilir.

### 8.3 Ekranlar

**Android uygulaması**
1. **Giriş**
2. **İşler listesi**: açık işler en üstte, durum etiketiyle (Analiz edildi / Müşteriye yazıldı / Tamirde / Bitti).
3. **Yeni iş**: marka seçimi (Ducati en üstte), model, hata kodu (opsiyonel), şikâyet kutusu. 🎤 Sesli giriş, 📋 Yapıştır. **"Analiz Et"** düğmesi.
4. **İş detayı**: olası arızalar, kontrol sırası, müşteri mesajı (düzenlenebilir), **Kopyala** ve **WhatsApp'ta aç** düğmeleri, ölçüm değeri ekleyip yeniden analiz.
5. **İşi kapat**: "Sorun neydi, nasıl çözdün?" (yazı/ses) + gerçek fiyat ve süre.
6. **Paylaşım hedefi**: WhatsApp'ta bir mesaja uzun basıp *Paylaş → Uygulama* denince "Yeni iş" ekranı, metin dolu olarak açılır.

**Web paneli** (aynı hesapla)
- İşler ve arşiv (arama ve filtre: marka, model, arıza tipi).
- **Fiyat listesi** düzenleme: iş × marka grubu → fiyat aralığı, süre.
- **Marka grupları** ve **hata kodu tablosu** düzenleme.
- Atölye ayarları: atölye adı, telefon, mesaj imzası, hitap şekli.
- Yeni iş açma ve analiz (telefondakiyle aynı).

### 8.4 Veri (ana tablolar)

- `workshops`: atölye (ad, telefon, mesaj imzası). Satışa hazırlık için her kayıt bir atölyeye bağlıdır.
- `users`: atölyeye bağlı kullanıcılar (ilk sürümde tek kullanıcı, ama yapı çoklu kullanıcıyı destekler).
- `brands` → `brand_groups`: Örnek gruplar: **Ducati**, Xiaomi / Segway-Ninebot, Dualtron / yüksek voltaj, Diğer. Marka hangi gruptaysa fiyat o gruptan gelir.
- `price_items`: iş adı, marka grubu, min fiyat, max fiyat, süre. Önce markaya özel satır, yoksa "Diğer" grubu kullanılır.
- `error_codes`: marka/model ailesi, kod, anlam, olası nedenler, kaynak, **doğrulandı mı**.
- `jobs`: iş (marka, model, şikâyet ham metni, yapılandırılmış hali, müşteri adı/telefonu, durum).
- `job_analyses`: her analiz çalışmasının çıktısı (teşhis, eşleşen fiyat, mesaj taslağı).
- `repair_records`: kapanış kaydı (gerçek arıza, işlem, parça, gerçek fiyat ve süre). Teşhis ajanının "benzer vaka" aramasının kaynağı.

Her tabloda satır düzeyinde güvenlik olur: bir atölye sadece kendi verisini görür.

### 8.5 Başlangıç verileri

- **Fiyat tablosu**: birkaç örnek satır (kontrol kartı tamiri, batarya hücre değişimi, BMS değişimi, gaz kolu, fren kolu/sensörü, motor hall sensörü, ekran/dashboard kartı, şarj soketi, lastik/iç lastik). Rakamlar "örnek" olarak işaretlenir, usta kendi fiyatlarıyla değiştirir.
- **Hata kodları**: Ducati, Xiaomi ve Segway-Ninebot için **güvenilir kaynaklardan derlenmiş** tablo, kaynak alanıyla birlikte. Kaynağı bulunamayan kod eklenmez. Doğrulanmamış kayıtlar arayüzde belirgin şekilde işaretlenir.

### 8.6 Teknoloji seçimleri *(geliştiricinin kararları, kullanıcı "nasıl"ı bize bıraktı)*

- **Android uygulaması**: React Native + Expo (TypeScript). Aynı kod ileride iPhone'a da çıkar. Derleme ve APK için Expo EAS. Sesli giriş: cihazın Türkçe konuşma tanıma servisi (ek ücret yok). Paylaşım hedefi: Android "share intent".
- **Web paneli ve sunucu**: Next.js (TypeScript), Vercel'de barındırılır. Ajan akışı Next.js sunucu tarafında çalışır; Claude API anahtarı sadece Vercel ortam değişkenindedir.
- **Veritabanı ve giriş**: Supabase (Postgres, Auth, satır düzeyi güvenlik). Benzer vaka araması ilk sürümde marka/model + anahtar kelime ile; gerekirse sonra anlamsal aramaya geçilir.
- **Yapay zekâ**: Claude API, varsayılan model `claude-opus-5-5` (tüm ajanlar; `AGENT_MODEL` ortam değişkeniyle değiştirilebilir). Teşhis yüksek, diğer ajanlar düşük düşünme seviyesinde çalışır. Daha ucuz bir modele geçmek kullanıcının kararıdır. Ajan çıktıları yapılandırılmış JSON olarak alınır ve doğrulanır; reddedilen isteklerde sunucu tarafı yedek model devreye girer.
- **WhatsApp'ta aç**: `https://wa.me/<numara>?text=<mesaj>` bağlantısı. Numara yoksa sadece kopyalama.

### 8.7 Hata durumları

- İnternet yoksa "Yeni iş" taslağı telefonda saklanır, bağlantı gelince analiz edilir.
- Yapay zekâ cevap vermezse ya da geçersiz çıktı dönerse bir kez yeniden denenir, sonra anlaşılır bir hata mesajı gösterilir. Ham metin kaybolmaz.
- Ses tanıma desteklenmiyorsa 🎤 düğmesi gizlenir.

### 8.8 Başarı ölçütü

İlk iki hafta gerçek işlerde kullanıldıktan sonra usta şunu söyleyebilmeli: "İlk tespit ve müşteriye cevap artık eskisinden belirgin şekilde hızlı, mesajları çoğu zaman az düzeltmeyle gönderiyorum."

## 9. Geliştiriciye bırakılanlar

- Klasör yapısı (mobil ve web için tek depoda iki proje önerilir: `apps/mobile`, `apps/web`, ortak tipler `packages/shared`).
- Prompt metinleri ve JSON şemalarının ayrıntısı.
- Arayüzün renk ve tipografisi (koyu tema + turuncu vurgu, mevcut `app.txt` sitesiyle uyumlu olabilir).
- Test yaklaşımı (en azından fiyat eşleştirici ve ajan çıktı doğrulaması için otomatik testler).

## 10. Geliştiricinin verdiği kararlar *(kullanıcının kontrol etmesi için)*

1. Yönetici bir yapay zekâ değil, **kodla yazılmış akış**. Daha öngörülebilir ve ucuz.
2. **Fiyat eşleştirme düz kod.** Yapay zekâ fiyat yazamaz, sadece tablodan gelir.
3. İlk sürümde **tek kullanıcı**, ama yapı çırak/çalışan eklemeye hazır.
4. Müşteriden sadece **ad ve telefon** saklanır (KVKK açısından ölçülü).
5. Mesaj dili varsayılan olarak "siz" hitabıyla; panelden değiştirilebilir.
6. Uygulama adı: kullanıcının önerisiyle "Scootechnology". Marka ve alan adı kontrolü mağaza yayınından önce yapılacak.

## 11. Kullanıcının cevapladığı konular

- **Atölye adı (mesaj imzası)**: "E-Scooter Tamir Merkezi". Telefon: **0535 647 11 11**. Başlangıç değeri olarak atölye ayarlarına girilir, panelden değiştirilebilir (ad henüz kesin değil).
- **Uygulamanın kesin adı**: henüz belirlenmedi. Kişisel kullanım aşamasında çalışma adı kullanılır. Mağaza yayınından önce kesinleşir.
