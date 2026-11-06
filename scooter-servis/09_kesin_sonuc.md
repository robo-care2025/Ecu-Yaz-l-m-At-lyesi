# KESİN SONUÇ — km (odometre) değiştirme araştırması

**Soru:** Ducati EVO'da km (toplam yol) BLE ile değiştirilebilir mi?
**Cevap:** **HAYIR.** km, BLE protokolünde yalnızca OKUNUR; yazan komut yoktur.
Bu sonuç 3 bağımsız kaynakla kesinleşti.

## Kanıtlar (3 bağımsız kaynak aynı sonuçta)

1. **Kendi testlerimiz (nRF Connect):** FFF1/2/3'e yazmak km'yi değiştirmedi;
   FFF6 sadece mod/far/kilit komutlarını kabul etti.
2. **PR #1 (önceki oturum RE):** komut çerçevesi çözüldü → sadece mod/far/kilit/
   cruise. km komutu yok.
3. **Sentinel uygulaması** (github.com/davidebilardello/Sentinel) — bu protokolü
   **birebir** çözmüş bağımsız, tam bir uygulama. Kodu açıkça gösteriyor:
   - Aynı çerçeve + checksum (hatta not düşmüş: *"APK mtd.jeep.app 1.13.4,
     modulo 3322 Kcq: aynı frame, aynı checksum"* → bu kontrolcü **Ducati, Jeep
     ve başka markalarda** ortak; "YouFS" platformu).
   - **Yazılabilir ayarların TAM listesi:** `LIGHTS, GEAR, CRUISE, ZERO_START,
     UNIT, LOCK` — **odometre/km YOK.**
4. **scooter-tuning-db** (topluluk register veritabanı): hiçbir scooter için
   odometre-yazma register'ı yok.

## Doğrulanan telemetri (16 bayt, LE, başlık 5A B9, son 95)
| idx | alan | ölçek |
|---|---|---|
| 2-3 | hız | ÷10 km/h |
| **4-5** | **toplam km (odometre)** | **÷10** → `61 0A`=2657=**265.7** ✓ |
| 6-7 | trip (oturum km) | ÷10 |
| 8 | batarya | % |
| 9 | bayraklar | gear(bit0-1), far 0x10, cruise 0x04, zero-start 0x08, mph 0x40, kilit 0x80 |
| 10 | arıza kodları | bit alanı |
| 11 | kontrolcü durumu | bit alanı |
| 12-13 | sürüş süresi | ham |

## Doğrulanan komut (8 bayt, char FFF6)
```
CA AC BD [d1] [d2] [xor] [d1+0xBD+xor] 6A
  xor = 0xBD ^ d1 ^ d2
  d1 = (gear==SPORT? 4 : 0)
  d2 = (gear>=2? 1 : 0) | ayar_maskesi
  maskeler: far 0x18, cruise 0x02, zero-start 0x04, birim(km/mil) 0x20, kilit 0x40
```

## Neden km yazılamıyor?
km değeri **ekranın Nuvoton MCU'sunun iç hafızasında** saklı ve firmware bunu
dışarıya (BLE) yazma olarak AÇMIYOR. Hiçbir uygulama (orijinal dahil) yapamaz,
çünkü komut yok. Yeni ekran 0 göstermesi de bunu doğruluyor (değer ekranda).

## Geriye kalan TEK teknik yol: Nu-Link ile MCU
- Nuvoton'u Nu-Link ile **oku** → flash kilitli değilse:
  - 265.7'li ve 0'lı ekranları oku → `03_dump_karsilastir.py` + `04_deger_ara.py`
    ile km adresini bul → istediğin km'yi yaz (bkz. `08_nulink_workflow.md`).
- flash **okuma-korumalı** ise → bu yol da kapalı → yasal belgeleme.

## Yasal yol (teknik çözüm olmazsa)
Ekranı tak, "ekran X km'de değişti" diye belgele + alıcıya bildir. Odometre
değişiminde yasa zaten bunu ister.

## Yan kazanç
Doğrulanan komut + telemetri haritası = çalışır bir **BLE servis/kontrol
uygulaması** için yeterli (mod/far/kilit/cruise/birim + canlı km/hız/batarya/
arıza). km'den bağımsız, satılabilir ürün (bkz. PR #1).
