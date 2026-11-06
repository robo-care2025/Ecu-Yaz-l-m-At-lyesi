# DUCATI EVO — BLE Protokol Notları (çözüm sürüyor)

## Cihaz
- Reklam adı: **DUCATI EVO**
- MAC: `04:39:32:37:3F:43`
- Bağlantı: BLE, bonding YOK (pairing gerekmiyor)
- Ana MCU: Nuvoton (programlayıcı ile girilmiyor → protokol yolu)

## GATT (custom service FFF0 ailesi)
| UUID | Özellik | Rol (çalışma varsayımı) |
|------|---------|--------------------------|
| FFF7 | NOTIFY, READ | Telemetri / cevap akışı |
| FFF6 | READ, WRITE, WRITE_NR | Komut yazma (?) |
| FFF1 | READ, WRITE, WRITE_NR | Ayar/komut (?) |
| FFF2 | READ, WRITE, WRITE_NR | Ayar/komut (?) |
| (FFF3/4/5 ?) | ? | taranacak |
| CCCD 0x2902 | - | notify aç/kapat |

## FFF7 yakalanan kareler (16 bayt, LE)
```
idx:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
A  : 5A B9 25 01 61 0A 00 00 64 07 00 28 06 00 02 95   (11:34)
B  : 5A B9 00 00 61 0A 00 00 64 07 00 20 00 00 28 95   (11:33)
```
- Başlık sabit: `5A B9`
- Değişen baytlar (canlı): idx2-3, idx11, idx12, idx14
- Sabit baytlar: idx4-5 (`0A61`=2657), idx8-9 (`0764`=1892), idx15 (`95`)
- **✅ KESİNLEŞTİ: toplam km = idx4-5, little-endian, ×10.**
  - Ekran 265.7 iken kare `61 0A` = 0x0A61 = 2657 → 2657/10 = 265.7 ✓
  - Yazma hedefi: `ham = round(km * 10)`, 2 bayt LE (örn. 265.7 → 2657 → `61 0A`)
- idx8-9 (`0764`=1892) → ayrı bir sayaç (henüz belirsiz; km değil)
- idx15=95 sabit; basit toplam-checksum değil gibi (write checksum HCI/APK'dan gelecek)

## Açık sorular / sıradaki adımlar
1. [x] Ekranda yazan gerçek km → **km = idx4-5, LE, ×10 (DOĞRULANDI)**
2. [ ] Tüm karakteristikleri READ ile oku (FFF1/FFF2/FFF6 + varsa FFF3/4/5)
3. [ ] Primary service UUID'sini doğrula (muhtemelen 0xFFF0)
4. [ ] Kontrollü telemetri: dururken vs tekerlek dönerken kareler
5. [ ] HCI log: uygulamanın km sorgu/komut formatı + checksum
6. [ ] km yazma komutunu bul → test cihazında doğrula
7. [ ] 07_servis.py: PIN + log + güvenli km eşitleme
