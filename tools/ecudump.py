#!/usr/bin/env python3
"""
ecudump.py — ECU flash yedegi (dump) inceleme ve dogrulama araci.

Infineon TC275 (AURIX / TriCore) ve benzeri otomotiv MCU'larindan alinan
.bin yedeklerini incelemek icin yazilmistir. Harici bagimlilik yoktur
(yalnizca Python 3 standart kutuphanesi).

Komutlar:
  info      Dosya hakkinda ozet bilgi (boyut, bosluk orani, entropi vb.)
  hexdump   Secilen bolgenin hex + ASCII dokumu
  checksum  Cesitli saglama degerleri (CRC32, CRC16, sum, MD5, SHA256)
  compare   Iki yedegi karsilastirir (ayni okuma mi kontrolu)
  split     Tam dump'i PFLASH/DFLASH gibi bolgelere ayirir
  strings   Icindeki okunabilir ASCII metinleri listeler

Ornekler:
  python3 tools/ecudump.py info pflash_01.bin
  python3 tools/ecudump.py compare pflash_01.bin pflash_02.bin
  python3 tools/ecudump.py checksum pflash_01.bin
  python3 tools/ecudump.py hexdump pflash_01.bin --offset 0x1000 --length 256
  python3 tools/ecudump.py split full.bin --map tc275
  python3 tools/ecudump.py strings dflash_01.bin --min 5
"""

import argparse
import hashlib
import math
import os
import sys
import zlib

# ---------------------------------------------------------------------------
# Bilinen bellek haritalari (bilgi amacli; tam adresler sipariş koduna gore
# degisebilir, dogrulamak icin ilgili datasheet'e bakin).
# Her bolge: (ad, baslangic_adresi, boyut)
# ---------------------------------------------------------------------------
MEMORY_MAPS = {
    # Infineon TC275TP: 4 MB PFLASH + 384 KB DFLASH (yaklasik degerler)
    "tc275": [
        ("PFLASH", 0xA0000000, 4 * 1024 * 1024),
        ("DFLASH", 0xAF000000, 384 * 1024),
    ],
}


def human(n):
    """Byte sayisini okunabilir hale getirir. Ornek: 4096 -> '4096 (4.0 KB)'."""
    if n < 1024:
        return f"{n} B"
    size = float(n)
    for unit in ("KB", "MB", "GB", "TB"):
        size /= 1024
        if size < 1024 or unit == "TB":
            return f"{n} ({size:.1f} {unit})"
    return f"{n}"


def read_file(path):
    if not os.path.isfile(path):
        sys.exit(f"HATA: dosya bulunamadi: {path}")
    with open(path, "rb") as f:
        return f.read()


def parse_int(s):
    """0x10, 16, 1k, 1m gibi degerleri byte sayisina cevirir."""
    if s is None:
        return None
    s = str(s).strip().lower()
    mult = 1
    if s.endswith("k"):
        mult, s = 1024, s[:-1]
    elif s.endswith("m"):
        mult, s = 1024 * 1024, s[:-1]
    base = 16 if s.startswith("0x") else 10
    return int(s, base) * mult


# ---------------------------------------------------------------------------
# Saglama / checksum fonksiyonlari
# ---------------------------------------------------------------------------
def crc16_ccitt(data, poly=0x1021, init=0xFFFF):
    crc = init
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ poly) & 0xFFFF if (crc & 0x8000) else (crc << 1) & 0xFFFF
    return crc


def sum16(data):
    """16-bit toplam (otomotivde sik kullanilan basit checksum)."""
    total = sum(data) & 0xFFFF
    return total


def sum32(data):
    return sum(data) & 0xFFFFFFFF


def entropy(data):
    """Shannon entropisi (0-8 bit/byte). ~8 = sifreli/sikistirilmis,
    dusuk = bos/tekrarli alan."""
    if not data:
        return 0.0
    counts = [0] * 256
    for b in data:
        counts[b] += 1
    n = len(data)
    e = 0.0
    for c in counts:
        if c:
            p = c / n
            e -= p * math.log2(p)
    return e


