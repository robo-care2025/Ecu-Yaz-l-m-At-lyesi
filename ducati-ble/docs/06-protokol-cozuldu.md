# PROTOKOL ÇÖZÜLDÜ — 2. yakalama (aksiyonlu)

İkinci btsnoop ile komut çerçevesi ve telemetri çözüldü. **Komutlar sabit →
şifreleme engeli yok, replay çalışıyor. libapp.so tersine mühendisliği GEREKMİYOR.**

## 1. En kritik bulgu: komutlar SABİT (deterministik)
Aynı aksiyon her seferinde AYNI byte'ları üretti:
```
ca ac bd 00 40 fd ba 6a    (t=78.599 ve t=85.586 — birebir aynı)
ca ac bd 00 00 bd 7a 6a    (t=83.850 ve t=89.094 — birebir aynı)
```
→ Oturum anahtarı / nonce YOK. Yakalanan komutu geri göndermek (replay) çalışır,
ve çerçeveyi bildiğimiz için istediğimiz komutu üretebiliriz.

## 2. Komut çerçevesi (telefon → scooter, char 0xFFF6, 8 byte)
```
ca ac bd [CMD] [ARG] [CK5] [CK6] 6a
 │  │  │   │     │     │     │    └ sabit footer 0x6A
 │  │  │   │     │     │     └────── CK6 = (sum(byte[0..4]) + 0x47) & 0xFF
 │  │  │   │     │     └──────────── CK5 = (sum(byte[0..4]) + 0x8A) & 0xFF
 │  │  │   │     └────────────────── ARG (değer/argüman)
 │  │  │   └──────────────────────── CMD (komut tipi)
 └──┴──┴──────────────────────────── sabit header CA AC BD
```
İki örnek de birebir üretildi (bkz. `tools/ducati_codec.py`).

### Henüz bilinen tek komut ailesi
- `CMD=0x00`, `ARG=0x40` → bir fonksiyon **AÇIK**
- `CMD=0x00`, `ARG=0x00` → aynı fonksiyon **KAPALI**
- Fonksiyonun adı (far? kilit? cruise?) henüz etiketlenmedi.

## 3. Telemetri çerçevesi (scooter → telefon, char 0xFFF7, 16 byte)
```
5a b9 00 00 24 00 00 00 64 [STATE] 00 20 00 00 [CK] 95
                            │                   └ CK = (STATE + 0x60) & 0xFF
                            └───────────────────── STATE: durum/mod baytı
```
Yakalamada görülen STATE: `01, 02, 03, 13, 81`.
- Alt nibble (0x0_) muhtemelen mod: 1/2/3.
- Üst bitler (0x10, 0x80) bayrak gibi (far/kilit?).

## 4. Hâlâ eksik olan: aksiyon ↔ (CMD,ARG) etiketleri
Bu yakalamada:
- Mod değişimleri (STATE 01→02→03) telemetride göründü ama **BLE yazması olarak
  görünmedi** → modlar bu sırada muhtemelen scooter üzerinden (fiziksel) değişti,
  ya da mod ayrı bir komutla gidiyor.
- Tek yakalanan komut `CMD=0x00` ile bir aç/kapa idi.

### Etiketleme için iki yol
**(a) Replay testi (en hızlı, donanım gerekli):**
Scooter'ı sehpaya al (tekerlek yerden kesik), uygulamadan şu iki paketi gönder
ve ne olduğunu GÖZLEMLE:
```
ca ac bd 00 40 fd ba 6a   → ne açılıyor?
ca ac bd 00 00 bd 7a 6a   → ne kapanıyor?
```
`ducati-app`'teki "Ham Komut" kutusu ya da `tools/send.py` ile gönderilebilir.

**(b) Etiketli yakalama:**
Her aksiyonu TEK TEK yap, saatini not et, yeni btsnoop al:
- Far aç / far kapat
- Kilitle / kilit aç
- Cruise aç / kapat
- (varsa) hız limiti 20 / 25 / 30
- ECO / COMFORT / SPORT / PEDESTRIAN (uygulamadaki butonlardan)
Hangi aksiyonun hangi (CMD,ARG) ürettiğini eşleştiririz.

## 5. Koda işlenenler
- `tools/ducati_codec.py`: komut encode/decode + telemetri decode (doğrulandı).
- `ducati-app/src/ble/protocol.ts`: `buildCommand(cmd,arg)` gerçek çerçeveyle.
- `ducati-app/src/ble/telemetry.ts`: STATE baytı çözümü.
- `ducati-app/src/config.ts`: doğrulanmış komutlar + eksik eşleşme notu.
- `ducati-app` Dashboard: telemetri + doğrulanmış komut butonları + ham test kutusu.
