#!/usr/bin/env python3
"""
parse_btsnoop.py — Android btsnoop_hci.log'dan ATT (GATT) trafiğini çıkar.

Telefon ↔ scooter arasındaki BLE komutlarını (Write) ve bildirimleri (Notify)
yön bilgisiyle listeler. Böylece hangi aksiyonun hangi byte'ları gönderdiğini
görürsün.

Kullanım:
    python parse_btsnoop.py ../captures/btsnoop_hci.log
    python parse_btsnoop.py <log> --writes-only     # sadece telefon->scooter
    python parse_btsnoop.py <log> --handle 0x000e    # tek bir handle'ı izle
"""
import argparse
import struct
import sys

# ATT opcode'ları
ATT = {
    0x01: "Error Response",
    0x02: "Exchange MTU Request",
    0x03: "Exchange MTU Response",
    0x04: "Find Information Request",
    0x05: "Find Information Response",
    0x08: "Read By Type Request",
    0x09: "Read By Type Response",
    0x0A: "Read Request",
    0x0B: "Read Response",
    0x10: "Read By Group Type Request",
    0x11: "Read By Group Type Response",
    0x12: "Write Request",
    0x13: "Write Response",
    0x16: "Prepare Write Request",
    0x18: "Execute Write Request",
    0x1B: "Handle Value Notification",
    0x1D: "Handle Value Indication",
    0x52: "Write Command",
    0x1E: "Handle Value Confirmation",
}

# Scooter'a VERİ YAZAN (telefon -> scooter) opcode'lar
WRITE_OPS = {0x12, 0x52, 0x16}
# Scooter'dan GELEN (scooter -> telefon) opcode'lar
NOTIFY_OPS = {0x1B, 0x1D}


def ascii_of(raw: bytes) -> str:
    return "".join(chr(b) if 32 <= b < 127 else "." for b in raw)


def parse(path: str, writes_only: bool, notifies_only: bool, only_handle: int | None):
    with open(path, "rb") as f:
        data = f.read()

    if data[:8] != b"btsnoop\x00":
        print("[!] btsnoop dosyası değil.")
        sys.exit(1)
    version, datalink = struct.unpack(">II", data[8:16])
    off = 16

    rows = []
    while off + 24 <= len(data):
        orig_len, incl_len, flags, drops, ts = struct.unpack(">IIIIq", data[off:off + 24])
        off += 24
        pkt = data[off:off + incl_len]
        off += incl_len
        if len(pkt) < 1:
            continue

        # H4: ilk byte HCI paket tipi. 0x02 = ACL data.
        h4 = pkt[0]
        if h4 != 0x02:
            continue
        acl = pkt[1:]
        if len(acl) < 4:
            continue
        handle_pb, acl_len = struct.unpack("<HH", acl[:4])
        l2 = acl[4:4 + acl_len]
        # PB flag: ilk fragment mı? (continuation paketlerini atla)
        pb = (handle_pb >> 12) & 0x3
        if pb == 0x1:  # continuing fragment — basit parser, atla
            continue
        if len(l2) < 4:
            continue
        l2_len, cid = struct.unpack("<HH", l2[:4])
        if cid != 0x0004:  # 0x0004 = ATT
            continue
        att = l2[4:4 + l2_len]
        if len(att) < 1:
            continue
        opcode = att[0]

        # Yön: btsnoop flag bit0 = 1 -> received (scooter->telefon)
        received = bool(flags & 0x1)
        direction = "SCOOTER→TEL" if received else "TEL→SCOOTER"

        name = ATT.get(opcode, f"op 0x{opcode:02x}")
        handle = None
        value = b""

        if opcode in (0x12, 0x52):  # Write Request / Command
            if len(att) >= 3:
                handle = struct.unpack("<H", att[1:3])[0]
                value = att[3:]
        elif opcode in (0x1B, 0x1D):  # Notification / Indication
            if len(att) >= 3:
                handle = struct.unpack("<H", att[1:3])[0]
                value = att[3:]
        elif opcode == 0x0B:  # Read Response
            value = att[1:]
        elif opcode == 0x52:
            pass
        else:
            value = att[1:]

        if writes_only and opcode not in WRITE_OPS:
            continue
        if notifies_only and opcode not in NOTIFY_OPS:
            continue
        if only_handle is not None and handle != only_handle:
            continue

        rows.append((ts, direction, opcode, name, handle, bytes(value)))

    if not rows:
        print("[!] ATT paketi bulunamadı (filtre çok dar olabilir).")
        return

    print(f"btsnoop v{version}, datalink={datalink}, {len(rows)} ATT paketi\n")
    print(f"{'#':>4}  {'yön':<11}  {'opcode':<28}  handle   value")
    print("-" * 100)
    for i, (ts, direction, opcode, name, handle, value) in enumerate(rows, 1):
        h = f"0x{handle:04x}" if handle is not None else "  -   "
        v = value.hex(" ")
        asc = ascii_of(value)
        print(f"{i:>4}  {direction:<11}  {name:<28}  {h}   {v}  |{asc}|")

    # Özet: yazılan değerleri grupla
    writes = [r for r in rows if r[2] in WRITE_OPS]
    print(f"\n[i] {len(writes)} adet TEL→SCOOTER yazma paketi.")
    print("[i] Aynı aksiyonu farklı değerlerle tekrarlayıp (örn hız limiti 20/25/30)")
    print("    değişen tek byte'ı bul. checksum için: parse çıktısındaki tam paketleri")
    print("    checksum.py --verify'a ver.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="btsnoop -> ATT çıkarıcı")
    ap.add_argument("logfile", help="btsnoop_hci.log yolu")
    ap.add_argument("--writes-only", action="store_true", help="sadece TEL→SCOOTER yazmalar")
    ap.add_argument("--notifies-only", action="store_true", help="sadece SCOOTER→TEL bildirimler")
    ap.add_argument("--handle", type=lambda x: int(x, 0), default=None, help="tek handle filtrele (0x...)")
    args = ap.parse_args()
    parse(args.logfile, args.writes_only, args.notifies_only, args.handle)
