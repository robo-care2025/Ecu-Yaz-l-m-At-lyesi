# Scooter Gösterge Servis Aracı — Çalışma Notları

**Amaç:** Gösterge/ekran değişiminden sonra km değerini aracın **gerçek**
kilometresine **eşitlemek** (belgeli kalibrasyon). Keyfî düşürme/sahtecilik
değil — her işlem loglanır ve PIN ile korunur.

## Bilinenler (test cihazı)
- Haberleşme: **BLE** (telefon uygulaması: "Ducati")
- Kartta **8 bacaklı EEPROM var** → km büyük ihtimalle burada
- Eldeki aletler: **ST-LINK V2**, **CH341A** (24xx/25xx), **Pololu USB AVR Programmer v2.1** (dahili USB-TTL seri port da var)

## ÖNERİLEN YOL: CH341A ile EEPROM (en kısa)

km muhtemelen harici 24Cxx EEPROM'da. Ekranda yazan km'yi zaten bildiğimiz
için **tek döküm** yeter:

1. **EEPROM part numarasını oku** (çipin üstü: 24C02 / 24C16 / 24C64...).
2. **Döküm al** (CH341A):
   - Windows: *AsProgrammer* veya *CH341A Programmer* → I2C → 24Cxx → doğru çip → **Read** → `dump.bin` kaydet.
   - Çipi ya SOIC-8 klips ile yerinde oku, ya da sök (test cihazında sökmek en garantisi).
3. **Ekrandaki km'yi dökümde ara:**
   ```
   python 04_deger_ara.py dump.bin 1240        # 1240 = ekranda yazan km
   ```
   Çıkan aday adres(ler)i not et.
4. **Doğrula (opsiyonel):** 1-2 km sürüp ikinci döküm al, karşılaştır:
   ```
   python 03_dump_karsilastir.py dump.bin dump2.bin
   ```
   Aynı adreste değerin arttığını gör → adres kesinleşti.
5. Çıktıyı **bana getir**; adresi + ölçeği + checksum'ı netleştirip güvenli
   yazma adımını (`05_servis.py`) kuracağız. Yazarken sadece o adresi
   değiştirip EEPROM'u geri flash'larız.

## YEDEK YOL: UART dinleme (Pololu seri portu)

Canlı protokolü görmek / BLE tarafını anlamak için:
- Pololu'nun **RX ← kart TX**, **GND ↔ GND** (çapraz). 3.3V bağlama.
- `pip install pyserial`
- `python 01_dinleyici.py`  → kayıt al, `02_fark_bulucu.py` ile km baytını bul.

## Araçlar
| Dosya | İş |
|-------|----|
| `01_dinleyici.py` | UART ham veri yakalama (sadece okur) |
| `02_fark_bulucu.py` | İki UART kaydını kıyasla, km baytını bul |
| `03_dump_karsilastir.py` | İki binary dökümü kıyasla (EEPROM/flash) |
| `04_deger_ara.py` | Tek dökümde bilinen km değerini ara |
| `05_servis.py` | *(sonra)* PIN + log + güvenli km eşitleme |

## Güvenlik kuralları (ürünü "servis cihazı" yapan şey)
1. **Gerçek değere eşitleme** — aracın bilinen gerçek km'si girilir.
2. **Log** — tarih, eski→yeni km, sebep, teknisyen; `kayitlar/islem_log.csv`.
3. **PIN** — programı sadece yetkili açar.
