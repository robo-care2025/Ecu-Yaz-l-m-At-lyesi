#!/usr/bin/env python3
"""
scan.py — Yakındaki BLE cihazlarını tara ve scooter'ı bul.

Ducati PRO-I EVO (Urban e-Mobility) scooter'ının reklam (advertising)
verisini ve adresini bulmak için ilk adım. Cihaz açıkken çalıştır.

Kullanım:
    python scan.py                 # 10 sn tara, hepsini listele
    python scan.py --seconds 20    # 20 sn tara
    python scan.py --name DUCATI   # isminde "DUCATI" geçenleri filtrele
"""
import argparse
import asyncio

from bleak import BleakScanner

try:
    from rich.console import Console
    from rich.table import Table
    _console = Console()
except Exception:  # rich yoksa düz print'e düş
    _console = None


async def main(seconds: float, name_filter: str | None) -> None:
    print(f"[*] {seconds:.0f} saniye taranıyor... (scooter açık ve eşleşmemiş olmalı)")
    # detection_callback yerine discover kullanıp advertising verisini de alıyoruz
    devices = await BleakScanner.discover(timeout=seconds, return_adv=True)

    rows = []
    for address, (dev, adv) in devices.items():
        name = dev.name or adv.local_name or "(isimsiz)"
        if name_filter and name_filter.lower() not in name.lower():
            continue
        service_uuids = ", ".join(adv.service_uuids) if adv.service_uuids else "-"
        mfr = ", ".join(f"{k:#06x}" for k in adv.manufacturer_data) or "-"
        rows.append((name, address, str(adv.rssi), service_uuids, mfr))

    rows.sort(key=lambda r: int(r[2]) if r[2].lstrip("-").isdigit() else -999, reverse=True)

    if not rows:
        print("[!] Cihaz bulunamadı. Scooter açık mı? Telefon uygulaması bağlı DEĞİL mi?")
        return

    if _console:
        table = Table(title="Bulunan BLE Cihazları (RSSI'ye göre sıralı)")
        for col in ("İsim", "Adres", "RSSI", "Service UUID'leri", "Üretici Verisi"):
            table.add_column(col, overflow="fold")
        for r in rows:
            table.add_row(*r)
        _console.print(table)
    else:
        for name, address, rssi, suuids, mfr in rows:
            print(f"{rssi:>5} dBm  {address}  {name}")
            print(f"            services: {suuids}")
            print(f"            mfr-data: {mfr}")

    print("\n[i] Scooter'ı RSSI (sinyal gücü, 0'a en yakın = en yakın) ve isminden ayırt et.")
    print("[i] Adresi kopyala, sonra:  python enumerate.py <ADRES>")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="BLE cihaz tarayıcı")
    ap.add_argument("--seconds", type=float, default=10.0, help="tarama süresi")
    ap.add_argument("--name", dest="name_filter", default=None, help="isim filtresi (örn. DUCATI)")
    args = ap.parse_args()
    asyncio.run(main(args.seconds, args.name_filter))
