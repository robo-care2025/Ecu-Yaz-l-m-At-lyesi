# APK Sonucu — Flutter uygulaması, mantık libapp.so'da

`apk_report.txt` (dex string taraması) analizi.

## Tespit
- Uygulama **Flutter** (Dart). Kanıt: FlutterActivity, flutter-permission-handler,
  journeyapps.barcodescanner, Flutter engine string'leri.
- `classes*.dex` içeriği scooter'la ilgisiz altyapı:
  - **Google Tink** kripto (AesGcm/Eax/Siv/HPKE) → Firebase/app güvenliği.
  - **Firebase Auth** (telefon doğrulama, reCAPTCHA, nonce).
  - Genel **BLE plugin** çağrıları (writeCharacteristic, BluetoothGatt) — scooter
    komutu ÜRETİMİ yok.
- Dolayısıyla **scooter komut formatı + şifreleme Dart tarafında**:
  `lib/arm64-v8a/libapp.so` (AOT-derlenmiş Dart).

## dex'teki uzun hex sabitler (DÜŞÜK olasılıklı anahtar adayları)
Muhtemelen Firebase/Tink/sertifika kaynaklı, scooter anahtarı DEĞİL:
- `470fa2b4ae81cd56ecbcda9735803434cec591fa` (20B, SHA-1 gibi)
- `4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5` (32B)
- `c6858e06...e31c2e5bd66` (64B)

## İki yollu plan

### Yol 1 — YENİ YAKALAMA (en yüksek ROI, önce bunu yap)
libapp.so'yu tersine çevirmeye GEREK KALMADAN sonuç verebilir. Orijinal
uygulamayla her aksiyonu tek tek, 2-3 kez yap, yeni btsnoop'u al. Soru:
**aynı aksiyon her seferinde aynı byte'ları mı üretiyor?**
- Evet → komutlar sabit (şifre yok ya da deterministik) → replay/map çalışır, BİTTİ.
- Hayır → oturum anahtarı var → Yol 2.

### Yol 2 — libapp.so analizi (Yol 1 yetmezse)
Flutter AOT'u tersine çevirmek zor ama mümkün:
- Önce ucuz deneme: `libapp.so` string taraması (hardcoded anahtar/komut sabiti).
- Gerekirse `reFlutter` / `Blutter` ile Dart snapshot'ı çöz.

## Durum
- GATT profili: KESİN (FFF0/FFF7/FFF6).
- Telemetri: şifresiz, çözülebilir.
- Komut formatı: Dart'ta; önce yeni yakalamayla sabit mi diye bakılacak.
