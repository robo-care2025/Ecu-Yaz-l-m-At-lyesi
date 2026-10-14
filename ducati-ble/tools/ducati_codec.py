#!/usr/bin/env python3
"""
ducati_codec.py — Ducati PRO-I EVO komut/telemetri codec'i (btsnoop'tan çözüldü).

KOMUT (telefon -> scooter, char 0xFFF6):
    ca ac bd [B3] [B4] [CK5] [CK6] 6a      (8 byte)
      CK5 = (B3 XOR B4 XOR 0xBD) & 0xFF
      CK6 = (CK5 + B3 - 0x43) & 0xFF
    7 farklı komutta doğrulandı. Komutlar SABİT (oturum anahtarı yok) -> replay.
    Komut mutlak durum yansıması: (B3,B4) = mod tabanı + bayraklar (ARG'a OR).
      MOD1 ECO  : ca ac bd 00 00 bd 7a 6a
      MOD2      : ca ac bd 00 01 bc 79 6a
      MOD3 SPORT: ca ac bd 04 01 b8 79 6a
      bayraklar : cruise ARG|0x02, far ARG|0x18, kilit ARG|0x40

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


def ck5(b3, b4): return (b3 ^ b4 ^ 0xBD) & 0xFF
def ck6(b3, b4): return (ck5(b3, b4) + b3 - 0x43) & 0xFF


def encode(b3: int, b4: int) -> bytes:
    return bytes(HDR + [b3 & 0xFF, b4 & 0xFF, ck5(b3, b4), ck6(b3, b4), FTR])


def decode(pkt: bytes) -> dict:
    if len(pkt) != 8:
        return {"ok": False, "neden": f"uzunluk {len(pkt)} (8 bekleniyor)"}
    b3, b4 = pkt[3], pkt[4]
    exp5, exp6 = ck5(b3, b4), ck6(b3, b4)
    return {
        "ok": pkt[0:3] == bytes(HDR) and pkt[7] == FTR and pkt[5] == exp5 and pkt[6] == exp6,
        "b3": pkt[3],
        "b4": pkt[4],
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
