#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
05_BLE_TARA
===========
Amac: PC'nin Bluetooth'u ile scooter BLE modulune ("Ducati") baglanip
tum GATT servis/karakteristiklerini listelemek, okunabilir degerleri
okumak ve bildirim (notify) verisini canli dinlemek.

Bu program sadece OKUR/dinler; bir sey yazmaz (son bolumdeki opsiyonel
"yaz" komutu haric, o da elle ve bilincli kullanilir).

Kurulum (bir kere):
    pip install bleak

Calistirma:
    python 05_ble_tara.py                 # cevredeki BLE cihazlari tara
    python 05_ble_tara.py --ad Ducati     # adinda 'Ducati' gecen cihaza baglan
    python 05_ble_tara.py --adres XX:XX:XX:XX:XX:XX   # adres ile baglan

Baglandiktan sonra:
  - Tum servis/karakteristikler ozellikleriyle listelenir
  - Okunabilir (read) olanlar okunup hex + olasi sayi olarak gosterilir
  - Notify/indicate olanlara abone olunur; gelen her paket ekrana yazilir
  - Scooter'i (tekeri) cevirince km/hiz baytlarinin degistigini izle
"""

import sys
import asyncio
import struct

try:
    from bleak import BleakScanner, BleakClient
except ImportError:
    print("HATA: bleak kurulu degil. Sunu calistir:  pip install bleak")
    sys.exit(1)


def sayi_yorumla(data: bytes):
    """Bir bayt dizisini olasi sayi okumalariyla ozetler (km aramak icin)."""
    parcalar = []
    if len(data) >= 2:
        parcalar.append(f"2LE={struct.unpack_from('<H', data, 0)[0]}")
    if len(data) >= 4:
        parcalar.append(f"4LE={struct.unpack_from('<I', data, 0)[0]}")
    return "  ".join(parcalar)


async def tara():
    print("Cevre taraniyor (5 sn)... Scooter ACIK ve bagli degil olsun.\n")
    cihazlar = await BleakScanner.discover(timeout=5.0)
    if not cihazlar:
        print("Hic BLE cihazi bulunamadi. Bluetooth acik mi?")
        return None
    print("Bulunan cihazlar:")
    for d in cihazlar:
        print(f"   {d.address}   RSSI={getattr(d, 'rssi', '?')}   ad='{d.name}'")
    return cihazlar


async def baglan(adres):
    print(f"\nBaglaniliyor: {adres}")
    bildirim_sayac = {}

    def bildirim_geldi(ch, data: bytes):
        hexs = " ".join(f"{b:02X}" for b in data)
        n = bildirim_sayac.get(ch, 0) + 1
        bildirim_sayac[ch] = n
        # ayni karakteristikten cok paket gelebilir; ilk birkacini ayrinti goster
        print(f"[NOTIFY {ch}] ({len(data)}B) {hexs}   {sayi_yorumla(data)}")

    async with BleakClient(adres) as c:
        print("Baglandi.\n")
        print("=" * 70)
        print(" GATT SERVIS / KARAKTERISTIK LISTESI")
        print("=" * 70)

        notify_edilecek = []
        for servis in c.services:
            print(f"\n[Servis] {servis.uuid}  ({servis.description})")
            for ch in servis.characteristics:
                ozellik = ",".join(ch.properties)
                print(f"   - {ch.uuid}  [{ozellik}]  (handle {ch.handle})")
                if "read" in ch.properties:
                    try:
                        val = await c.read_gatt_char(ch.uuid)
                        hexs = " ".join(f"{b:02X}" for b in val)
                        print(f"        READ -> ({len(val)}B) {hexs}   {sayi_yorumla(val)}")
                    except Exception as e:
                        print(f"        READ hata: {e}")
                if "notify" in ch.properties or "indicate" in ch.properties:
                    notify_edilecek.append(ch)

        # Bildirimlere abone ol
        if notify_edilecek:
            print("\n" + "=" * 70)
            print(" CANLI BILDIRIMLER (Ctrl+C ile bitir)")
            print(" >> Scooter tekerini cevir / gaz ver; degisen baytlar km/hiz.")
            print("=" * 70)
            for ch in notify_edilecek:
                try:
                    await c.start_notify(ch.uuid, bildirim_geldi)
                except Exception as e:
                    print(f"   {ch.uuid} notify acilamadi: {e}")
            try:
                while True:
                    await asyncio.sleep(1.0)
            except KeyboardInterrupt:
                print("\nDurduruldu.")
        else:
            print("\nNotify/indicate karakteristik yok. Sadece read verileri alindi.")


async def main():
    ad_filtre = None
    adres = None
    if "--ad" in sys.argv:
        ad_filtre = sys.argv[sys.argv.index("--ad") + 1]
    if "--adres" in sys.argv:
        adres = sys.argv[sys.argv.index("--adres") + 1]

    if adres:
        await baglan(adres)
        return

    cihazlar = await tara()
    if not cihazlar:
        return

    hedef = None
    if ad_filtre:
        for d in cihazlar:
            if d.name and ad_filtre.lower() in d.name.lower():
                hedef = d
                break
        if not hedef:
            print(f"\n'{ad_filtre}' adinda cihaz bulunamadi.")
            return
    else:
        print("\nBaglanmak icin:  python 05_ble_tara.py --ad Ducati")
        print("veya:            python 05_ble_tara.py --adres <yukaridaki adres>")
        return

    await baglan(hedef.address)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
