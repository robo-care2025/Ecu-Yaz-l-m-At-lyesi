#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
02_FARK_BULUCU
==============
Amac: km degerinin hangi baytlarda saklandigini BULMAK.

Mantik: Gostergedeki km degeri X iken bir kayit al, sonra deger Y iken
baska bir kayit al. Iki kayitta SADECE km ile ilgili baytlar degisir.
Bu program o degisen baytlari isaretler.

Kullanim:
    1) Scooter'i X km'de birak, 01_dinleyici.py ile ~10 sn kayit al -> dosya A
    2) km'yi degistir (orn. biraz sur ya da uygulamadan degistir),
       tekrar kayit al -> dosya B
    3) python 02_fark_bulucu.py kayitlar/dosyaA.log kayitlar/dosyaB.log

Not: Ayni UZUNLUKTAKI cerceveleri karsilastirir (gercek telemetri
cerceveleri genelde sabit uzunluktadir).
"""

import sys
import os
from collections import defaultdict


def cerceveleri_oku(dosya):
    """Log dosyasindan hex cerceveleri okur. Uzunluga gore gruplar."""
    gruplar = defaultdict(list)
    with open(dosya, "r", encoding="utf-8") as f:
        for satir in f:
            satir = satir.strip()
            if not satir or satir.startswith("#"):
                continue
            # "[zaman] (NB) AA BB CC ..." formatindan hex kismini al
            if ")" in satir:
                hexkisim = satir.split(")", 1)[1].strip()
            else:
                hexkisim = satir
            try:
                baytlar = bytes(int(x, 16) for x in hexkisim.split())
            except ValueError:
                continue
            if baytlar:
                gruplar[len(baytlar)].append(baytlar)
    return gruplar


def temsilci_cerceve(cerceveler):
    """Bir gruptaki cerceveleri bayt bayt karsilastirip 'en sik' halini
    ve hangi baytlarin grup icinde sabit kaldigini bulur."""
    uzunluk = len(cerceveler[0])
    sonuc = bytearray(uzunluk)
    sabit = [True] * uzunluk
    for i in range(uzunluk):
        degerler = [c[i] for c in cerceveler]
        sonuc[i] = max(set(degerler), key=degerler.count)  # en sik deger
        if len(set(degerler)) > 1:
            sabit[i] = False  # bu bayt grup icinde oynuyor (telemetri olabilir)
    return bytes(sonuc), sabit


def main():
    if len(sys.argv) < 3:
        print("Kullanim: python 02_fark_bulucu.py <kayitA.log> <kayitB.log>")
        return
    dosyaA, dosyaB = sys.argv[1], sys.argv[2]
    for d in (dosyaA, dosyaB):
        if not os.path.exists(d):
            print(f"HATA: bulunamadi -> {d}")
            return

    A = cerceveleri_oku(dosyaA)
    B = cerceveleri_oku(dosyaB)

    ortak_uzunluklar = sorted(set(A) & set(B))
    if not ortak_uzunluklar:
        print("Iki dosyada ortak uzunlukta cerceve yok. Kayitlari kontrol et.")
        print(f"  A uzunluklari: {sorted(A)}")
        print(f"  B uzunluklari: {sorted(B)}")
        return

    print("=" * 70)
    print(" FARK ANALIZI  (A = ilk durum, B = km degistikten sonra)")
    print("=" * 70)

    for uzunluk in ortak_uzunluklar:
        if len(A[uzunluk]) < 2 or len(B[uzunluk]) < 2:
            continue
        ca, sabitA = temsilci_cerceve(A[uzunluk])
        cb, sabitB = temsilci_cerceve(B[uzunluk])

        farkli = [i for i in range(uzunluk) if ca[i] != cb[i]]
        if not farkli:
            continue

        print(f"\n### {uzunluk} baytlik cerceve ###")
        print("Konum:  " + " ".join(f"{i:02d}" for i in range(uzunluk)))
        print("A    :  " + " ".join(f"{b:02X}" for b in ca))
        print("B    :  " + " ".join(f"{b:02X}" for b in cb))
        isaret = []
        for i in range(uzunluk):
            if i in farkli:
                isaret.append("^^")
            else:
                isaret.append("  ")
        print("Fark :  " + " ".join(isaret))
        print(f"\nDEGISEN KONUMLAR: {farkli}")
        print("Bu baytlar km (veya degistirdigin deger) ile ilgili olabilir.")
        print("Ipucu: km genelde 2 veya 4 bayt, little-endian (ters sirali) tutulur.")
        for i in farkli:
            print(f"   konum {i}: A=0x{ca[i]:02X}({ca[i]})  ->  B=0x{cb[i]:02X}({cb[i]})")

    print("\n" + "=" * 70)
    print("Bu ciktiyi bana (Claude'a) yapistir; km baytlarini birlikte")
    print("netlestirip yazma komutunu ve checksum'i cikaralim.")


if __name__ == "__main__":
    main()
