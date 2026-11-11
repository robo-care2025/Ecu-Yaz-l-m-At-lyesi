# Donanım rehberi

> **Güvenlik:** 36 V'luk paket kısa devrede yüzlerce amper verir. Her bağlantıyı
> batarya soketi **çıkarılmışken** yapın, açık uçları makaronla kapatın, paketin
> içini (hücreleri, BMS kartını) açmanız bu prototip için **gerekmiyor**.

## Neden harici ölçüm modülü?

Ducati Pro 1'in BMS'inde Bluetooth yok ve BMS ile kontrol kartı arasındaki
haberleşme (varsa) hiçbir yerde belgelenmemiş. Bu yüzden iki yoldan ilerliyoruz:

| Yol | Ne yapar | Durum |
|---|---|---|
| **A. Harici ölçüm modülü** | Bataryanın çıkış kablosuna araya girer; voltaj, akım, sıcaklık ölçer | Yazılımı hazır, donanımı kurulacak |
| **B. BMS veri hattını dinleme** | BMS veri yolluyorsa hücre voltajlarını da okuruz | Önce hat var mı diye bakılacak |

A yolu **her marka bataryada** çalışır; ticari ürün için asıl değerli olan bu.
B yolu varsa üstüne ek bilgi (hücre dengesi) kazandırır.

## A. Ölçüm modülü

### Malzeme

| Parça | Not |
|---|---|
| ESP32 DevKit (WROOM-32) | USB + Bluetooth |
| INA226 modülü | Üstündeki **R100 direnç sökülecek** (0.1 Ω, sadece 0.8 A ölçer) |
| Şönt direnç 20 A / 75 mV | 0.00375 Ω. Scooter kalkışta 15 A civarı çeker |
| Direnç 30 kΩ ve 10 kΩ (%1) | Voltaj bölücü. INA226 en fazla 36 V ölçer, dolu paket 42 V |
| NTC 10 kΩ (B3950) + 10 kΩ direnç | Sıcaklık; isteğe bağlı |
| Ara kablo | Scooterın batarya soketinin erkeği + dişisi (paketi kesmemek için) |

### Bağlantı

Şönt **eksi (−) hatta**, batarya ile scooter arasına girer. Artı hat kesilmez.

```
 BATARYA (+) ───────────────┬──────────────────────────── SCOOTER (+)
                            │
                          [30k]
                            ├───────────► INA226  VBUS
                          [10k]
                            │
 BATARYA (−) ──┬────────────┴──[ ŞÖNT ]───────┬────────── SCOOTER (−)
               │               │      │
               │               │      └──────► INA226  IN−   (scooter tarafı)
               │               └─────────────► INA226  IN+   (batarya tarafı)
               └─────────────────────────────► INA226 GND = ESP32 GND

 ESP32 3V3  ──► INA226 VCC          ESP32 GPIO21 ──► INA226 SDA
                                    ESP32 GPIO22 ──► INA226 SCL

 Sıcaklık:  ESP32 3V3 ──[10k]──┬── GPIO34
                               └──[NTC]── GND     (NTC paketin dışına bantlanır)
```

Dikkat edilecekler:

1. **30 kΩ direnç batarya artısına en yakın noktada olsun.** Böylece ince ölçüm
   kablosu kısa devre olsa bile akım 1,4 mA'i geçemez.
2. **ESP32'nin GND'si bataryanın eksisine bağlı.** Prototipte ESP32'yi dizüstü
   bilgisayarın USB'sinden besleyin ve o sırada dizüstü **pilde çalışsın**
   (şarj adaptörü takılı olmasın). Kalıcı üründe izolasyon/DC-DC eklenecek.
3. **Şarj akımı da şönt üzerinden geçmeli.** Şarj soketi bataryaya ayrı bir
   kabloyla gidiyorsa şarj akımını göremeyiz; o durumda şöntü paketin ana eksi
   çıkışına, iki kablonun birleştiği yere koymak gerekir. Açınca fotoğraf atın,
   birlikte bakalım.

### Yazılımı yükleme ve ayar

1. Arduino IDE → Kart: **ESP32 Dev Module** → `firmware/batarya_olcer/batarya_olcer.ino` yükle.
2. Seri Monitör (115200): `{"t":...,"v":...,"i":...}` satırları akmalı.
3. **Voltaj ayarı:** Multimetre ile paket voltajını ölçün. Fark varsa koddaki
   `VOLTAJ_BOLUCU` değerini `eski × (multimetre / ekrandaki)` ile düzeltin.
4. **Akım yönü:** Tekeri havada gaza basın; akım **eksi** olmalı. Artıysa
   `AKIM_YONU = -1.0` yapın.
5. **Sıfır kontrolü:** Scooter kapalıyken akım ±0,05 A içinde olmalı.

> Bu yazılım henüz gerçek kartta denenmedi; ilk kurulumda çıkan hatayı/ekranı
> bana gönderin, düzeltelim.

## B. BMS veri hattı var mı?

1. Batarya soketine bakın: iki kalın kablo (+/−) dışında **ince kablo** var mı?
   Kaç tane, ne renk? Fotoğrafını çekin.
2. Scooter açıkken her ince kablonun batarya eksisine göre voltajını ölçün.
   - 0 V veya sabit 3,3 / 5 V görünür ama multimetre AC kademesinde ya da
     osiloskopta oynama varsa → veri hattı olabilir.
   - Sabit ~36–42 V → bu veri değil, besleme/uyandırma hattıdır. **Bağlamayın.**
3. Veri hattı adayı için USB-TTL adaptör (CP2102 / CH340, 3,3 V):
   - Adaptör **GND** → batarya eksisi
   - Adaptör **RX** → ince kablo (hat 5 V ise araya 10k/20k bölücü)
   - Adaptör **TX → hiçbir yere bağlanmaz**
4. `python araclar/uart_dinleyici.py COM7` çalıştırın, çıktıyı bana gönderin.

İnce kablo hiç yoksa BMS "sessiz" tiptir; A yolu ile devam ederiz, kayıp yok.
