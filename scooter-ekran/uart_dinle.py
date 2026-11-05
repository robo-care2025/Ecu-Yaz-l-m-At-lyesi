#!/usr/bin/env python3
"""
uart_dinle.py - Scooter ekranı <-> motor sürücüsü arasındaki UART hattını dinler.

Ne yapar?
  * Bir veya iki USB-TTL çeviriciden (CH340, CP2102, FT232...) gelen baytları okur.
  * Baytlar arasındaki boşluğa bakarak paketlere (çerçevelere) ayırır.
  * Her paketi HEX olarak, zaman damgasıyla ekrana yazar.
  * Aynı tür paketin bir önceki haline göre DEĞİŞEN baytları renkli gösterir
    (gaza bas, fren yap, vites değiştir -> hangi bayt değişiyor hemen görürsün).
  * Paketin sonundaki sağlama (checksum) türünü tahmin eder: SUM8, XOR, CRC16.
  * İstersen her şeyi CSV dosyasına kaydeder (sonra Excel'de veya bana gönderip inceleriz).
  * Baud hızını bilmiyorsan "--baud tara" ile otomatik dener.

Kurulum (bir kere):
    pip install pyserial

Örnekler:
    python uart_dinle.py --port COM5 --baud tara
    python uart_dinle.py --port COM5 --baud 9600 --kayit surus1.csv
    python uart_dinle.py --port COM5 --port COM6 --baud 9600      (iki yönü ayrı ayrı dinle)
    python uart_dinle.py --liste                                   (bağlı portları göster)

UYARI: Bu araç SADECE DİNLER, hatta hiçbir şey göndermez. USB-TTL'nin yalnızca
RX ve GND uçlarını bağla; TX ucunu boşta bırak.
"""

import argparse
import csv
import queue
import sys
import threading
import time
from collections import Counter

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    print("pyserial kurulu değil. Önce şunu çalıştır:  pip install pyserial")
    sys.exit(1)

TARANACAK_HIZLAR = [9600, 19200, 115200, 38400, 57600, 4800, 2400, 1200]

RENK_DEGISEN = "\033[1;33m"   # sarı-kalın: değişen bayt
RENK_ETIKET = ["\033[1;36m", "\033[1;35m"]  # port A camgöbeği, port B mor
RENK_SONU = "\033[0m"


# ----------------------------------------------------------------------------
# Sağlama (checksum) tahmini
# ----------------------------------------------------------------------------
def crc16_modbus(veri):
    crc = 0xFFFF
    for b in veri:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc


def saglama_tahmin(p):
    """Paketin son bayt(lar)ının hangi sağlama yöntemine uyduğunu bulur."""
    if len(p) < 3:
        return ""
    bulunan = []
    for bas in (0, 1, 2):            # başlık baytları hesaba katılmıyor olabilir
        govde = p[bas:-1]
        if not govde:
            continue
        if sum(govde) & 0xFF == p[-1]:
            bulunan.append(f"SUM8[{bas}:]")
        if (~sum(govde) & 0xFF) == p[-1] or ((-sum(govde)) & 0xFF) == p[-1]:
            bulunan.append(f"~SUM8[{bas}:]")
        x = 0
        for b in govde:
            x ^= b
        if x == p[-1]:
            bulunan.append(f"XOR[{bas}:]")
    if len(p) >= 4:
        crc = crc16_modbus(p[:-2])
        if p[-2] == (crc & 0xFF) and p[-1] == (crc >> 8):
            bulunan.append("CRC16-MODBUS")
        s16 = sum(p[:-2]) & 0xFFFF
        if (p[-2] << 8 | p[-1]) == s16 or (p[-1] << 8 | p[-2]) == s16:
            bulunan.append("SUM16")
        n16 = (~sum(p[:-2])) & 0xFFFF   # Ninebot tarzı
        if (p[-1] << 8 | p[-2]) == n16:
            bulunan.append("~SUM16(LE)")
    return ",".join(bulunan[:2])


