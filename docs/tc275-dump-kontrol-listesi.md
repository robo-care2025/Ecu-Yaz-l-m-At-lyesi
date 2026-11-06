# TC275 Dump Alma ve Doğrulama Kontrol Listesi

Infineon **TC275TP (AURIX / TriCore)** tabanlı bir kontrol ünitesinden
flash yedeği (dump) almak ve yedeğin güvenilirliğini doğrulamak için
adım adım kontrol listesi.

> **Önemli:** Bu belge donanım/elektronik servis işçiliği içindir.
> Her adımda yetkiniz ve yedeğiniz olduğundan emin olun. Yedeksiz
> hiçbir yazma/silme işlemi yapmayın.

---

## 0. Yanlış anlaşılmalar (önce bunu okuyun)

- Kart üzerindeki **`STM-5 / 94V-0 / E207844`** yazısı bir çip değildir;
  PCB laminatının **UL malzeme damgasıdır**. STMicroelectronics ile ilgisi yoktur.
- Bu yüzden **ST-Link bu kartta çalışmaz.** ST-Link yalnızca STM32/STM8
  (ARM / SWD) içindir. TC275 bir **TriCore** çipidir ve **DAP** arayüzü kullanır.

---

## 1. Gerekli donanım ve yazılım

- [ ] **DAP debugger:** Infineon **DAP miniWiggler** (önerilen) veya TriCore
      destekleyen J-Link / PLS UDE / iSYSTEM / Lauterbach.
- [ ] **Yazılım:** Infineon **MemTool** (ücretsiz) veya debugger'ın kendi aracı.
- [ ] **Akım sınırlamalı laboratuvar güç kaynağı** (0–30V, akım limiti ayarlı).
- [ ] Multimetre (süreklilik/diyot modu), büyüteç/mikroskop, ince prob uçları.
- [ ] Antistatik bileklik ve mat (ESD koruması).
- [ ] İnce uçlu lehim/temizlik için izopropil alkol (vernik için).

---

## 2. Çip ve datasheet teyidi

- [ ] Ana QFP çipin üstündeki **tam kod satırını** okuyun
      (ör. `TC275TP-64F200...`). Devam eden karakterler doğru datasheet'i belirler.
- [ ] Infineon TC27x **Data Sheet**'inden şu pinlerin numaralarını not edin:
  - [ ] `DAP0` (TCK hattı)
  - [ ] `DAP1` (TMS hattı)
  - [ ] `ESR0` (reset)
  - [ ] `VDDP` (3,3V çevre beslemesi)
  - [ ] `VSS` (GND)

---

## 3. Bağlantı noktasını (CN26) ölçerek bulma — KART ENERJİSİZKEN

Multimetre süreklilik modunda, CN26 pedlerini tek tek doğrulayın:

- [ ] **GND:** büyük kondansatörün (–) bacağına / şasi düzlemine bip veren ped.
- [ ] **VDDP (~3,3V):** MCU yakınındaki regülatör çıkışına süreklilik veren ped.
- [ ] **ESR0/Reset:** datasheet'teki reset pinine süreklilik veren ped
      (genelde 3,3V'a pull-up dirençli görünür).
- [ ] **DAP0 / DAP1:** kalan iki sinyal pedini ilgili QFP bacaklarına
      süreklilik ile eşleştirin. Bacağı büyüteçle sayıp izi takip edin.
- [ ] Bulduğunuz eşleşmeyi bir kağıda/tabloya yazın (yanlış bağlantı riskini azaltır).

| CN26 ped | Ölçülen sinyal | Not |
|---------:|----------------|-----|
|        1 |                |     |
|        2 |                |     |
|        3 |                |     |
|        4 |                |     |
|        5 |                |     |
|        6 |                |     |

---

## 4. Besleme

- [ ] Güç kaynağını **akım limiti 0,3–0,5A** ile ayarlayın.
- [ ] Ana besleme (12V/24V) veya doğrudan 3,3V lojik hattını verin.
- [ ] İlk enerjide akımın makul olduğunu doğrulayın (anormal yüksek = kısa devre riski, kesin).
- [ ] Debugger'ın **VREF** ucunu kartın **3,3V** hattına bağlayın (seviye uyumu şart).

---

## 5. Bağlantı testi (yazma YOK)

- [ ] MemTool/araçta hedef olarak **TC275** seçin.
- [ ] **Sadece bağlan + Device ID oku** yapın.
- [ ] ID okunuyorsa pinleri doğru buldunuz demektir. Okunmuyorsa:
  - [ ] GND/VREF bağlantısını kontrol edin,
  - [ ] DAP0/DAP1 yerlerini değiştirip deneyin,
  - [ ] reset hattını kontrol edin.

---

## 6. Okuma koruması (read-out protection) kontrolü

- [ ] Araçta flash okunabiliyor mu, yoksa "protected/locked" mı kontrol edin.
- [ ] **Kilitliyse:** UCB (User Configuration Block) şifre denemesi YAPMAYIN.
      Yanlış deneme çipi **kalıcı kilitler**. Bu durumda profesyonel ECU
      cihazı/servisi gerekir.
- [ ] Kilit yoksa okumaya geçin.

---

## 7. Okuma (dump)

- [ ] **PFLASH** (program flash, ~4 MB) bölgesini okuyup kaydedin:
      `pflash_01.bin`
- [ ] **DFLASH** (data flash / EEPROM emülasyonu, ~384 KB) bölgesini okuyup kaydedin:
      `dflash_01.bin`
- [ ] İsterseniz tam adres aralığını tek dosyaya da alın: `full_01.bin`
- [ ] **İkinci kez okuyun:** `pflash_02.bin`, `dflash_02.bin`.

---

## 8. Doğrulama (bu depodaki araçla)

İki okumanın aynı olduğunu ve dosyaların sağlam olduğunu doğrulayın:

```bash
# Özet bilgi
python3 tools/ecudump.py info pflash_01.bin

# İki okumayı karşılaştır (aynı olmalı)
python3 tools/ecudump.py compare pflash_01.bin pflash_02.bin

# Sağlama değerleri (yedek arşivine kaydedin)
python3 tools/ecudump.py checksum pflash_01.bin
python3 tools/ecudump.py checksum dflash_01.bin
```

- [ ] `compare` çıktısı **"IDENTICAL"** diyor mu? Demiyorsa okuma kararsız;
      besleme/temas sorunudur, tekrar okuyun.
- [ ] Checksum değerlerini (CRC32/SHA256) yedek klasörünün yanına bir
      `.txt` dosyasına yazın.

---

## 9. Yedeği arşivleme

- [ ] Dosyaları tarih + kart bilgisiyle adlandırın:
      `2026-11-06_TC275_BMU_pflash.bin`
- [ ] En az **iki ayrı yerde** saklayın.
- [ ] Checksum dosyasını yedekle birlikte tutun.

---

## 10. Kritik kurallar (özet)

1. Yedek almadan **asla** yazma/silme yapma.
2. Klipsi/probu her zaman **enerjisizken** tak-çıkar.
3. İlk enerjide **akım sınırlaması** kullan.
4. Kilitli çipte **UCB'ye dokunma**.
5. Her okumayı **iki kez** yapıp `compare` ile doğrula.
