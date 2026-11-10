# Nu-Link + Nuvoton — km Okuma/Yazma İş Akışı

Amaç: Ekranın Nuvoton'undan hafızayı okuyup km'nin yerini bulmak ve yeni
ekrana gerçek km'yi yazmak. Test düzeneği: **265.7'li ekran + 0'lı ekran**.

## 0. Beklerken hazırlık (Nu-Link yolda)
1. **Çipin tam adını oku** → bana yaz (`N76E003`, `MS51FB9AE`, `M031...`, `N79E...`).
   - 8051 ailesi (N76E/MS51/N79E) → **ICP** modu (ICPDAT/ICPCLK/RST).
   - ARM/NuMicro (M0/M031...) → **SWD** modu (SWDIO/SWCLK/RST).
2. **Nuvoton çevresindeki lehim padlerini/test noktalarını** fotoğrafla
   (özellikle "RST" yazan ve yanındaki noktalar) → Nu-Link kablolamasını çıkaralım.
3. **NuMicro ICP Programming Tool**'u indir (Nuvoton resmi, ücretsiz, Windows).
   - 8051 için aynı araç içinde "8051 ICP" bölümü var.

## 1. Nu-Link kablolama — MS51FB9AE (TSSOP20, ICP)
**Çip TEYİTLİ: Nuvoton MS51FB9AE** → 8051, **ICP** modu (SWD değil).

ICP için gereken 5 sinyal ve MS51FB9AE pinleri (datasheet Rev1.04):
| Nu-Link | Sinyal | MS51FB9AE pini |
|---|---|---|
| VDD (3.3V) | besleme | **pin 9** (VDD) |
| GND | toprak | VSS / karttaki herhangi GND pad |
| RST | nRESET | **pin 4** (P2.0/nRESET) |
| DAT (ICE_DAT/SWDIO) | ICPDA | **pin 8** (P1.6) |
| CLK (ICE_CLK/SWCLK) | ICPCK | **pin 18** (P0.2) |

- Pin 1 = çipteki nokta/çentik. TSSOP20: alt sıra soldan sağa 1..10,
  üst sıra soldan sağa 20..11 (yani pin 18 = üst sıra soldan 3.).
- DAT hattına **100kΩ pull-up** (VDD'ye) önerilir; kart/Nu-Link çoğu zaman
  hallediyor — önce pull-up'sız dene, olmazsa ekle.
- Besleme: kartı Nu-Link 3.3V ile besle (kartın kendi beslemesi KAPALI), GND ortak.
- Kartta genelde bu sinyaller pad/test noktası olarak dışarı verilir
  ("RST" padi = pin 4; yanındakiler büyük ihtimalle DAT/CLK).

### NuMicro ICP Tool ayarı
- Part No / Series: **MS51** (8-bit 1T 8051) seç.
- Connect → okuma testi (bkz. Adım 2).

## 2. İLK KRİTİK TEST — okunabiliyor mu?
NuMicro ICP Tool → Connect → **APROM oku**.
- **Anlamlı veri geliyorsa** (hep 0x00/0xFF değil) → flash KİLİTLİ DEĞİL → devam.
- **Hep 0xFF / 0x00 / hata** → flash OKUMA-KORUMALI → bu yol kapalı → yasal belgeleme.

## 3. km'nin yerini bul (iki döküm + diff)
1. **265.7'li ekranı** oku → `dump_265.bin` kaydet (APROM + varsa Data Flash).
2. **0'lı ekranı** oku → `dump_000.bin` kaydet.
3. Bilinen km'yi ara:
   ```
   python 04_deger_ara.py dump_265.bin 265
   ```
   (265 → 2657, 0x0A61 aranır; 2 bayt LE adayları çıkar.)
4. İki dökümü karşılaştır:
   ```
   python 03_dump_karsilastir.py dump_000.bin dump_265.bin
   ```
   265.7 dökümünde `61 0A`, 0 dökümünde `00 00` olan adres = **km adresi**.

## 4. km yaz (yeni ekrana gerçek değeri)
- Hedef km → ham = round(km*10) → 2 bayt LE (örn. 265.7 → 2657 → `61 0A`).
- NuMicro ICP Tool ile ilgili sayfayı/adresi güncelle ve yaz.
- **ÖNCE tam yedek al** (`dump_yedek.bin`): bir şey ters giderse birebir geri yaz.
- Yazdıktan sonra ekranı tak, km'yi doğrula.

## 5. Güvenlik / servis kuralları
- Her işten önce **tam APROM yedeği** (geri dönüş garantisi).
- İşlem logu: tarih, cihaz, eski→yeni km, sebep (ekran değişimi), teknisyen.
- Not: Checksum/bütünlük baytı varsa km ile birlikte güncellenmeli (diff'te
  km'nin yanında değişen 2. bir bayt varsa o checksum olabilir — birlikte bakarız).

## Durum
- [ ] Çip adı
- [ ] Pad fotoğrafı / pinout
- [ ] NuMicro ICP Tool kurulu
- [ ] Okuma testi (kilit var/yok)
- [ ] 2 döküm + km adresi
- [ ] Yazma + doğrulama
