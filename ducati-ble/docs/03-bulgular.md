# Bulgular — btsnoop_hci.log analizi (ilk yakalama)

`tools/parse_btsnoop.py` ile çözülen gerçek BLE trafiği. Yakalama ~154 saniye.

## 1. GATT profili (KESİN)

Ana servis: **`0xFFF0`** (`0000fff0-0000-1000-8000-00805f9b34fb`)

| Karakteristik | UUID (16-bit) | Değer handle | CCCD | Özellikler | Rol |
|---|---|---|---|---|---|
| Telemetri | **`0xFFF7`** | `0x0010` | `0x0011` | read, **notify** | Scooter → telefon veri |
| Komut | **`0xFFF6`** | `0x0014` | — | read, write, write-no-resp | Telefon → scooter komut |
| ? | `0xFFF1` | `0x0018` | — | read, write, write-no-resp | (kullanılmadı) |
| ? | `0xFFF2` | `0x001c` | — | read, write, write-no-resp | (kullanılmadı) |
| ? | `0xFFF3` | `0x0020` | — | read, write, write-no-resp | (kullanılmadı) |
| ? | `0xFFF5` | `0x0024` | — | read, write, write-no-resp | (kullanılmadı) |

128-bit karşılığı: `0000fffX-0000-1000-8000-00805f9b34fb`.

Uygulama sadece `0xFFF7`'ye abone oldu ve komutu `0xFFF6`'ya yazdı.

## 2. Telemetri (ŞİFRESİZ) — handle `0x0010`, char `0xFFF7`

İki farklı 16 byte'lık çerçeve geldi (scooter boşta, 0 km/h):

```
idx:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
A:   5a b9 00 00 11 00 03 00 3c 03 00 20 30 00 3d 95   (x653)
B:   5a b9 00 00 11 00 00 00 3d 03 00 20 00 00 0f 95   (x124)
```
- `5a` = başlık (header). `95` = sabit sonlandırıcı (iki çerçevede de aynı → checksum DEĞİL).
- Değişen baytlar: **idx6** (03/00), **idx8** (3c/3d), **idx12** (30/00), **idx14** (3d/0f).
- Bunlar aday telemetri alanları (muhtemelen iki ayrı çerçeve tipi veya durum).
  Anlamlarını kesinleştirmek için: scooter'ı sürerken / mod değiştirirken yeniden
  yakala, hangi byte hız/batarya/mod ile birlikte değişiyor gör (`monitor.py`).

## 3. Komut kanalı (ŞİFRELİ görünüyor) — handle `0x0014`, char `0xFFF6`

Tüm yakalamada **tek bir komut** yazıldı (t≈142.9s):
```
ca ac bd 04 01 b8 79 6a      (8 byte)
```
- Telemetrinin aksine **`5a` başlığı YOK**; yapı görünmüyor → büyük olasılıkla
  **şifreli/karartılmış** (Ninebot/Segway ailesi scooter'larda yaygın: oturum
  anahtarıyla AES veya XOR tabanlı şema).
- Bu tek komutun hangi aksiyona (mod? kilit? auth?) karşılık geldiği **belli değil**,
  çünkü yakalama sırasında ayrı ayrı işlemler yapılmamış.

### Sonuç: Bu yakalama komut haritası çıkarmaya YETMİYOR
İki eksik var:
1. **Aksiyon çeşitliliği yok:** ECO/SPORT, hız limiti 20/25/30, far, kilit gibi
   işlemler tek tek yapılmamış. Her komutu görmek için bunları yaparken yakalamak lazım.
2. **Şifreleme:** Komutlar düz metin değil. Çözmek için ya çok sayıda örnekle
   şemayı kırmak ya da orijinal uygulamanın APK'sını decompile edip anahtar/algoritmayı
   bulmak gerekir.

## 4. Sıradaki adımlar

### A) Daha iyi yakalama (önce bunu yap)
Orijinal uygulamayı kullanırken **her işlemi tek tek, arasında 3-5 sn bekleyerek**
yap ve not tut (saat ile). Özellikle:
- ECO → COMFORT → SPORT → PEDESTRIAN
- (varsa) hız limiti 20, sonra 25, sonra 30
- Far aç, far kapat
- Kilitle, kilit aç
- Aynı aksiyonu **2-3 kez** tekrarla (şifre deterministik mi, her seferinde aynı
  byte mı çıkıyor anlamak için).

Sonra yeni `btsnoop_hci.log`'u bana ver; `parse_btsnoop.py` ile komutları çıkarıp
şu soruyu yanıtlarız: **Aynı aksiyon her seferinde aynı byte'ları mı üretiyor?**
- **Evet** → şifre sabit/ECB; aksiyon↔byte haritası çıkarılabilir, replay çalışır.
- **Hayır** → oturum anahtarı/nonce var; APK analizi gerekir (adım B).

### B) APK analizi (şifre kırılması gerekirse)
Orijinal uygulamanın `.apk`'sını ver; `jadx` ile decompile edip BLE yazma yapan
sınıfı, şifreleme anahtarını ve çerçeve formatını çıkarırız. Ninebot türevlerinde
anahtar genelde cihaz seri no / sabit bir anahtar + handshake'ten türetilir.

## 5. Uygulamaya işlenenler
- `ducati-app/src/config.ts`: gerçek UUID'ler girildi (FFF0/FFF7/FFF6).
- Komut byte'ları ve checksum **henüz girilmedi** — şifre çözülünce girilecek.
