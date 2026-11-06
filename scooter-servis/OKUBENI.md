# Scooter Gösterge Servis Aracı — Çalışma Notları

**Amaç:** Gösterge/ekran değişiminden sonra km değerini aracın **gerçek**
kilometresine **eşitlemek** (belgeli kalibrasyon). Keyfî düşürme/sahtecilik
değil — her işlem loglanır ve PIN ile korunur.

## Neden önce "dinliyoruz"?
Kartın haberleşme protokolünü (hangi bayt km, komut formatı ne, checksum
nasıl) kimse ezbere bilemez. Önce test cihazından **ham veriyi yakalayıp**
km'nin yerini buluyoruz. Ancak ondan sonra güvenle yazma komutu yazılır.
Tahminle yazma komutu göndermek kartı **bozabilir** — o yüzden sırayı
atlamıyoruz.

## Donanım
- 1 adet **USB-TTL dönüştürücü** (FT232 / CP2102 / CH340) — ~30-50 TL
- Kartın köşesindeki **GND / RX / TX / 3.3V** padleri

## Bağlantı (çapraz!)
| USB-TTL | Kart |
|---------|------|
| GND     | GND  |
| RX      | TX   |
| TX      | RX   |
| 3.3V    | **BAĞLAMA** (kart kendi beslemesiyle çalışsın, sadece GND ortak olsun) |

> Sadece dinlerken USB-TTL'in TX ucunu bağlamasan da olur; RX + GND yeter.

## Adımlar

### 1) Kurulum (bir kere)
```
pip install pyserial
```

### 2) Dinle
Scooter'ı aç, mümkünse telefon uygulamasını da bağla (veri aksın), sonra:
```
python 01_dinleyici.py
```
Program portu ve hızı (baud) otomatik bulmaya çalışır. Gelen her satır bir
veri çerçevesidir. Ctrl+C ile durdurunca `kayitlar/` içine `.log` yazılır.

### 3) km'nin yerini bul
- Önce km=X iken ~10 sn kayıt al (dosya A).
- km'yi değiştir (biraz sür veya uygulamadan değiştir), tekrar kayıt al (dosya B).
- Farkı bul:
```
python 02_fark_bulucu.py kayitlar/dosyaA.log kayitlar/dosyaB.log
```
Çıktıdaki "DEGISEN KONUMLAR" km baytlarının yeridir.

### 4) Bana getir
`02_fark_bulucu.py` çıktısını ve birkaç ham çerçeveyi bana yapıştır.
Birlikte:
- km'nin kaç bayt / hangi sırada (little/big-endian) olduğunu,
- checksum (sağlama) hesabını,
- **yazma (set) komutunu**
çıkaracağız. Sonra 3 güvenlikli servis programını (`03_servis.py`) yazacağım.

## Güvenlik kuralları (ürünü "servis cihazı" yapan şey)
1. **Gerçek değere eşitleme** — aracın bilinen gerçek km'si girilir.
2. **Log** — tarih, eski→yeni km, sebep, teknisyen; `kayitlar/islem_log.csv`.
3. **PIN** — programı sadece yetkili açar.
