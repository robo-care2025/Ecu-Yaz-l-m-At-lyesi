#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
03_DUMP_KARSILASTIR
===================
Amac: CH341A (24xx EEPROM / 25xx flash) ya da ST-LINK / AVR ile alinan
IKI ikili (binary) dokumu karsilastirip km'nin hangi ADRESTE oldugunu bulmak.

Mantik 02_fark_bulucu ile ayni ama bu sefer dosyalar ham .bin:
  - km = X iken bir dokum al  -> dumpA.bin
  - km'yi degistir, tekrar dokum al -> dumpB.bin
  - Sadece km (ve belki bir checksum/sayac) baytlari degisir.

Kullanim:
    python 03_dump_karsilastir.py dumpA.bin dumpB.bin

Ekstra: degisen adresteki degeri olasi km yorumlariyla gosterir
(1/2/4 bayt, little & big endian) ki "hangi sayi gercekten km" anlasilsin.
"""

import sys
import os
import struct


def oku(dosya):
    with open(dosya, "rb") as f:
        return f.read()


def yorumla(veri, adres):
    """Verilen adresten itibaren olasi sayi okumalarini dondurur."""
    sonuc = []
    n = len(veri)
    if adres < n:
        sonuc.append(("1 bayt", veri[adres]))
    if adres + 2 <= n:
        sonuc.append(("2 bayt LE", struct.unpack_from("<H", veri, adres)[0]))
        sonuc.append(("2 bayt BE", struct.unpack_from(">H", veri, adres)[0]))
    if adres + 4 <= n:
        sonuc.append(("4 bayt LE", struct.unpack_from("<I", veri, adres)[0]))
        sonuc.append(("4 bayt BE", struct.unpack_from(">I", veri, adres)[0]))
    return sonuc


def main():
    if len(sys.argv) < 3:
        print("Kullanim: python 03_dump_karsilastir.py <dumpA.bin> <dumpB.bin>")
        return
    a_yol, b_yol = sys.argv[1], sys.argv[2]
    for d in (a_yol, b_yol):
        if not os.path.exists(d):
            print(f"HATA: bulunamadi -> {d}")
            return

    A = oku(a_yol)
    B = oku(b_yol)

    if len(A) != len(B):
        print(f"UYARI: boyutlar farkli (A={len(A)}B, B={len(B)}B).")
        print("Ayni cipten ayni ayarlarla dokum aldigindan emin ol.\n")
    n = min(len(A), len(B))

    farkli = [i for i in range(n) if A[i] != B[i]]

    print("=" * 70)
    print(f" DUMP KARSILASTIRMA   A={os.path.basename(a_yol)}  B={os.path.basename(b_yol)}")
    print("=" * 70)
    print(f"Toplam boyut: {n} bayt | Degisen bayt sayisi: {len(farkli)}")

    if not farkli:
        print("\nHic fark yok. Ya km degismemis ya ayni dokum. Tekrar dene:")
        print("km'yi belirgin degistir (orn. 5 km surerek) ve yeniden dokum al.")
        return

    if len(farkli) > 64:
        print("\nCok fazla bayt degismis (" + str(len(farkli)) + ").")
        print("Muhtemelen flash'in tamamini aldin; km disinda sayaclar/loglar da")
        print("degisiyor. Yine de degisen bolgeler asagida blok blok listelenir.")

    # Degisen baytlari ardisik bloklar halinde grupla
    bloklar = []
    bas = farkli[0]
    onceki = farkli[0]
    for i in farkli[1:]:
        if i == onceki + 1:
            onceki = i
        else:
            bloklar.append((bas, onceki))
            bas = i
            onceki = i
    bloklar.append((bas, onceki))

    print(f"\nDegisen {len(bloklar)} blok bulundu:\n")
    for (bas, son) in bloklar:
        uzunluk = son - bas + 1
        print(f"--- Adres 0x{bas:06X} - 0x{son:06X}  ({uzunluk} bayt) ---")
        ah = " ".join(f"{A[i]:02X}" for i in range(bas, son + 1))
        bh = " ".join(f"{B[i]:02X}" for i in range(bas, son + 1))
        print(f"   A: {ah}")
        print(f"   B: {bh}")
        # Bu blogun basindan olasi km yorumlari
        print("   Olasi km degerleri (A -> B):")
        for (etiket, _) in yorumla(A, bas):
            va = dict(yorumla(A, bas))[etiket]
            vb = dict(yorumla(B, bas))[etiket]
            fark = ""
            if isinstance(va, int) and isinstance(vb, int):
                d = vb - va
                fark = f"   (fark: {d:+d})"
            print(f"      {etiket:<10}: {va} -> {vb}{fark}")
        print()

    print("=" * 70)
    print("Hangi yorumun gercek km artisina uydugunu bul (orn. 5 km surduysen")
    print("'fark: +5' ya da olcege gore +50 olan satir km'dir). Bu ciktiyi")
    print("bana yapistir; adresi ve olcegi netlestirip yazma adimini kuralim.")


if __name__ == "__main__":
    main()