# ---------------------------------------------------------------------------
# Komutlar
# ---------------------------------------------------------------------------
def cmd_info(args):
    data = read_file(args.file)
    n = len(data)
    ff = data.count(0xFF)
    zero = data.count(0x00)
    print(f"Dosya        : {args.file}")
    print(f"Boyut        : {human(n)}")
    print(f"0xFF (bos)   : {ff} (%{100*ff/n:.1f})" if n else "0xFF: -")
    print(f"0x00         : {zero} (%{100*zero/n:.1f})" if n else "0x00: -")
    print(f"Entropi      : {entropy(data):.3f} bit/byte  (8.0 = tam rastgele)")
    print(f"CRC32        : {zlib.crc32(data) & 0xFFFFFFFF:08X}")
    print(f"SHA256       : {hashlib.sha256(data).hexdigest()}")
    # 2'nin kati mi (tam flash okuma genelde oyle olur)
    is_pow2 = n > 0 and (n & (n - 1)) == 0
    print(f"2'nin kati mi: {'evet' if is_pow2 else 'HAYIR (eksik okuma olabilir)'}")


def cmd_checksum(args):
    data = read_file(args.file)
    off = parse_int(args.offset) or 0
    length = parse_int(args.length)
    region = data[off: off + length] if length else data[off:]
    print(f"Dosya   : {args.file}")
    print(f"Bolge   : offset=0x{off:X}, boyut={len(region)} byte")
    print(f"CRC32   : {zlib.crc32(region) & 0xFFFFFFFF:08X}")
    print(f"CRC16   : {crc16_ccitt(region):04X}  (CCITT, init=0xFFFF)")
    print(f"SUM16   : {sum16(region):04X}")
    print(f"SUM32   : {sum32(region):08X}")
    print(f"MD5     : {hashlib.md5(region).hexdigest()}")
    print(f"SHA256  : {hashlib.sha256(region).hexdigest()}")


def cmd_hexdump(args):
    data = read_file(args.file)
    off = parse_int(args.offset) or 0
    length = parse_int(args.length) or 256
    region = data[off: off + length]
    for i in range(0, len(region), 16):
        chunk = region[i:i + 16]
        hexpart = " ".join(f"{b:02X}" for b in chunk)
        hexpart = f"{hexpart:<47}"
        asciipart = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
        print(f"{off + i:08X}  {hexpart}  |{asciipart}|")


def cmd_compare(args):
    a = read_file(args.file1)
    b = read_file(args.file2)
    print(f"A: {args.file1} ({len(a)} byte)")
    print(f"B: {args.file2} ({len(b)} byte)")
    if len(a) != len(b):
        print(f"UYARI: boyutlar FARKLI ({len(a)} != {len(b)})")
    n = min(len(a), len(b))
    diffs = []           # (start, end) farkli araliklar
    in_diff = False
    start = 0
    diff_count = 0
    for i in range(n):
        if a[i] != b[i]:
            diff_count += 1
            if not in_diff:
                in_diff = True
                start = i
        else:
            if in_diff:
                in_diff = False
                diffs.append((start, i - 1))
    if in_diff:
        diffs.append((start, n - 1))

    if diff_count == 0 and len(a) == len(b):
        print("\nSONUC: IDENTICAL — iki okuma birebir ayni. Yedek guvenilir.")
        return 0

    print(f"\nFarkli byte sayisi: {diff_count} / {n} (%{100*diff_count/n:.4f})")
    print(f"Farkli bolge sayisi: {len(diffs)}")
    show = diffs[: args.max_regions]
    for (s, e) in show:
        print(f"  0x{s:08X} - 0x{e:08X}  ({e - s + 1} byte)")
    if len(diffs) > len(show):
        print(f"  ... ve {len(diffs) - len(show)} bolge daha")
    print("\nSONUC: FARKLI — okuma kararsiz olabilir. Besleme/temasi kontrol")
    print("edip tekrar okuyun. (Dusuk sayida/kucuk fark genelde temas sorunudur.)")
    return 1


