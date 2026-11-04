# TAM ÇÖZÜM — Ducati PRO-I EVO BLE protokolü

Üç btsnoop yakalamasıyla protokol tamamen çözüldü. Komutlar sabit (replay güvenli),
şifreleme yok. Aşağısı referans tablodur.

## GATT
| Rol | UUID | handle |
|---|---|---|
| Servis | `0xFFF0` | — |
| Telemetri (notify) | `0xFFF7` | `0x10` (CCCD `0x11`) |
| Komut (write/write-no-resp) | `0xFFF6` | `0x14` |

## KOMUT çerçevesi (telefon → scooter, 8 byte)
```
ca ac bd [B3] [B4] [CK5] [CK6] 6a
  CK5 = (B3 XOR B4 XOR 0xBD) & 0xFF
  CK6 = (CK5 + B3 - 0x43) & 0xFF
```
7 farklı komutta doğrulandı (`tools/ducati_codec.py`). Komut, hedef **durumun
mutlak yansımasıdır**: `(B3,B4)` mod tabanını taşır, bayraklar `B4`'e OR'lanır.

### Mod (= hız limiti) — ABSOLUTE komutlar
| Mod | Komut | Hız |
|---|---|---|
| **ECO** (mod 1) | `ca ac bd 00 00 bd 7a 6a` | en düşük |
| **COMFORT** (mod 2) | `ca ac bd 00 01 bc 79 6a` | orta |
| **SPORT** (mod 3) | `ca ac bd 04 01 b8 79 6a` | en yüksek |

> PEDESTRIAN moduna uygulamadan geçilemiyor (sadece scooter üzerinden).
> Mod tabanları: ECO=(B3 0x00,B4 0x00), COMFORT=(0x00,0x01), SPORT=(0x04,0x01).

### Bayraklar (aktif modun B4'üne OR'lanır)
| Bayrak | B4 biti | Örnek (mod3) |
|---|---|---|
| Cruise | `0x02` | `ca ac bd 04 03 ba 7b 6a` |
| Far | `0x18` | `ca ac bd 04 19 a0 61 6a` |
| Kilit | `0x40` | `ca ac bd 04 41 f8 b9 6a` |

Örn mod1 + kilit = `ca ac bd 00 40 fd ba 6a` (capture 2). far/cruise sadece mod3'te
yakalandı; mod1/2'de aynı bit mantığı beklenir, replay ile doğrula.

## TELEMETRİ çerçevesi (scooter → telefon, 16 byte)
```
5a b9 [SPL] 00 24 00 00 00 64 [STATE] 00 [F11] [SPH] 00 [CK] 95
  STATE (idx9): alt nibble=mod(1/2/3), bit0x04=cruise, bit0x10=far, bit0x80=kilit
  CK (idx14) = (STATE + 0x60) & 0xFF
  HIZ = SPL(idx2) + SPH(idx12)*256   (16-bit; ölçek kalibre edilmeli)
  F11 (idx11): 0x20/0x28 (0x08 biti hareket göstergesi gibi)
```
STATE doğrulandı; hız ham değeri doğrulandı (0..~0x2fa arası düzgün arttı),
km/h ölçeği bir referans noktasıyla kalibre edilmeli.

## Doğrulama
`tools/ducati_codec.py`: tüm 6+1 yakalanmış komutu birebir üretti, hepsinin
checksum'ı tuttu. `ducati-app` kodu (protocol.ts/config.ts/telemetry.ts) aynı
modeli kullanıyor ve `tsc --strict` ile temiz.

## Uygulamada
- Mod butonları (ECO/COMFORT/SPORT) = hız limiti değiştirir.
- Kilit / Far / Cruise anahtarları (aktif moda OR'lanarak gönderilir).
- Canlı telemetri: mod, kilit, far, cruise, ham hız.
- Ham komut test kutusu (checksum doğrulamalı).

## Kalan (opsiyonel)
- Hız km/h ölçeğini kalibre et (sabit hızda telemetri ham değerini bilinen km/h
  ile karşılaştır → SPEED_SCALE).
- mod1/mod2'de far/cruise/kilit kombinasyonlarını replay ile doğrula.
