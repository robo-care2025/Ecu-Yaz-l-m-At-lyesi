#!/usr/bin/env python3
"""
monitor.py — Scooter'dan gelen bildirimleri (notify) canlı dinle ve logla.

Tersine mühendisliğin kalbi: scooter'ı sür/dur, modları değiştir, farı aç-kapat
ve bu sırada hangi karakteristikten hangi byte'ların geldiğini izle. Değişen
byte'lar hız/batarya/mod/hata gibi telemetriyi taşır.

Tüm notify karakteristiklerine abone olur; belirli bir UUID vermek istersen
--char ile sınırla. Tüm trafik captures/ altına zaman damgalı dosyaya yazılır.

Kullanım:
    python monitor.py AA:BB:CC:DD:EE:FF
    python monitor.py AA:BB:CC:DD:EE:FF --char 0000ffe1-0000-1000-8000-00805f9b34fb
"""
import argparse
import asyncio
import datetime as dt
import os
import sys

from bleak import BleakClient

CAPTURE_DIR = os.path.join(os.path.dirname(__file__), "..", "captures")


def _ascii(raw: bytes) -> str:
    return "".join(chr(b) if 32 <= b < 127 else "." for b in raw)


async def main(address: str, only_char: str | None) -> None:
    os.makedirs(CAPTURE_DIR, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = os.path.join(CAPTURE_DIR, f"notify_{stamp}.log")
    log = open(log_path, "a", encoding="utf-8")
    print(f"[*] Log: {log_path}")

    def make_handler(uuid: str):
        def handler(_sender, data: bytearray):
            t = dt.datetime.now().strftime("%H:%M:%S.%f")[:-3]
            hexs = bytes(data).hex(" ")
            line = f"{t}  {uuid}  len={len(data):>2}  {hexs}  |{_ascii(bytes(data))}|"
            print(line)
            log.write(line + "\n")
            log.flush()
        return handler

    print(f"[*] {address} bağlanılıyor...")
    async with BleakClient(address, timeout=20.0) as client:
        if not client.is_connected:
            print("[!] Bağlanılamadı.")
            sys.exit(1)
        print("[+] Bağlandı. Notify karakteristiklerine abone olunuyor...\n")

        subscribed = 0
        for service in client.services:
            for ch in service.characteristics:
                if "notify" not in ch.properties and "indicate" not in ch.properties:
                    continue
                if only_char and ch.uuid.lower() != only_char.lower():
                    continue
                try:
                    await client.start_notify(ch, make_handler(ch.uuid))
                    print(f"[+] abone: {ch.uuid}")
                    subscribed += 1
                except Exception as e:
                    print(f"[!] {ch.uuid} abone olunamadı: {e}")

        if subscribed == 0:
            print("[!] Abone olunacak notify karakteristiği bulunamadı.")
            return

        print("\n[i] Şimdi scooter üzerinde işlem yap (sür, mod değiştir, far...).")
        print("[i] Değişen byte'ları izle. Çıkmak için Ctrl+C.\n")
        try:
            while True:
                await asyncio.sleep(1.0)
        except (KeyboardInterrupt, asyncio.CancelledError):
            print("\n[*] Durduruluyor...")
        finally:
            log.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="BLE notify dinleyici/kaydedici")
    ap.add_argument("address", help="scooter BLE adresi")
    ap.add_argument("--char", dest="only_char", default=None, help="sadece bu UUID'yi dinle")
    args = ap.parse_args()
    asyncio.run(main(args.address, args.only_char))
