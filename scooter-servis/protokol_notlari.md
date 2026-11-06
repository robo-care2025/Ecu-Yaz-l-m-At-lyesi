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
- idx8-9 veya idx4-5 → **toplam km adayı** (ekran km'si ile eşleştirilecek)
- idx15=95 sabit; basit toplam-checksum değil gibi (daha çok veri lazım)

## Açık sorular / sıradaki adımlar
1. [ ] Ekranda yazan **gerçek km** → km baytını kesinleştir
2. [ ] Tüm karakteristikleri READ ile oku (FFF1/FFF2/FFF6 + varsa FFF3/4/5)
3. [ ] Primary service UUID'sini doğrula (muhtemelen 0xFFF0)
4. [ ] Kontrollü telemetri: dururken vs tekerlek dönerken kareler
5. [ ] HCI log: uygulamanın km sorgu/komut formatı + checksum
6. [ ] km yazma komutunu bul → test cihazında doğrula
7. [ ] 07_servis.py: PIN + log + güvenli km eşitleme
