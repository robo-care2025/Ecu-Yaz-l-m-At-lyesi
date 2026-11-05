# Scooter Ekranı: Veri Okuma ve Düzenleme Rehberi

## 1. Kartta ne var? (fotoğraftan çıkanlar)

| Parça | Ne olduğu | Önemi |
|---|---|---|
| Ortadaki 20 bacaklı çip **nuvoTon MS51FB9AE** | 8051 tabanlı Nuvoton mikrodenetleyici | **ARM değil.** ST-Link bununla konuşamaz |
| Etiketli 28 bacaklı çip "OBX-PBO+APP … 2022/03/23" | Asıl ekran işlemcisi. Etiketin altı da **Nuvoton** çıktı (logo okundu, model satırı henüz okunamadı) | Model 8051 mi (MS51/ML51) yoksa ARM mi (M031/M0xx) — ST-Link kararı buna bağlı |
| Soldaki modül (anten çizgili) | Bluetooth (BLE) modülü | Telefon uygulaması bununla konuşuyor |
| `5V TX RST RX GND` deliği | Seri port + reset: programlama / servis portu | USB-TTL buraya bağlanır |
| Alttaki 5 delik | Motor sürücüsüne giden kablo | Asıl veri trafiği burada |
| SOT-23 "G1" transistörler | TX/RX seviye çevirici | Hat 5V veya akü gerilimi olabilir, **önce ölç** |

## 2. ST-Link V2 neden (büyük ihtimalle) işe yaramaz?

ST-Link yalnızca iki dil bilir:
- **SWD** → STM32 / GD32 / APM32 / AT32 gibi ARM Cortex-M çipler
- **SWIM** → STM8 çipler

Nuvoton MS51 ise kendi **ICP** protokolünü kullanır; bunun için **Nu-Link** (Nu-Link-Me / Nu-Link2-Me, ucuz) gerekir.
Ayrıca seri üretim kartlarda **okuma kilidi (LOCK / RDP)** neredeyse her zaman açıktır:
kilidi kaldırmak çipi **siler**. Yani "flash'ı çekip düzenleyip geri yazma" çoğu zaman mümkün olmaz.

**İstisna:** Etiketli 28 bacaklı çip bir STM32/GD32 (ARM) veya STM8 çıkarsa ST-Link devreye girer. Bkz. Bölüm 5.

## 3. Sonuç getiren yol: hattı dinle, protokolü çöz

Hız sınırı, teker çapı, km, şifre, kilit… bunların hepsi ekran ile sürücü arasında **seri hat üzerinden** gidip gelir.
Protokolü çözersen ekranı hiç açmadan bu değerleri okuyup değiştirebilirsin. Ürüne dönüşen kısım da bu.

### Gereken malzeme
- USB-TTL çevirici (CH340G veya CP2102, 3.3V/5V seçmeli) — ikinci yönü de dinlemek için 2 adet ideal
- (Önerilir) 24 MHz 8 kanal ucuz lojik analizör + ücretsiz **PulseView** programı
- Multimetre / osiloskop

### Adım adım
1. **Gerilimi ölç.** Scooter açıkken alttaki 5 kablodaki TX/RX hatlarının GND'ye göre gerilimine bak.
   - 3.3 V veya 5 V → USB-TTL'ye doğrudan bağlanabilir.
   - Daha yüksekse (bazı modellerde tek telli hat akü gerilimindedir) → **doğrudan bağlama**, araya gerilim bölücü (ör. 10k/2.2k) koy.
2. **Sadece RX ve GND bağla.** USB-TTL'nin RX ucu → hat, GND → GND. TX ucunu **boşta bırak** (dinlerken hatta karışmasın).
3. Bilgisayarda:
   ```
   pip install pyserial
   python uart_dinle.py --liste
   python uart_dinle.py --port COM5 --baud tara
   ```
4. Hız bulununca kayıt al:
   ```
   python uart_dinle.py --port COM5 --baud 9600 --kayit test1.csv
   ```
   Kayıt sürerken **tek seferde tek bir şey yap** ve not al:
   gaza bas → bırak, fren, far aç/kapa, vites/mod değiştir, menüden hız ayarını değiştir.
   Program değişen baytları renkli (veya `[köşeli]`) gösterir; hangi baytın neyi kontrol ettiği böyle bulunur.