# ----------------------------------------------------------------------------
# Port okuyucu: baytları paketlere böler, kuyruğa atar
# ----------------------------------------------------------------------------
def okuyucu(port_adi, baud, bosluk_s, etiket, kuyruk, dur):
    try:
        s = serial.Serial(port_adi, baud, timeout=bosluk_s)
    except serial.SerialException as e:
        kuyruk.put(("HATA", etiket, f"{port_adi} açılamadı: {e}", 0))
        return
    tampon = bytearray()
    son_bayt_zamani = time.time()
    while not dur.is_set():
        veri = s.read(256)
        simdi = time.time()
        if veri:
            if tampon and simdi - son_bayt_zamani > bosluk_s:
                kuyruk.put(("PAKET", etiket, bytes(tampon), son_bayt_zamani))
                tampon = bytearray()
            tampon += veri
            son_bayt_zamani = simdi
        elif tampon:  # zaman aşımı = hat sustu = paket bitti
            kuyruk.put(("PAKET", etiket, bytes(tampon), son_bayt_zamani))
            tampon = bytearray()
    s.close()


def varsayilan_bosluk(baud):
    # 1 bayt = 10 bit. 3 bayt süresi kadar sessizlik = yeni paket. En az 4 ms.
    return max(0.004, 30.0 / baud)


# ----------------------------------------------------------------------------
# Otomatik baud taraması
# ----------------------------------------------------------------------------
def baud_tara(port_adi, sure=2.5):
    print(f"[i] {port_adi} üzerinde baud taranıyor (her hız için {sure} sn)...")
    print("    Bu sırada scooter AÇIK olsun, mümkünse tekerleği çevir/gaza dokun.\n")
    sonuclar = []
    for baud in TARANACAK_HIZLAR:
        kuyruk, dur = queue.Queue(), threading.Event()
        t = threading.Thread(target=okuyucu, daemon=True,
                             args=(port_adi, baud, varsayilan_bosluk(baud), "A", kuyruk, dur))
        t.start()
        time.sleep(sure)
        dur.set()
        t.join()
        paketler = []
        while not kuyruk.empty():
            tur, _, p, _ = kuyruk.get()
            if tur == "HATA":
                print("[!]", p)
                return None
            paketler.append(p)
        toplam_bayt = sum(len(p) for p in paketler)
        if len(paketler) < 4:
            puan = 0.0
        else:
            # Doğru hızda aynı başlık + aynı uzunlukta paketler tekrar eder
            imza = Counter((p[0], len(p)) for p in paketler)
            puan = imza.most_common(1)[0][1] / len(paketler)
            # 00/FF yığını genelde yanlış hız belirtisi
            cop = sum(p.count(0) + p.count(0xFF) for p in paketler) / max(1, toplam_bayt)
            puan *= (1.0 - 0.7 * cop)
        sonuclar.append((puan, baud, len(paketler), toplam_bayt))
        print(f"    {baud:>6} baud: {len(paketler):>4} paket, {toplam_bayt:>5} bayt, puan {puan:.2f}")
    sonuclar.sort(reverse=True)
    en_iyi = sonuclar[0]
    if en_iyi[0] < 0.3:
        print("\n[!] Net bir hız bulunamadı. Bağlantıyı (RX ve GND) ve hat gerilimini kontrol et.")
        return None
    print(f"\n[✓] En olası hız: {en_iyi[1]} baud\n")
    return en_iyi[1]


# ----------------------------------------------------------------------------
# Ana program
# ----------------------------------------------------------------------------
def hex_bicimle(p, onceki, renk):
    parcalar = []
    for i, b in enumerate(p):
        h = f"{b:02X}"
        if onceki is not None and i < len(onceki) and onceki[i] != b:
            h = f"{RENK_DEGISEN}{h}{RENK_SONU}" if renk else f"[{h}]"
        parcalar.append(h)
    return " ".join(parcalar)


