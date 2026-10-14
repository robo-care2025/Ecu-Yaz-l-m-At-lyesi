# APK Analizi — Şifreleme Anahtarı/Algoritması Çıkarma

Komut kanalı (0xFFF6) şifreli olduğu için (bkz. `03-bulgular.md`), komut
üretebilmek için orijinal uygulamanın şifreleme yöntemini bulmamız lazım.
APK'yı yüklemene gerek YOK — aşağıdaki yollardan biriyle küçük bir çıktı paylaş.

## Yol 1 — Script çalıştır, küçük raporu gönder (ÖNERİLEN, kurulumsuz)

```bash
cd ducati-ble
bash tools/apk_analyze.sh /yol/ducati_uygulama.apk
```
Bu, APK'yı yerelinde tarar ve `apk_report.txt` üretir (küçük bir metin dosyası).
İçinde şifreleme ile ilgili string sabitleri, sınıf isimleri ve (varsa) anahtar
olur. **Bu `apk_report.txt`'yi bana gönder.**

> macOS/Linux'ta `unzip` ve `strings` hazır gelir. Windows'ta WSL ya da Git Bash kullan.

## Yol 2 — Direkt indirme linki ver, gerisini ben yapayım

APK'yı bir direkt-indirme linkine koy (örnekler):
- Google Drive: paylaş → linki "uc?export=download&id=..." formatına çevir
- `catbox.moe`, `file.io`, `transfer.sh`, Dropbox (`?dl=1`)

Linki bana ver; APK'yı çekip `androguard` ile decompile eder, BLE yazma yapan
sınıfı ve şifreleme anahtarını/algoritmasını çıkarırım.

> Not: Link herkese açık olacağı için, istersen analiz sonrası linki sil.

## Yol 3 — Kendin jadx ile bak (en detaylı)

1. https://github.com/skylot/jadx/releases → `jadx-gui` indir.
2. APK'yı aç, **Search (Ara)** ile şunları ara:
   - `Cipher.getInstance` → şifreleme algoritması (AES/DES/ECB/CBC)
   - `SecretKeySpec` → anahtarın nasıl kurulduğu (çoğu zaman anahtar yanındadır)
   - `writeCharacteristic` → BLE'ye yazan kod
   - `fff6` / `0000fff6` → komut karakteristiği kullanan sınıf
3. Bulduğun sınıfın (genelde 1-2 küçük dosya) kodunu bana gönder.

## Ne arıyoruz (özet)

```java
// Tipik kalıp — bunu bulmak istiyoruz:
Cipher c = Cipher.getInstance("AES/ECB/NoPadding");      // <- algoritma + mod
c.init(ENCRYPT_MODE, new SecretKeySpec(key, "AES"));     // <- key BURADA
byte[] enc = c.doFinal(plaintext);
gattChar_fff6.setValue(enc);                             // <- 0xFFF6'ya yazılıyor
```
- **algoritma + mod + padding** (AES/ECB/NoPadding gibi)
- **key** (sabit 16 byte dizi, ya da seri no / handshake'ten türetiliyor olabilir)
- **düz metin komut formatı** (muhtemelen `5A ...` + checksum, şifrelenmeden önce)

Bunları bulunca `ducati-app/src/ble/protocol.ts`'e şifreleme ekler, `config.ts`'e
gerçek komut byte'larını gireriz ve uygulama çalışır.
