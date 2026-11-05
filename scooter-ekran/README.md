# Scooter Ekranı: Veri Okuma ve Düzenleme Rehberi

## 1. Kartta ne var? (fotoğraftan çıkanlar)

> **KESİN SONUÇ:** Kartın tek işlemcisi **Nuvoton MS51FB9AE** (8051, 16 KB flash). ST-Link bu karta bağlanamaz.
> Programlama/okuma için **Nu-Link** (Nu-Link-Me / Nu-Link2-Me) + ücretsiz **NuMicro ICP Programming Tool** gerekir.
> Bağlantı: ICPDA = P1.6, ICPCK = P0.2, nRESET = P2.0, VDD, GND (bacak numaralarını datasheet'ten doğrula).
> `5V TX RST RX GND` deliği büyük ihtimalle MS51'in UART ISP (bootloader) portu (etiketteki "PBO+APP" = Boot + APP).

| Parça | Ne olduğu | Önemi |
|---|---|---|
| Ortadaki 20 bacaklı çip **nuvoTon MS51FB9AE** | 8051 tabanlı Nuvoton mikrodenetleyici | **ARM değil.** ST-Link bununla konuşamaz |
| Etiketli 28 bacaklı çip "OBX-PBO+APP … 2022/03/23" | **TM1668** (Titan Micro, 24 bacak): LED/segment sürücü + tuş tarayıcı. **Yazılımı yok**, MS51 onu 3 telle (DIO/CLK/STB) yönetir | Etiket sadece kartın yazılım sürüm etiketi. **Kartın tek işlemcisi MS51FB9AE** |
| Soldaki modül (anten çizgili) | Bluetooth (BLE) modülü | Telefon uygulaması bununla konuşuyor |
| `5V TX RST RX GND` deliği | Seri port + reset: programlama / servis portu | USB-TTL buraya bağlanır |
| Alttaki 5 delik | Motor sürücüsüne giden kablo | Asıl veri trafiği burada |
| SOT-23 "G1" transistörler | TX/RX seviye çevirici | Hat 5V veya akü gerilimi olabilir, **önce ölç** |

## 1a. MS51FB9AE bacak şeması (TSSOP-20, N76E003 ile bacak uyumlu)

Üstteki **nokta = 1. bacak**. Sol sıra yukarıdan aşağı 1→10, sağ sıra aşağıdan yukarı 11→20.

```
            +-----------+
 P0.5    1 -|o          |- 20  P0.4
 TXD P0.6 2 -|          |- 19  P0.3
 RXD P0.7 3 -|          |- 18  P0.2 / ICPCK   <- Nu-Link CLK
 nRST P2.0 4 -|          |- 17  P0.1
 P3.0    5 -|  MS51     |- 16  P0.0
 P1.7    6 -|  FB9AE    |- 15  P1.0
 GND     7 -|          |- 14  P1.1
 ICPDA P1.6 8 -|        |- 13  P1.2           <- 8: Nu-Link DAT
 VDD     9 -|          |- 12  P1.3
 P1.5   10 -|          |- 11  P1.4
            +-----------+
```

| Nu-Link ucu | MS51 bacağı |
|---|---|
| ICE_DAT | **8** (P1.6) |
| ICE_CLK | **18** (P0.2) |
| nRESET | **4** (P2.0) |
| VDD | **9** |
| GND | **7** |

Not: 2 (TXD), 3 (RXD), 4 (RST) bacakları karttaki `TX RST RX` deliğiyle aynı isimde → o delik büyük ihtimalle MS51'in UART bootloader portu.
Kaynak: N76E003AT20 pin tablosu + Nuvoton'un "MS51FB9AE, N76E003AT20 ile bacak uyumlu" açıklaması. Datasheet'ten son kontrol önerilir.

## 1b. ✅ DOĞRULANMIŞ Nu-Link-Pro bağlantısı (multimetreyle ölçüldü)

MS51 **5V** ile çalışıyor. Programlama deliği MS51'e doğrudan bağlı.

| Nu-Link-Pro | Kartta nereye |
|---|---|
| VDD (5V) | Delik **5V** (kare pad) = MS51 bacak 9 |
| GND | Delik **GND** = MS51 bacak 7 |
| nRESET | Delik **RST** = MS51 bacak 4 |
| ICE_DAT | MS51 **bacak 8** (ince tel lehimle) |
| ICE_CLK | MS51 **bacak 18** (ince tel lehimle) |

### İlk bağlantı adımları
1. Nuvoton sitesinden **Nu-Link USB Driver** + **NuMicro ICP Programming Tool** kur.
2. Kartın scooter kablosunu sök. Tek besleme olsun (Nu-Link 5V ya da harici 5V).
3. ICP Tool → seri olarak **8051 1T Series** seç → **Connect**.
4. Çip adı `MS51FB9AE` görünmeli. **Config** ekranının ekran görüntüsünü al (LOCK durumu burada).
5. APROM'u (ve varsa LDROM'u) **oku ve .bin olarak kaydet**. Hiçbir şey yazma/silme.
6. `python bin_incele.py yedek.bin` → kilitli mi, ayar alanı nerede, hemen söyler.
7. Hız vb. bir ayarı ekrandan değiştirip **tekrar oku**, sonra:
   `python bin_incele.py once.bin sonra.bin` → ayarın tutulduğu bayt doğrudan çıkar.

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
