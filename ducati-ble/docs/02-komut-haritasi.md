# Komut Haritası (şablon)

Protokolü çözdükçe burayı doldur. Bu tablo, `tools/send.py` ile göndereceğin
komutların referansı olur.

## Bağlantı bilgileri
| Alan | Değer |
|---|---|
| Cihaz adı | _(scan.py çıktısı)_ |
| BLE adres | _(örn. AA:BB:CC:DD:EE:FF)_ |
| Write karakteristik UUID | _(enumerate.py: [write] olan)_ |
| Notify karakteristik UUID | _(enumerate.py: [notify] olan)_ |
| Header (sabit önek) | _(örn. 5A A5)_ |
| Checksum yöntemi | _(checksum.py --verify sonucu)_ |

## Telefon → Scooter komutları (Write)
| Aksiyon | Yakalanan tam paket (hex) | Değişen arg byte | Not |
|---|---|---|---|
| ECO moduna geç | | | |
| COMFORT moduna geç | | | |
| SPORT moduna geç | | | |
| PEDESTRIAN moduna geç | | | |
| Hız limiti = 20 | | | |
| Hız limiti = 25 | | | |
| Hız limiti = 30 | | | |
| Far aç | | | |
| Far kapat | | | |
| Kilitle | | | |
| Kilit aç | | | |

## Scooter → Telefon telemetri (Notify)
monitor.py ile çöz. Hangi byte neyi taşıyor:
| Byte indeksi | Anlamı | Ölçek/format | Not |
|---|---|---|---|
| | Hız | örn. değer/100 = km/h | |
| | Batarya % | | |
| | Mod | 0=ped,1=eco,2=comfort,3=sport? | |
| | Hata kodu | | |

## Örnek kullanım (çözümden sonra)
```bash
# Hız limitini 25 yap (kendi çözdüğün paketle):
python tools/send.py <ADRES> \
  --char <WRITE_UUID> --notify <NOTIFY_UUID> \
  --hex "5a a5 01 20 02 19 .. .."
```