def main():
    ap = argparse.ArgumentParser(description="Scooter UART dinleyici (sadece okur).")
    ap.add_argument("--port", action="append", help="Seri port (COM5, /dev/ttyUSB0). İki kez verilebilir.")
    ap.add_argument("--baud", default="9600", help="Hız (ör. 9600) veya 'tara'")
    ap.add_argument("--bosluk", type=float, default=None, help="Paket ayırma boşluğu, ms")
    ap.add_argument("--kayit", help="CSV kayıt dosyası")
    ap.add_argument("--sadece-degisen", action="store_true", help="Değişmeyen tekrar paketleri gösterme")
    ap.add_argument("--renksiz", action="store_true", help="ANSI renk kullanma (değişenler [köşeli] olur)")
    ap.add_argument("--liste", action="store_true", help="Bağlı seri portları listele")
    a = ap.parse_args()

    if a.liste or not a.port:
        print("Bağlı seri portlar:")
        for p in list_ports.comports():
            print(f"  {p.device:15} {p.description}")
        if not a.port:
            print("\nKullanım: python uart_dinle.py --port COM5 --baud tara")
        return

    if sys.platform == "win32" and not a.renksiz:
        import os
        os.system("")  # Windows 10+ terminalinde ANSI renkleri açar

    if a.baud.lower() == "tara":
        baud = baud_tara(a.port[0])
        if baud is None:
            return
    else:
        baud = int(a.baud)

    bosluk = a.bosluk / 1000.0 if a.bosluk else varsayilan_bosluk(baud)
    kuyruk, dur = queue.Queue(), threading.Event()
    etiketler = ["A", "B"]
    for i, port in enumerate(a.port[:2]):
        threading.Thread(target=okuyucu, daemon=True,
                         args=(port, baud, bosluk, etiketler[i], kuyruk, dur)).start()
        print(f"[i] Port {etiketler[i]} = {port} @ {baud} baud")
    print(f"[i] Paket ayırma boşluğu: {bosluk*1000:.1f} ms.  Çıkmak için Ctrl+C\n")

    yazici = None
    if a.kayit:
        f = open(a.kayit, "w", newline="", encoding="utf-8")
        yazici = csv.writer(f)
        yazici.writerow(["zaman_s", "port", "uzunluk", "hex", "saglama"])

    son_hal = {}          # (port, ilk 2 bayt, uzunluk) -> son paket
    sayac = Counter()
    baslangic = time.time()
    try:
        while True:
            try:
                tur, etiket, p, zaman = kuyruk.get(timeout=0.5)
            except queue.Empty:
                continue
            if tur == "HATA":
                print("[!]", p)
                continue
            anahtar = (etiket, p[:2], len(p))
            onceki = son_hal.get(anahtar)
            son_hal[anahtar] = p
            sayac[anahtar] += 1
            sag = saglama_tahmin(p)
            if yazici:
                yazici.writerow([f"{zaman-baslangic:.3f}", etiket, len(p), p.hex(" ").upper(), sag])
            if a.sadece_degisen and onceki == p:
                continue
            renk = not a.renksiz
            et = f"{RENK_ETIKET[etiketler.index(etiket)]}{etiket}{RENK_SONU}" if renk else etiket
            print(f"{zaman-baslangic:9.3f} {et} ({len(p):2}) {hex_bicimle(p, onceki, renk)}"
                  + (f"   <{sag}>" if sag else ""))
    except KeyboardInterrupt:
        pass
    finally:
        dur.set()
        print("\n--- Özet: en sık görülen paket türleri ---")
        for (et, bas, uz), n in sayac.most_common(10):
            print(f"  Port {et}  başlık {bas.hex(' ').upper():6}  uzunluk {uz:3}  -> {n} adet")
        if yazici:
            f.close()
            print(f"[✓] Kayıt: {a.kayit}")


if __name__ == "__main__":
    main()
