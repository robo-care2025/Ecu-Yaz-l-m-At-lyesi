# Orijinal Uygulamanın BLE Protokolünü Çözme

Amaç: Ducati Urban e-Mobility uygulaması scooter'a hangi byte'ları gönderip
hız limiti/mod/kilit gibi işleri yapıyor, bunu öğrenmek. Sonra aynı komutları
kendi aracımızla (`tools/send.py`) gönderebiliriz.

İki yöntem var; **ikisini birlikte** kullanmak en hızlısı.

---

## Yöntem A — Android HCI Snoop Log (en net yöntem)

Telefonun gönderdiği/aldığı TÜM BLE paketlerini kaydeder. Orijinal uygulamayı
kullanırken her butona basışın karşılığındaki byte'ları birebir görürsün.

### 1. Bluetooth HCI snoop log'u aç
- Android'de **Ayarlar → Telefon hakkında → Yazılım bilgisi → Derleme numarası**'na
  7 kez dokunup **Geliştirici Seçenekleri**ni aç.
- Geliştirici Seçenekleri → **Bluetooth HCI anlık görüntü günlüğünü etkinleştir** (Enable Bluetooth HCI snoop log) → aç.
- Bluetooth'u kapat-aç (log'un başlaması için).

### 2. Senaryoyu oynat (tek tek, aralıklı)
Orijinal uygulamayı aç, scooter'a bağlan ve **her işlemi ayrı ayrı, arasında
birkaç saniye bekleyerek** yap. Not tut (saat:dakika:saniye ile):
- Bağlandı
- ECO moduna geç
- SPORT moduna geç
- Hız limitini X yap (uygulamada böyle bir ayar varsa)
- Farı aç / kapat
- Kilitle / kilit aç

Her aksiyonu izole etmek, log'da o aksiyona ait paketi bulmayı kolaylaştırır.

### 3. Log'u çek
Snoop log genelde şuralarda olur (cihaza göre değişir):
- `/sdcard/btsnoop_hci.log`
- `/data/misc/bluetooth/logs/btsnoop_hci.log`
- Bazı cihazlarda: **bugreport** içinde (`adb bugreport`).

`adb` ile çekmenin en garanti yolu:
```bash
adb bugreport bugreport.zip
# zip içinden FS/data/misc/bluetooth/logs/ altındaki btsnoop_hci.log'u çıkar
```
veya doğrudan:
```bash
adb pull /sdcard/btsnoop_hci.log .
```

### 4. Wireshark'ta aç ve filtrele
`btsnoop_hci.log` dosyasını **Wireshark** ile aç.

Faydalı görüntü filtreleri:
```
btatt                                  # sadece ATT (GATT) katmanı
btatt.opcode == 0x52                   # Write Command (write-without-response)
btatt.opcode == 0x12                   # Write Request
btatt.opcode == 0x1b                   # Handle Value Notification (scooter -> telefon)
```
- **Telefon → scooter** komutları `Write Request`/`Write Command` olarak görünür;
  `btatt.value` alanında gönderilen byte'lar vardır.
- Her not aldığın aksiyonun zaman damgasına git, o anda giden Write paketini bul,
  `btatt.value`'yu kopyala.

### 5. Komut tablosu çıkar
`docs/02-komut-haritasi.md` dosyasına doldur: hangi aksiyon → hangi hex.

---

## Yöntem B — Canlı notify izleme (bizim araçla)

Orijinal uygulamayı kullanamadığın anlarda veya telemetriyi (hız/batarya/hata)
çözmek için:

```bash
python tools/scan.py --name DUCATI        # adresi bul
python tools/enumerate.py <ADRES> --read  # profili çıkar
python tools/monitor.py <ADRES>           # notify'ları canlı izle
```
Scooter üzerinde fiziksel işlem yap (gaz, mod, far), hangi byte'ların değiştiğine
bak. Bu, scooter → uygulama yönündeki verinin (telemetri) anlamını çözer.

> Not: Bir anda scooter'a ya telefon ya da bilgisayar bağlanabilir (çoğu
> scooter tek bağlantı kabul eder). Yöntem A için telefon bağlı olmalı; Yöntem B
> için telefon uygulamasını kapat.

---

## Paket yapısını çözerken nelere bak

Çoğu scooter kontrolcüsü (NinebotG/Xiaomi türevleri dahil) şu kalıbı kullanır:

```
[HEADER] [LEN] [ADDR] [CMD] [ARG...] [CHECKSUM]
 5A A5    ..    ..     ..    ....      .. ..
```
- **Header**: sabit önek (ör. `5A A5`). Her pakette tekrar eden ilk byte'lar.
- **LEN**: payload uzunluğu.
- **CMD / register**: ne yapıldığı (mod set, hız limiti set, far...).
- **ARG**: değer (ör. hız limiti = 25 → `0x19`).
- **CHECKSUM**: genelde byte toplamının tersi (XOR veya `~sum`), son 1-2 byte.

Hız limitini bulmanın püf noktası: Uygulamada limiti **20 → 25 → 30** yapıp her
seferinde giden paketi karşılaştır. Sadece **tek bir byte** 0x14 → 0x19 → 0x1E
şeklinde değişiyorsa, o byte hız limiti argümanıdır; checksum byte'ı da ona
bağlı değişir.

Checksum formülünü doğrulamak için `tools/checksum.py` içindeki yardımcıları
kullan ve birkaç yakalanmış paket üzerinde test et.
