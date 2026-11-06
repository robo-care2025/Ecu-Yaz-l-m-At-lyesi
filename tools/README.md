# tools/ecudump.py

ECU flash yedegi (dump) inceleme ve dogrulama araci. Infineon **TC275**
ve benzeri otomotiv MCU'larindan alinan `.bin` yedekleri icindir.

- Harici bagimlilik **yok** (sadece Python 3 standart kutuphanesi).
- Dosyalari **degistirmez**; sadece okur/raporlar (yalniz `split` yeni
  dosyalar olusturur).

## Hizli kullanim

```bash
python3 tools/ecudump.py info     pflash_01.bin                 # ozet bilgi
python3 tools/ecudump.py compare  pflash_01.bin pflash_02.bin   # iki okuma ayni mi?
python3 tools/ecudump.py checksum pflash_01.bin                 # CRC32/CRC16/SUM/MD5/SHA256
python3 tools/ecudump.py hexdump  pflash_01.bin --offset 0x100 --length 256
python3 tools/ecudump.py strings  dflash_01.bin --min 5         # ASCII metinler
python3 tools/ecudump.py split    full.bin --map tc275 --out ./parcalar
```

## Komutlar

| Komut | Ne yapar |
|-------|----------|
| `info` | Boyut, bos (0xFF) orani, entropi, CRC32, SHA256; boyutun 2'nin kati olup olmadigi |
| `checksum` | CRC32, CRC16-CCITT, SUM16, SUM32, MD5, SHA256 (bolge secilebilir) |
| `hexdump` | Secilen bolgenin hex + ASCII dokumu |
| `compare` | Iki yedegi byte byte karsilastirir; **IDENTICAL** mi, degilse farkli bolgeleri listeler |
| `split` | Tam dump'i bellek haritasina gore `pflash.bin` / `dflash.bin` olarak ayirir |
| `strings` | Icindeki okunabilir ASCII metinleri (adresiyle) listeler |

Offset/uzunluk degerleri `0x1000`, `4096`, `1k`, `1m` bicimlerinde yazilabilir.

## Tipik is akisi

1. Ayni bolgeyi **iki kez** okuyun (`pflash_01.bin`, `pflash_02.bin`).
2. `compare` ile ikisinin **IDENTICAL** oldugunu dogrulayin.
3. `checksum` ciktilarini yedek arsivinin yanina kaydedin.

Ayrintili donanim adimlari icin: [`../docs/tc275-dump-kontrol-listesi.md`](../docs/tc275-dump-kontrol-listesi.md)

## Notlar

- `split` icindeki TC275 adresleri **yaklasiktir**; tam adresler cipin
  siparis koduna gore degisebilir, datasheet ile dogrulayin.
- `compare` cikis kodu: ayni ise `0`, farkli/boyut uyusmazsa `1`
  (betiklerde kullanilabilir).
