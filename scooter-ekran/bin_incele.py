#!/usr/bin/env python3
"""
bin_incele.py - Nu-Link ile okunan MS51 yazılım dosyasına (.bin) ilk bakış.

Ne söyler?
  * Dosya boyutu, dolu / boş (FF) oranı -> çip kilitli miydi?
  * Dolu ve boş bölgelerin haritası (kod nerede, veri nerede, boşluk nerede)
  * Flash sonundaki küçük veri bölgeleri (ayarlar genelde burada durur)
  * Okunabilir metinler (sürüm, model adı vb.)
  * İki dosya verilirse farklarını listeler (ör. hız ayarı değiştirip tekrar okuyunca)

Kullanım:
    python bin_incele.py yedek.bin
    python bin_incele.py yedek_25kmh.bin yedek_30kmh.bin     (iki okumayı karşılaştır)
"""
import sys

BLOK = 256


def harita(veri):
    print(f"\nBölge haritası ({BLOK} baytlık bloklar):")
    onceki, bas = None, 0
    for i in range(0, len(veri) + BLOK, BLOK):
        blok = veri[i:i + BLOK]
        if not blok:
            durum = None
        elif all(b == 0xFF for b in blok):
            durum = "BOŞ (FF)"
        elif all(b == 0x00 for b in blok):
            durum = "SIFIR (00)"
        else:
            durum = "DOLU"
        if durum != onceki:
            if onceki is not None:
                print(f"  0x{bas:05X} - 0x{i - 1:05X}  {(i - bas):>6} bayt  {onceki}")
            onceki, bas = durum, i
    return


def metinler(veri, en_az=5):
    print(f"\nOkunabilir metinler (en az {en_az} karakter):")
    bulunan, bas, buf = 0, 0, bytearray()
    for i, b in enumerate(veri + b"\x00"):
        if 0x20 <= b < 0x7F:
            if not buf:
                bas = i
            buf.append(b)
        else:
            if len(buf) >= en_az:
                print(f"  0x{bas:05X}: {buf.decode('ascii')}")
                bulunan += 1
            buf = bytearray()
    if not bulunan:
        print("  (yok)")


def veri_bolgeleri(veri):
    """Büyük boşluktan sonra gelen küçük dolu bölgeler = muhtemel ayar alanı."""
    print("\nMuhtemel ayar / veri alanları (boşluk içinde küçük dolu adacıklar):")
    i, bulundu = 0, False
    while i < len(veri):
        if veri[i] != 0xFF:
            j = i
            while j < len(veri) and any(b != 0xFF for b in veri[j:j + 16]):
                j += 16
            boyut = j - i
            onu_bos = i >= 512 and all(b == 0xFF for b in veri[i - 512:i])
            if onu_bos and boyut <= 512:
                bulundu = True
                print(f"  0x{i:05X} ({boyut} bayt):")
                for k in range(i, min(j, i + 128), 16):
                    print("     " + " ".join(f"{b:02X}" for b in veri[k:k + 16]))
            i = j
        else:
            i += 1
    if not bulundu:
        print("  (belirgin bir adacık yok)")


def tek_dosya(yol):
    veri = open(yol, "rb").read()
    ff = veri.count(0xFF)
    print(f"Dosya: {yol}")
    print(f"Boyut: {len(veri)} bayt ({len(veri) / 1024:.1f} KB)")
    print(f"Boş (FF) oranı: %{100 * ff / max(1, len(veri)):.1f}")
    if ff == len(veri):
        print("\n[!] Dosyanın TAMAMI FF -> çip KİLİTLİ ya da okuma başarısız.")
        print("    ERASE YAPMA. UART dinleme yoluna geçiyoruz.")
        return
    if veri.count(0x00) == len(veri):
        print("\n[!] Dosyanın tamamı 00 -> bağlantı/okuma sorunu olabilir, kabloları kontrol et.")
        return
    print("\n[✓] Dosyada gerçek veri var -> çip kilitli DEĞİL. Bu dosya senin ana yedeğin, iki yere kopyala!")
    harita(veri)
    veri_bolgeleri(veri)
    metinler(veri)


def karsilastir(y1, y2):
    a, b = open(y1, "rb").read(), open(y2, "rb").read()
    print(f"Karşılaştırma: {y1}  <->  {y2}")
    farklar = [i for i in range(min(len(a), len(b))) if a[i] != b[i]]
    if len(a) != len(b):
        print(f"[!] Boyutlar farklı: {len(a)} / {len(b)}")
    print(f"Farklı bayt sayısı: {len(farklar)}\n")
    for i in farklar[:200]:
        print(f"  0x{i:05X}: {a[i]:02X} -> {b[i]:02X}   ({a[i]:>3} -> {b[i]:>3})")
    if len(farklar) > 200:
        print(f"  ... ve {len(farklar) - 200} fark daha")


if __name__ == "__main__":
    if len(sys.argv) == 2:
        tek_dosya(sys.argv[1])
    elif len(sys.argv) == 3:
        karsilastir(sys.argv[1], sys.argv[2])
    else:
        print(__doc__)