def cmd_split(args):
    data = read_file(args.file)
    mp = MEMORY_MAPS.get(args.map)
    if not mp:
        sys.exit(f"HATA: bilinmeyen harita '{args.map}'. Secenekler: {', '.join(MEMORY_MAPS)}")
    base = mp[0][1]  # ilk bolgenin adresi taban kabul edilir
    out_dir = args.out or os.path.dirname(os.path.abspath(args.file)) or "."
    os.makedirs(out_dir, exist_ok=True)
    print(f"Harita: {args.map}, taban adres: 0x{base:08X}")
    for (name, addr, size) in mp:
        start = addr - base
        if start < 0 or start >= len(data):
            print(f"  {name}: atlandi (offset dosya disinda)")
            continue
        chunk = data[start: start + size]
        out_path = os.path.join(out_dir, f"{name.lower()}.bin")
        with open(out_path, "wb") as f:
            f.write(chunk)
        crc = zlib.crc32(chunk) & 0xFFFFFFFF
        print(f"  {name}: 0x{addr:08X} +{size}  -> {out_path}  ({len(chunk)} byte, CRC32={crc:08X})")


def cmd_strings(args):
    data = read_file(args.file)
    minlen = args.min
    cur = bytearray()
    start = 0
    found = 0
    for i, b in enumerate(data):
        if 32 <= b < 127:
            if not cur:
                start = i
            cur.append(b)
        else:
            if len(cur) >= minlen:
                print(f"0x{start:08X}  {cur.decode('ascii', 'replace')}")
                found += 1
                if args.limit and found >= args.limit:
                    return
            cur = bytearray()
    if len(cur) >= minlen:
        print(f"0x{start:08X}  {cur.decode('ascii', 'replace')}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def build_parser():
    p = argparse.ArgumentParser(
        description="ECU flash dump inceleme ve dogrulama araci",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("info", help="Dosya ozeti")
    s.add_argument("file")
    s.set_defaults(func=cmd_info)

    s = sub.add_parser("checksum", help="Saglama degerleri")
    s.add_argument("file")
    s.add_argument("--offset", default="0", help="Baslangic (0x.. / 1k / 1m)")
    s.add_argument("--length", default=None, help="Uzunluk (bos = sona kadar)")
    s.set_defaults(func=cmd_checksum)

    s = sub.add_parser("hexdump", help="Hex + ASCII dokum")
    s.add_argument("file")
    s.add_argument("--offset", default="0")
    s.add_argument("--length", default="256")
    s.set_defaults(func=cmd_hexdump)

    s = sub.add_parser("compare", help="Iki yedegi karsilastir")
    s.add_argument("file1")
    s.add_argument("file2")
    s.add_argument("--max-regions", type=int, default=40,
                   help="Listelenecek azami farkli bolge sayisi")
    s.set_defaults(func=cmd_compare)

    s = sub.add_parser("split", help="Dump'i bolgelere ayir")
    s.add_argument("file")
    s.add_argument("--map", default="tc275", help="Bellek haritasi (tc275)")
    s.add_argument("--out", default=None, help="Cikti klasoru")
    s.set_defaults(func=cmd_split)

    s = sub.add_parser("strings", help="ASCII metinleri listele")
    s.add_argument("file")
    s.add_argument("--min", type=int, default=4, help="Asgari uzunluk")
    s.add_argument("--limit", type=int, default=0, help="Azami sonuc (0=sinirsiz)")
    s.set_defaults(func=cmd_strings)

    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    rc = args.func(args)
    sys.exit(rc or 0)


if __name__ == "__main__":
    main()