5. İki yönü ayrı görmek için iki USB-TTL kullan (biri ekran→sürücü, diğeri sürücü→ekran hattına):
   ```
   python uart_dinle.py --port COM5 --port COM6 --baud 9600 --kayit iki_yon.csv
   ```
6. CSV dosyalarını bana gönder → paket yapısını, sağlama (checksum) türünü ve ayar baytlarını birlikte çıkaralım.
   Sonraki adımda **paket gönderen** bir araç yazarız (ör. hız sınırını değiştir).

## 4. Bluetooth tarafı (telefon uygulaması varsa)

Uygulamanın gönderdiği komutlar çoğu zaman seri hattaki komutların aynısıdır.
1. Android: Geliştirici seçenekleri → **Bluetooth HCI snoop günlüğü** → Aç.
2. Uygulamayla scooter'a bağlan, ayarları değiştir.
3. `adb bugreport` ile günlüğü al, **Wireshark** ile aç → ATT "Write" paketlerine bak.
Bu bilgiyle ileride kendi telefon uygulamanı yapabilirsin.

## 5. Etiketin altı ARM/STM8 çıkarsa: ST-Link ile deneme

> **Güncel durum:** Etiketin altında Nuvoton logosu var. Model satırına göre:
> - `MS51…`, `ML51…`, `N76…` → 8051, **ST-Link olmaz**, Nu-Link gerekir.
> - `M031…`, `M032…`, `M0516…`, `MINI5x…`, `NUC029…` → ARM Cortex-M0, **SWD var, ST-Link + OpenOCD ile denenebilir**
>   (`openocd -f interface/stlink.cfg -f target/numicro.cfg`). Çip "Security Lock" ile kilitliyse okuma FF döner;
>   kilidi açmak çipi siler.
>
> Lazerle yazılmış yazıyı okuma ipucu: çipi alkolle temizle, üstüne tebeşir/talk pudrası sürüp sil
> (oyuklarda kalır, yazı beyaz çıkar); ışığı yandan, çok yatık açıyla tut.

1. Etiketi kaldır, çipin üstündeki yazının net fotoğrafını çek (ör. `STM32F030K6`, `GD32F130`, `STM8S105`).
2. Datasheet'ten **SWDIO, SWCLK, NRST, VDD, GND** bacaklarını bul (STM8 için **SWIM, NRST, VDD, GND**).
3. ST-Link'in 3.3V'unu karta **verme**; kartı kendi beslemesiyle çalıştır, ST-Link'ten sadece GND + sinyal hatlarını bağla.
4. Ücretsiz **STM32CubeProgrammer** → ST-LINK → Mode: *Under reset* → Connect.
   - Bağlanır ve flash okunursa → **önce tam yedek al** (`.bin`), dosyayı bana gönder.
   - "Read protection" uyarısı verirse → **RDP kaldırma! Çipi siler, ekran çalışmaz hale gelir.** Bölüm 3'e dön.
5. GD32/APM32 klonları için OpenOCD de kullanılabilir:
   ```
   openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c "init; reset halt; flash read_bank 0 yedek.bin; exit"
   ```

## 6. Kesin kurallar

- **Yedeksiz hiçbir şey yazma.** İlk iş her zaman yedek.
- Kilitli çipte "unlock / mass erase" yapma: yazılım tamamen silinir.
- Dinlerken USB-TTL TX ucunu bağlama.
- Hız sınırını değiştirmek bazı ülkelerde yasal/sigorta sorunu doğurur; ürün olarak satacaksan "kapalı alan/özel kullanım" uyarısı ekle.

## 7. Bu iş nasıl ürüne dönüşür?

| Ürün | Talep | Zorluk |
|---|---|---|
| Bu marka/model için **BLE ayar uygulaması** (hız, km, kilit, teker çapı) | Yüksek: Xiaomi/Ninebot dışı markalarda neredeyse yok | Orta (protokol çözülünce) |
| **Ara modül**: ekran ile sürücü arasına takılan, değerleri değiştiren küçük kart (ESP32-C3 / STM32) | Yüksek, tak-çalıştır olduğu için | Orta |
| Servislere **ekran/sürücü teşhis aracı** | Sürekli talep var | Düşük-orta |

Hepsinin ilk adımı aynı: **Bölüm 3'teki dinleme kaydı.**
