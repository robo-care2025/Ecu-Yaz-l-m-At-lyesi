# Kurulum — Telefona APK olarak yükleme (Windows)

Bu komutlar **kendi bilgisayarında**, bir terminalde (PowerShell), projenin
`ducati-app` klasörünün içinde çalışır. İki yol var.

---

## YOL 1 — Bulutta derle (ÖNERİLEN, Android Studio gerekmez)

EAS, uygulamayı bulutta derler; sana kurulabilir bir `.apk` linki verir.

### Hazırlık (bir kez)
1. **Node.js LTS** kur: https://nodejs.org (kurulumda varsayılanları kabul et).
2. Ücretsiz **Expo hesabı** aç: https://expo.dev/signup

### Kodu bilgisayarına al
GitHub'da repo sayfasında **Code → Download ZIP** (ya da `git clone`), ZIP'i aç.

### Terminalde (PowerShell)
Projenin `ducati-app` klasörüne gir ve sırayla:
```powershell
cd "C:\...\Ecu-Yaz-l-m-At-lyesi\ducati-app"   # ZIP'i açtığın yer
npm install -g eas-cli
npm install
eas login                                      # Expo hesabınla gir
eas build -p android --profile preview
```
- Derleme bulutta ~10-15 dk sürer. Bitince terminalde bir **link** çıkar.
- Linki telefonunun tarayıcısında aç, `.apk`'yı indir ve kur.
  (Telefon "bilinmeyen kaynaklardan yükleme"ye izin isteyebilir → izin ver.)

### Kullan
1. Telefonda **orijinal Ducati uygulamasını tamamen kapat** (scooter tek bağlantı kabul eder).
2. Bizim uygulamayı aç → **BAĞLAN**.
3. **Scooter sehpada, tekerlek havada** iken ECO/COMFORT/SPORT dene.

---

## YOL 2 — Bilgisayarda derle (Android Studio gerekir)

Daha fazla kontrol ama kurulum uzun.

### Hazırlık (bir kez)
1. **Node.js LTS**: https://nodejs.org
2. **Android Studio**: https://developer.android.com/studio
   - İlk açılışta SDK'yı kurdur. "SDK Platform" + "Platform-Tools" (adb) yüklü olsun.
3. Ortam değişkenleri: `ANDROID_HOME` = SDK yolu
   (genelde `C:\Users\<kullanıcı>\AppData\Local\Android\Sdk`).
4. Telefonda **Geliştirici Seçenekleri → USB hata ayıklama** aç, telefonu USB ile bağla.

### Terminalde
```powershell
cd "C:\...\Ecu-Yaz-l-m-At-lyesi\ducati-app"
npm install
npx expo prebuild
npx expo run:android          # telefon USB'de bağlı olmalı
```
Uygulama derlenip telefona kurulur ve açılır.

---

## Sık sorunlar
- **"adb bulunamadı"** → Android Studio SDK Platform-Tools kurulu değil veya PATH'te yok (Yol 2).
- **Bağlanmıyor** → orijinal uygulama hâlâ açık/bağlı olabilir; tamamen kapat.
- **Taramada çıkmıyor** → scooter açık mı, telefonun Bluetooth'u açık mı, konum izni verildi mi?
- **Komut işe yaramıyor** → önce "Ham Komut" kutusundan `ca ac bd 04 01 b8 79 6a` (SPORT)
  gönderip checksum ✓ gördüğünü ve scooter'ın tepki verdiğini kontrol et.
