#!/usr/bin/env python3
"""
checksum.py — Yakalanan paketlerin checksum formülünü bul/doğrula.

Birçok scooter protokolü paketin sonuna 1-2 byte checksum ekler. Formülü
bilmeden kendi komutlarımızı (ör. yeni hız limiti) üretemeyiz; çünkü yanlış
checksum'lı paketi kontrolcü yok sayar.

Bu script, elindeki birkaç yakalanmış paket için yaygın checksum yöntemlerini
dener ve hangisinin tuttuğunu söyler. Sonra o formülle yeni paketin checksum'ını
hesaplarsın.

Kullanım:
    # Paketlerin TAMAMINI (checksum dahil) ver; hangi formül tutuyor bul:
    python checksum.py --verify "5a a5 01 20 02 14 c8 fe" "5a a5 01 20 02 19 c3 fe"

    # Bir gövde için checksum üret (gövde = checksum HARİÇ byte'lar):
    python checksum.py --make "5a a5 01 20 02 1e" --method ninebot
"""
import argparse


def _b(s: str) -> bytes:
    s = s.strip().replace("0x", "").replace(",", " ")
    parts = s.split()
    if len(parts) == 1 and len(parts[0]) % 2 == 0:
        return bytes.fromhex(parts[0])
    return bytes(int(p, 16) for p in parts)


# --- Yaygın checksum yöntemleri ---------------------------------------------
# Her yöntem: gövde (checksum hariç) -> checksum byte(lar)ı

def cs_sum8(body: bytes) -> bytes:
    return bytes([sum(body) & 0xFF])

def cs_xor8(body: bytes) -> bytes:
    x = 0
    for b in body:
        x ^= b
    return bytes([x])

def cs_neg_sum8(body: bytes) -> bytes:  # ~sum & 0xFF
    return bytes([(~sum(body)) & 0xFF])

def cs_twos_sum8(body: bytes) -> bytes:  # (-sum) & 0xFF
    return bytes([(-sum(body)) & 0xFF])

def cs_ninebot(body: bytes) -> bytes:
    # Ninebot/Xiaomi tarzı: 16-bit, 0x55AA header HARİÇ gövde toplamının tersi,
    # little-endian 2 byte. (header'ı gövdeye dahil etme!)
    s = (~sum(body)) & 0xFFFF
    return bytes([s & 0xFF, (s >> 8) & 0xFF])

def cs_sum16_le(body: bytes) -> bytes:
    s = sum(body) & 0xFFFF
    return bytes([s & 0xFF, (s >> 8) & 0xFF])


METHODS = {
    "sum8": cs_sum8,
    "xor8": cs_xor8,
    "neg_sum8": cs_neg_sum8,
    "twos_sum8": cs_twos_sum8,
    "ninebot": cs_ninebot,
    "sum16_le": cs_sum16_le,
}


def verify(packets: list[bytes]) -> None:
    print("[*] Her yöntem, her paket için checksum'ı tahmin edip gerçekle karşılaştırıyor.")
    print("    (Header'ın gövdeye dahil olup olmadığını iki ihtimalle de deniyoruz.)\n")
    for name, fn in METHODS.items():
        for cslen in (1, 2):
            for skip_header in (0, 2):  # bazı protokollerde ilk 2 byte header, checksum'a dahil değil
                ok = True
                for pkt in packets:
                    if len(pkt) <= cslen + skip_header:
                        ok = False
                        break
                    body = pkt[skip_header:-cslen]
                    want = pkt[-cslen:]
                    try:
                        got = fn(body)
                    except Exception:
                        ok = False
                        break
                    if len(got) != cslen or got != want:
                        ok = False
                        break
                if ok:
                    hdr = "header dahil" if skip_header == 0 else f"ilk {skip_header} byte hariç"
                    print(f"[✓] TUTTU → method={name}  checksum_len={cslen}  ({hdr})")
    print("\n[i] Yukarıda '[✓] TUTTU' çıkan yöntemi --make ile kullan.")
    print("[i] Hiçbiri tutmadıysa checksum farklı; birkaç paket daha yakala ve")
    print("    sabit kalan / değişen byte'ları docs/01-protokol-cozme.md'ye göre incele.")


def make(body_hex: str, method: str, skip_header: int) -> None:
    if method not in METHODS:
        print(f"[!] bilinmeyen method: {method}. Seçenekler: {', '.join(METHODS)}")
        return
    body = _b(body_hex)
    cs = METHODS[method](body[skip_header:])
    full = body + cs
    print(f"gövde     : {body.hex(' ')}")
    print(f"checksum  : {cs.hex(' ')}  (method={method})")
    print(f"TAM PAKET : {full.hex(' ')}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="checksum bulucu/üretici")
    ap.add_argument("--verify", nargs="+", metavar="PKT", help="tam paketler (checksum dahil)")
    ap.add_argument("--make", metavar="BODY", help="checksum'ı hesaplanacak gövde (checksum hariç)")
    ap.add_argument("--method", default="ninebot", help="--make için yöntem")
    ap.add_argument("--skip-header", type=int, default=0, help="--make: gövdenin ilk N byte'ını checksum'a dahil etme")
    args = ap.parse_args()

    if args.verify:
        verify([_b(p) for p in args.verify])
    elif args.make:
        make(args.make, args.method, args.skip_header)
    else:
        ap.print_help()
