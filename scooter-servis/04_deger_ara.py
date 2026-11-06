#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
04_DEGER_ARA
============
Amac: Tek bir EEPROM/flash dokumunde, EKRANDA GORDUGUN km degerini aratmak.

Neden: Ekranda km zaten yaziyor (orn. 1240). O sayiyi dokumun icinde
degisik kodlamalarla (1/2/4 bayt, little/big endian) ve olasi olceklerle
(x1, x10, x100) ariyoruz. Boylece km'nin ADRESINI tek dokumle buluyoruz;
iki kere lehim sokmeye gerek kalmiyor.

Kullanim:
    python 04_deger_ara.py dump.bin 1240
    python 04_deger_ara.py dump.bin 1240 --olcek 1,10,100

Cikti: eslesen her adres + kodlama. Genelde 1-2 aday cikar; onu
03_dump_karsilastir ile dogrulayip yazma adimina geceriz.
"""

import sys
import os
import struct


def oku(dosya):
    with open(dosya, "rb") as f:
        return f.read()


def adaylar_uret(deger):
    """Bir sayinin olasi bayt dizisi kodlamalarini uretir."""
    sonuc = []  # (etiket, bytes)
    if 0 <= deger <= 0xFF:
        sonuc.append(("1 bayt", bytes([deger])))
    if 0 <= deger <= 0xFFFF:
        sonuc.append(("2 bayt LE", struct.pack("<H", deger)))
        sonuc.append(("2 bayt BE", struct.pack(">H", deger)))
    if 0 <= deger <= 0xFFFFFFFF:
        sonuc.append(("4 bayt LE", struct.pack("<I", deger)))
        sonuc.append(("4 bayt BE", struct.pack(">I", deger)))
    # BCD ( bazi gostergeler sayiyi onlu basamak olarak tutar)
    try:
        s = str(deger)
        if len(s) % 2:
            s = "0" + s
        bcd = bytes(int(s[i:i+2], 16) for i in range(0, len(s), 2))
        sonuc.append(("BCD", bcd))
        sonuc.append(("BCD ters", bcd[::-1]))
    except Exception:
        pass
    return sonuc


def ara(veri, hedef_bytes):
    yerler = []
    bas = 0
    while True:
        k = veri.find(hedef_bytes, bas)
        if k == -1:
            break
        yerler.append(k)
        bas = k + 1
    return yerler


def main():
    if len(sys.argv) < 3:
        print("Kullanim: python 04_deger_ara.py <dump.bin> <km_degeri> [--olcek 1,10,100]")
        return
    dosya = sys.argv[1]
    if not os.path.exists(dosya):
        print(f"HATA: bulunamadi -> {dosya}")
        return
    try:
        km = int(sys.argv[2])
    except ValueError:
        print("km_degeri bir tam sayi olmali (orn. 1240)")
        return

    olcekler = [1, 10, 100]
    if "--olcek" in sys.argv:
        i = sys.argv.index("--olcek")
        olcekler = [int(x) for x in sys.argv[i + 1].split(",")]

    veri = oku(dosya)
    print("=" * 70)
    print(f" DEGER ARAMA: km={km}  dosya={os.path.basename(dosya)} ({len(veri)} bayt)")
    print("=" * 70)

    toplam = 0
    for olcek in olcekler:
        deger = km * olcek
        etiket_olcek = f"km x{olcek} = {deger}"
        bulundu_bu_olcek = False
        for (etiket, hb) in adaylar_uret(deger):
            yerler = ara(veri, hb)
            for adres in yerler:
                toplam += 1
                bulundu_bu_olcek = True
                hexb = " ".join(f"{b:02X}" for b in hb)
                print(f"  [{etiket_olcek}] {etiket:<10} = <{hexb}>  ->  ADRES 0x{adres:06X} ({adres})")
        if not bulundu_bu_olcek:
            pass

    if toplam == 0:
        print("\nHic eslesme yok. Olasi sebepler:")
        print("  - km baska olcekte tutuluyor (--olcek 1,10,100,1000 dene)")
        print("  - deger sifreli/XOR'lu  ->  o zaman 2 farkli km dokumu alip")
        print("    03_dump_karsilastir.py ile fark bakariz")
        print("  - yanlis cip / eksik dokum")
    else:
        print(f"\nToplam {toplam} aday adres bulundu.")
        print("Dogrulama: kucuk bir miktar km ekleyip (orn. 1 km surerek) ikinci")
        print("dokumu al, ayni adreste degerin arttigini gor. Sonra o adrese")
        print("gercek km'yi yazip (yazma adimi) geri flash'lariz.")
    print("\nBu ciktiyi bana yapistir; adresi netlestirip guvenli yazmayi kuralim.")


if __name__ == "__main__":
    main()
