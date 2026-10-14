#!/usr/bin/env python3
"""
ducati_codec.py — Ducati PRO-I EVO komut/telemetri codec'i (btsnoop'tan çözüldü).

KOMUT (telefon -> scooter, char 0xFFF6):
    ca ac bd [CMD] [ARG] [CK5] [CK6] 6a      (8 byte)
      CK5 = (sum(byte[0..4]) + 0x8A) & 0xFF
      CK6 = (sum(byte[0..4]) + 0x47) & 0xFF
    Doğrulandı: cmd=0x00 arg=0x40/0x00 örnekleri birebir üretiliyor.
    NOT: Komutlar SABİT (oturum anahtarı yok) -> replay çalışır.

TELEMETRİ (scooter -> telefon, char 0xFFF7):
    5a b9 00 00 24 00 00 00 64 [STATE] 00 20 00 00 [CK] 95   (16 byte)
      CK = (STATE + 0x60) & 0xFF
    STATE: scooter durum/mod baytı (anlamları etiketlenmeyi bekliyor).

Kullanım:
    python ducati_codec.py enc 00 40          # cmd=0x00 arg=0x40 paketini üret
    python ducati_codec.py dec ca ac bd 00 40 fd ba 6a   # paketi çöz/doğrula
    python ducati_codec.py tele 5a b9 ...      # telemetri çöz
"""
import sys

HDR = [0xCA, 0xAC, 0xBD]
FTR = 0x6A


def ck5(body5): return (sum(body5) + 0x8A) & 0xFF
def ck6(body5): return (sum(body5) + 0x47) & 0xFF


def encode(cmd: int, arg: int) -> bytes:
    body = HDR + [cmd & 0xFF, arg & 0xFF]
    return bytes(body + [ck5(body), ck6(body), FTR])


def decode(pkt: bytes) -> dict:
    if len(pkt) != 8:
        return {"ok": False, "neden": f"uzunluk {len(pkt)} (8 bekleniyor)"}
    body = list(pkt[0:5])
    exp5, exp6 = ck5(body), ck6(body)
    return {
        "ok": pkt[0:3] == bytes(HDR) and pkt[7] == FTR and pkt[5] == exp5 and pkt[6] == exp6,
        "cmd": pkt[3],
        "arg": pkt[4],
        "ck5_ok": pkt[5] == exp5,
        "ck6_ok": pkt[6] == exp6,
        "header_ok": pkt[0:3] == bytes(HDR),
        "footer_ok": pkt[7] == FTR,
    }


def decode_tele(pkt: bytes) -> dict:
    if len(pkt) < 16:
        return {"ok": False, "neden": f"uzunluk {len(pkt)}"}
    state = pkt[9]
    ck = pkt[14]
    return {
        "header_ok": pkt[0:2] == b"\x5a\xb9",
        "footer_ok": pkt[15] == 0x95,
        "state": state,
        "state_hex": f"0x{state:02x}",
        "checksum_ok": ((state + 0x60) & 0xFF) == ck,
    }


def _bytes(args): return bytes(int(x, 16) for x in args)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)
    mode = sys.argv[1]
    if mode == "enc":
        cmd = int(sys.argv[2], 16); arg = int(sys.argv[3], 16)
        print(encode(cmd, arg).hex(" "))
    elif mode == "dec":
        d = decode(_bytes(sys.argv[2:]))
        for k, v in d.items():
            print(f"  {k}: {v}")
    elif mode == "tele":
        d = decode_tele(_bytes(sys.argv[2:]))
        for k, v in d.items():
            print(f"  {k}: {v}")
    else:
        print("mod: enc | dec | tele")
