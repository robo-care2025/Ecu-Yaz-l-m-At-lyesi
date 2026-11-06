#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
06_HCI_COZ
==========
Amac: Android'in "Bluetooth HCI snoop log" dosyasini (btsnoop_hci.log)
cozup, Ducati uygulamasinin yaptigi tum BLE ATT islemlerini (oku/yaz/
bildirim) okunur sekilde dokmek. Boylece km'yi yazan komutu buluruz.

Android'de HCI log nasil alinir:
  1) Ayarlar > Telefon hakkinda > Yapi numarasina 7 kez dokun (gelistirici modu)
  2) Gelistirici secenekleri > "Bluetooth HCI snoop log'u etkinlestir" -> AC
  3) Bluetooth'u kapat/ac
  4) Ducati uygulamasini kullan: bagla, km'ye bak, bir ayar degistir
  5) Log dosyasini al (konum cihaza gore degisir):
       /sdcard/btsnoop_hci.log  ya  da
       /data/misc/bluetooth/logs/btsnoop_hci.log
     ("hata bildir" / bugreport icinden de cikabilir)

Kullanim:
    python 06_hci_coz.py btsnoop_hci.log
    python 06_hci_coz.py btsnoop_hci.log --sadece-yaz   # yalniz yazma islemleri

Cikti: yon (telefon->cihaz / cihaz->telefon), islem turu, handle ve veri.
"""

import sys
import struct

ATT_ADLARI = {
    0x01: "Error Response",
    0x02: "Exchange MTU Request",
    0x03: "Exchange MTU Response",
    0x04: "Find Information Request",
    0x05: "Find Information Response",
    0x08: "Read By Type Request",
    0x09: "Read By Type Response",
    0x0A: "Read Request",
    0x0B: "Read Response",
    0x0C: "Read Blob Request",
    0x0D: "Read Blob Response",
    0x10: "Read By Group Type Request",
    0x11: "Read By Group Type Response",
    0x12: "Write Request",
    0x13: "Write Response",
    0x16: "Prepare Write Request",
    0x18: "Execute Write Request",
    0x1B: "Handle Value Notification",
    0x1D: "Handle Value Indication",
    0x1E: "Handle Value Confirmation",
    0x52: "Write Command",
}

# km/hiz ararken ise yarar: bir degeri olasi sayilara cevir
def sayi_yorumla(data: bytes) -> str:
    p = []
    if len(data) >= 2:
        p.append(f"2LE={struct.unpack_from('<H', data,0)[0]}")
    if len(data) >= 4:
        p.append(f"4LE={struct.unpack_from('<I', data,0)[0]}")
    return "  ".join(p)


def btsnoop_oku(dosya):
    """btsnoop dosyasini okuyup (yon, h4_tipi, payload) kayitlari dondurur."""
    with open(dosya, "rb") as f:
        ham = f.read()
    if ham[:8] != b"btsnoop\x00":
        print("UYARI: Bu dosya 'btsnoop' basligi tasimiyor. Yine de denenecek.")
        bas = 0
    else:
        # 8 bayt magic + 4 bayt versiyon + 4 bayt datalink
        versiyon, datalink = struct.unpack_from(">II", ham, 8)
        print(f"btsnoop v{versiyon}, datalink={datalink} "
              f"({'H4/UART' if datalink==1002 else 'bilinmiyor-gene denenecek'})")
        bas = 16

    kayitlar = []
    i = bas
    n = len(ham)
    while i + 24 <= n:
        orig_len, inc_len, flags, drops = struct.unpack_from(">IIII", ham, i)
        # 8 bayt timestamp atlanir
        i += 24
        if inc_len <= 0 or i + inc_len > n:
            break
        paket = ham[i:i + inc_len]
        i += inc_len
        # flags bit0: 1 = controller->host (gelen), 0 = host->controller (giden)
        yon = "cihaz->telefon" if (flags & 0x01) else "telefon->cihaz"
        kayitlar.append((yon, paket))
    return kayitlar


def att_coz(payload: bytes):
    """H4 paketinden ATT katmanini ayiklar. Donus: (opcode, geri_kalan) ya da None."""
    if not payload:
        return None
    h4 = payload[0]
    if h4 != 0x02:  # sadece ACL (veri) paketleri
        return None
    acl = payload[1:]
    if len(acl) < 4:
        return None
    handle_flags, acl_len = struct.unpack_from("<HH", acl, 0)
    pb = (handle_flags >> 12) & 0x3
    if pb == 0x01:
        # devam (continuation) parcasi - basit cozucude atliyoruz
        return ("__CONT__", b"")
    l2 = acl[4:]
    if len(l2) < 4:
        return None
    l2_len, cid = struct.unpack_from("<HH", l2, 0)
    if cid != 0x0004:  # ATT kanali degil
        return None
    att = l2[4:4 + l2_len]
    if not att:
        return None
    return (att[0], att[1:])


def main():
    if len(sys.argv) < 2:
        print("Kullanim: python 06_hci_coz.py <btsnoop_hci.log> [--sadece-yaz]")
        return
    dosya = sys.argv[1]
    sadece_yaz = "--sadece-yaz" in sys.argv

    try:
        kayitlar = btsnoop_oku(dosya)
    except FileNotFoundError:
        print(f"HATA: bulunamadi -> {dosya}")
        return

    print(f"Toplam {len(kayitlar)} HCI kaydi okundu.\n")
    print("=" * 74)
    print(" BLE ATT ISLEMLERI  (yaz = uygulamanin cihaza gonderdigi komut)")
    print("=" * 74)

    son_read_handle = None
    yaz_sayac = 0
    for (yon, paket) in kayitlar:
        coz = att_coz(paket)
        if not coz:
            continue
        opcode, govde = coz
        if opcode == "__CONT__":
            continue
        ad = ATT_ADLARI.get(opcode, f"opcode 0x{opcode:02X}")

        yazma_mi = opcode in (0x12, 0x52)      # Write Request / Write Command
        okuma_cevap = opcode in (0x0B, 0x0D)   # Read Response / Blob Response
        bildirim = opcode in (0x1B, 0x1D)      # Notification / Indication

        if sadece_yaz and not yazma_mi:
            # yine de read request handle'ini takip et
            if opcode == 0x0A and len(govde) >= 2:
                son_read_handle = struct.unpack_from("<H", govde, 0)[0]
            continue

        if yazma_mi or bildirim:
            if len(govde) >= 2:
                handle = struct.unpack_from("<H", govde, 0)[0]
                deger = govde[2:]
                hexs = " ".join(f"{b:02X}" for b in deger)
                etiket = ">>> YAZMA" if yazma_mi else "    bildirim"
                print(f"\n{etiket}  [{yon}]  {ad}")
                print(f"   handle=0x{handle:04X}  veri=({len(deger)}B) {hexs}")
                if deger:
                    print(f"   olasi sayi: {sayi_yorumla(deger)}")
                if yazma_mi:
                    yaz_sayac += 1
        elif opcode == 0x0A and len(govde) >= 2:
            son_read_handle = struct.unpack_from("<H", govde, 0)[0]
        elif okuma_cevap:
            hexs = " ".join(f"{b:02X}" for b in govde)
            h = f"0x{son_read_handle:04X}" if son_read_handle is not None else "?"
            print(f"\n    okuma-cevap [{yon}]  {ad}  (handle {h})")
            print(f"   veri=({len(govde)}B) {hexs}   {sayi_yorumla(govde)}")

    print("\n" + "=" * 74)
    print(f"Toplam {yaz_sayac} yazma (komut) islemi bulundu.")
    print("km'yi degistirirken gonderilen YAZMA komutunu burada ararız.")
    print("Bu ciktiyi bana yapistir; komut formatini + checksum'i cozelim.")


if __name__ == "__main__":
    main()
