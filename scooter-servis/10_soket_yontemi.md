# Soket Yöntemi — MCU'yu yalıtıp güvenli oku/yaz

## Neden bu yöntem
In-circuit ICP (klips/pad ile, kart besliyken) bu kartta **sürekli çöp okuma**
verdi ve bir ekranı bozduk. Sebep: kart üzerindeki diğer devrelerin ICP
hatlarını yüklemesi + kötü temas. **Çözüm: çipi karttan söküp TSSOP20 soketinde,
yalıtılmış şekilde, SADECE Nu-Link besleyerek okumak.** Temiz, tekrarlanabilir.

## Durum / dersler
- Çip: **MS51FB9AE** (TSSOP20). **Security Lock KAPALI** → okunabilir/yazılabilir.
- ICP pinleri: nRESET=pin4, ICPDA(DAT)=pin8, ICPCK(CLK)=pin18, VDD=pin9, VSS=GND(teyit edilecek).
- Nu-Link IO Voltage = **5.0V** (MCU 5V çalışıyor).
- ⚠️ 1kΩ pull-up ÇOK güçlü (DAT'ı kilitler); gerekiyorsa **100kΩ**.
- ⚠️ "Erase/Erase Whole Chip" kutuları + "Start" = SİLER. Okurken kapalı tut.
- **265.7'li çalışan ekran = tek sağlam referans. Riskli setup'la DOKUNMA.**

## Gereken malzeme
- **TSSOP20 (0.65mm pitch) programlama soketi/adaptörü** (ZIF/kelepçeli, DIP'e
  çıkışlı). Arama: "TSSOP20 0.65 programming socket adapter", "SOP20 to DIP ZIF".
- Sıcak hava (hot air) istasyonu + flux + cımbız (sökme için). Yoksa havya + şrink tel.
- Nu-Link'ten sokete **kısa** teller.

## Fazlar

### Faz 1 — Soketi doğrula (ÖLÜ çip ile, sıfır risk)
1. **Ölü (0 km) ekranın MCU'sunu sök** — zaten bozuk, kaybedecek bir şey yok, pratik olur.
2. Sokete tak, Nu-Link bağla (VDD=9, GND, RST=4, DAT=8, CLK=18), 5.0V.
3. Oku → **checksum 2 okumada AYNI mı?** (Soket temizse artık stabil olmalı.)
   - Stabil + 0x0000'da `02…` veya temiz FF → soket yöntemi ÇALIŞIYOR ✅
   - Bu ayrıca ölü çip gerçekten silinmiş mi (temiz FF) gösterir.

### Faz 2 — Çalışan firmware'i temiz oku
- **En güvenlisi:** aynı modelden **yeni/çalışan bir ekran** al, ONUN MCU'sunu
  soketle temiz oku → gerçek firmware + km verisi. (265 referansını sökme riskine atma.)
- Alternatif: 265 MCU'sunu sök, oku, geri lehimle (riskli — son çare).

### Faz 3 — km'nin yerini bul
- Temiz dump'ta bilinen km'yi ara (örn. 2657 = 0x0A61).
- Kesinleştirmek için: km=X oku → km'yi değiştir → km=Y oku → diff (03_dump_karsilastir.py).
- Data-flash kodlamasını netleştir (önceki "garip" baytlar aslında bozuk okumaydı).

### Faz 4 — yeni ekrana km yaz
- km adresi/kodlaması belli olunca: yeni ekranı oku → km baytlarını değiştir →
  yaz → doğrula. (Önce tam yedek!)

## Altın kural
**Her işten önce DOĞRULANMIŞ yedek** (0x0000'da gerçek kod + stabil checksum).
Yedek doğrulanmadan ASLA yazma/erase yok.
