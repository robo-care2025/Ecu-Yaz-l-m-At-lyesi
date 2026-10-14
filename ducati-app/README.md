# Ducati PRO Kontrol — Mobil Uygulama (React Native / Expo)

Orijinal Ducati Urban e-Mobility uygulamasının yerine geçen, BLE ile scooter'a
komut gönderen (mod, hız limiti, far, kilit) ve telemetri gösteren mobil
uygulama iskeleti. `react-native-ble-plx` kullanır.

> Önce `../ducati-ble/` araçlarıyla protokolü çöz, bulduğun UUID/komut/checksum
> değerlerini `src/config.ts`'e gir. Uygulama o değerlerle çalışır.

## Yapı
```
App.tsx                      uygulama girişi
src/config.ts                ← UUID, komut byte'ları, checksum (SEN DOLDUR)
src/ble/bleManager.ts        BLE tara/bağlan/yaz/dinle
src/ble/protocol.ts          komut gövdesi → tam paket (header+checksum+base64)
src/ble/telemetry.ts         gelen notify → hız/batarya/mod
src/screens/DashboardScreen  ana kontrol ekranı
```

## Neden Expo "dev client"?
`react-native-ble-plx` native modül içerir; Expo Go ile çalışmaz. Expo
dev-client + config plugin ile Bluetooth izinleri otomatik eklenir ve kendi
geliştirme build'ini alırsın.

## Kurulum & çalıştırma
```bash
cd ducati-app
npm install
npx expo prebuild                 # native android/ios klasörlerini üretir
# Android cihaz USB'de ve "USB hata ayıklama" açık:
npx expo run:android
# veya iOS (Mac + Xcode):
npx expo run:ios
```
> BLE gerçek cihazda test edilir, emülatörde değil.

## Protokolü bağlama (tek dosya)
`src/config.ts` içinde doldur:
1. `deviceNameFilter` — scan.py'de gördüğün isim parçası
2. `writeServiceUUID` / `writeCharUUID` — enumerate.py'de **[write]** olan
3. `notifyServiceUUID` / `notifyCharUUID` — **[notify]** olan
4. `writeWithoutResponse` — karakteristik write-without-response ise `true`
5. `PROTOCOL.header` ve `PROTOCOL.checksum` — checksum.py sonucundan
6. `COMMANDS` — HCI snoop'tan çıkardığın gerçek komut byte'ları

`telemetry.ts` içindeki byte indekslerini de monitor.py bulgularına göre güncelle.

## Akış
1. **BAĞLAN** → izin ister, tarar, scooter'ı bulunca bağlanır, telemetri dinler.
2. Mod seç / hız limiti kaydırıcısı / far / kilit → `protocol.ts` paketi kurar,
   `bleManager` base64'e çevirip write karakteristiğine yazar.
3. Scooter notify gönderdikçe üstteki hız/batarya/mod güncellenir.

## Güvenlik / yasal
Yalnızca **kendi** scooter'ında kullan. Komut denemelerini scooter sehpada,
tekerlek yerden kesikken yap. Hız limitini yasal sınırların üzerine çıkarmak
kamuya açık yollarda yasa dışı/tehlikeli olabilir; sorumluluk kullanıcıdadır.
