#!/usr/bin/env python3
"""
enumerate.py — Scooter'a bağlan ve tüm GATT servis/karakteristiklerini çıkar.

BLE'de veri, "characteristic" (karakteristik) adı verilen uç noktalar
üzerinden akar. Her birinin bir UUID'si ve özellikleri (read/write/notify)
vardır. Komut göndereceğimiz karakteristik genelde "write" veya
"write-without-response", scooter'dan veri (hız, hata, batarya) aldığımız
karakteristik ise "notify" özelliğine sahiptir.

Bu script, hangi UUID'nin ne işe yaradığını anlamak için profilin tamamını
dökümler ve okunabilir karakteristiklerin ilk değerini de gösterir.

Kullanım:
    python enumerate.py AA:BB:CC:DD:EE:FF
    python enumerate.py AA:BB:CC:DD:EE:FF --read   # read'leri de oku
"""
import argparse
import asyncio
import sys

from bleak import BleakClient


def describe_props(props) -> str:
    return ",".join(props)


async def main(address: str, do_read: bool) -> None:
    print(f"[*] {address} adresine bağlanılıyor...")
    async with BleakClient(address, timeout=20.0) as client:
        if not client.is_connected:
            print("[!] Bağlanılamadı.")
            sys.exit(1)
        print("[+] Bağlandı.\n")

        for service in client.services:
            print(f"SERVICE {service.uuid}  —  {service.description}")
            for ch in service.characteristics:
                props = describe_props(ch.properties)
                line = f"  CHAR {ch.uuid}  [{props}]  {ch.description}"
                value_note = ""
                if do_read and "read" in ch.properties:
                    try:
                        raw = await client.read_gatt_char(ch)
                        value_note = f"  value={raw.hex(' ')}  ({_ascii(raw)})"
                    except Exception as e:
                        value_note = f"  (okunamadı: {e})"
                print(line + value_note)
                for desc in ch.descriptors:
                    print(f"      DESC {desc.uuid} (handle {desc.handle})")
            print()

        print("[i] Komut göndermek için 'write' / 'write-without-response' olan CHAR'a bak.")
        print("[i] Scooter'dan veri dinlemek için 'notify' olan CHAR'a bak (monitor.py).")


def _ascii(raw: bytes) -> str:
    return "".join(chr(b) if 32 <= b < 127 else "." for b in raw)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="GATT profil çıkarıcı")
    ap.add_argument("address", help="scooter BLE adresi (scan.py'den)")
    ap.add_argument("--read", action="store_true", help="okunabilir karakteristikleri de oku")
    args = ap.parse_args()
    asyncio.run(main(args.address, args.read))
