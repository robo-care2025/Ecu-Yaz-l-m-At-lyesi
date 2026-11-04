#!/usr/bin/env python3
"""
send.py — Bir karakteristiğe ham byte (komut) yaz ve cevabı dinle.

Orijinal uygulamanın gönderdiği bir komutu (monitor.py + HCI snoop ile
yakaladığın) scooter'a geri göndererek (replay) doğrulamak ve kendi
komutlarını (örn. hız limiti ayarı) denemek için.

GÜVENLİK: Bu scooter'ın kontrolcüsüne doğrudan yazar. Önce zararsız
komutlarla (far aç/kapat gibi) doğrula. Hareket halindeyken komut gönderme;
scooter sehpada/yan sehpada ve tekerlek yerden kesikken test et.

Kullanım:
    # tek komut gönder:
    python send.py AA:BB:CC:DD:EE:FF --char 0000ffe1-... --hex "5a a5 01 20 ..."

    # cevabı dinlemek için bir notify UUID de ver:
    python send.py AA:BB:... --char <write-uuid> --notify <notify-uuid> --hex "..."

    # interaktif mod — satır satır hex gir:
    python send.py AA:BB:... --char <write-uuid> --notify <notify-uuid> -i
"""
import argparse
import asyncio
import datetime as dt
import sys

from bleak import BleakClient


def parse_hex(s: str) -> bytes:
    s = s.strip().replace("0x", "").replace(",", " ")
    parts = s.split()
    if len(parts) == 1 and len(parts[0]) % 2 == 0:
        return bytes.fromhex(parts[0])
    return bytes(int(p, 16) for p in parts)


def _ascii(raw: bytes) -> str:
    return "".join(chr(b) if 32 <= b < 127 else "." for b in raw)


async def write_once(client: BleakClient, char: str, payload: bytes, response: bool) -> None:
    print(f"[>] yaz {char}: {payload.hex(' ')}  (response={response})")
    await client.write_gatt_char(char, payload, response=response)


async def main(args) -> None:
    print(f"[*] {args.address} bağlanılıyor...")
    async with BleakClient(args.address, timeout=20.0) as client:
        if not client.is_connected:
            print("[!] Bağlanılamadı.")
            sys.exit(1)
        print("[+] Bağlandı.")

        if args.notify:
            def handler(_s, data: bytearray):
                t = dt.datetime.now().strftime("%H:%M:%S.%f")[:-3]
                print(f"[<] {t}  {bytes(data).hex(' ')}  |{_ascii(bytes(data))}|")
            await client.start_notify(args.notify, handler)
            print(f"[+] cevap dinleniyor: {args.notify}")

        # write-without-response destekliyse ve kullanıcı zorlamadıysa ona göre seç
        response = not args.no_response

        if args.interactive:
            print("\n[i] Hex gir (örn '5a a5 01 20'), çıkmak için boş satır / Ctrl+C:")
            loop = asyncio.get_event_loop()
            while True:
                try:
                    line = await loop.run_in_executor(None, sys.stdin.readline)
                except (KeyboardInterrupt, EOFError):
                    break
                if not line or not line.strip():
                    break
                try:
                    payload = parse_hex(line)
                except ValueError as e:
                    print(f"[!] geçersiz hex: {e}")
                    continue
                await write_once(client, args.char, payload, response)
                await asyncio.sleep(0.3)
        else:
            if not args.hex:
                print("[!] --hex ver ya da -i (interaktif) kullan.")
                sys.exit(2)
            payload = parse_hex(args.hex)
            await write_once(client, args.char, payload, response)
            # cevap gelsin diye kısa bekle
            await asyncio.sleep(args.wait)

        print("[*] Bitti.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="BLE karakteristiğe ham komut yaz")
    ap.add_argument("address", help="scooter BLE adresi")
    ap.add_argument("--char", required=True, help="yazılacak (write) karakteristik UUID")
    ap.add_argument("--notify", default=None, help="cevabı dinlemek için notify UUID")
    ap.add_argument("--hex", default=None, help='gönderilecek byte dizisi, örn "5a a5 01 20"')
    ap.add_argument("--no-response", action="store_true", help="write-without-response kullan")
    ap.add_argument("--wait", type=float, default=1.5, help="komuttan sonra cevap için bekleme (sn)")
    ap.add_argument("-i", "--interactive", action="store_true", help="interaktif hex gönderme modu")
    args = ap.parse_args()
    asyncio.run(main(args))
