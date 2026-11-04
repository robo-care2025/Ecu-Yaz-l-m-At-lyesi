# Ducati PRO-I EVO — BLE Tersine Mühendislik & Kontrol Araç Seti

Ducati Urban e-Mobility (PRO-I EVO) scooter'ının BLE protokolünü çözmek ve
scooter'a kendi komutlarımızı (hız limiti, mod, far, kilit) göndermek için
araçlar. **Yalnızca kendi cihazın üzerinde** kullan.

## Mimari (3 adım)

```
  1. KEŞİF            2. PROTOKOL ÇÖZME          3. KONTROL
  ----------          -----------------          ----------
  scan.py       →     orijinal uygulama   →      send.py
  enumerate.py        + HCI snoop (Wireshark)    (komut gönder)
  monitor.py          + checksum.py
                      → komut-haritasi.md
```

## Kurulum
```bash
cd ducati-ble
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```
> Linux'ta BLE için BlueZ gerekir. macOS'ta Terminal/IDE'ye Bluetooth izni ver.
> Windows 10+ çalışır.

## Hızlı başlangıç
```bash
# 1) Scooter'ı bul (açık, telefon uygulaması KAPALI olmalı)
python tools/scan.py --name DUCATI

# 2) GATT profilini çıkar — write/notify UUID'lerini öğren
python tools/enumerate.py <ADRES> --read

# 3) Scooter'dan gelen telemetriyi canlı izle (gaz/mod/far değiştirerek)
python tools/monitor.py <ADRES>

# 4) Orijinal uygulamanın komutlarını yakala (bkz. docs/01-protokol-cozme.md)
#    sonra kendi komutunu gönder:
python tools/send.py <ADRES> --char <WRITE_UUID> --notify <NOTIFY_UUID> --hex "5a a5 ..."
```

## Araçlar
| Dosya | İş |
|---|---|
| `tools/scan.py` | Yakındaki BLE cihazlarını tara, scooter'ı bul |
| `tools/enumerate.py` | GATT servis/karakteristiklerini dökümle (write/notify tespiti) |
| `tools/monitor.py` | Notify verilerini canlı logla (telemetri çözme) |
| `tools/send.py` | Karakteristiğe ham komut yaz (replay / hız limiti) |
| `tools/checksum.py` | Yakalanan paketlerin checksum formülünü bul/üret |

## Dokümanlar
- `docs/01-protokol-cozme.md` — HCI snoop + Wireshark ile komutları çözme (adım adım)
- `docs/02-komut-haritasi.md` — çözdüğün komutları yazdığın tablo

## Önemli notlar
- Çoğu scooter **tek BLE bağlantısı** kabul eder: komut göndermek için önce
  telefon uygulamasını tamamen kapat.
- Komut denemelerini scooter **sehpada, tekerlek yerden kesikken** yap.
- Protokolü çözmeden rastgele byte gönderme; önce yakala, sonra replay et.

## Güvenlik / yasal
Bu araçlar yalnızca **sahibi olduğun** scooter'da, kişisel kullanım/öğrenme
amaçlıdır. Hız limitini yasal sınırların üstüne çıkarmak kamuya açık yollarda
yasa dışı ve tehlikeli olabilir; sorumluluk kullanıcıya aittir.
