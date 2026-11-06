#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
01_DINLEYICI (Sniffer)
======================
Amac: Scooter gosterge kartinin UART (GND/RX/TX/3.3V) hattindan gecen
ham veriyi yakalamak, ekrana hex olarak yazmak ve bir dosyaya kaydetmek.

Bu programla HICBIR SEY YAZMIYORUZ. Sadece dinliyoruz. Yani karta zarar
verme ihtimali yok. Amac: veri icinde "km" degerini ve onu degistiren
komutu bulmak.

Gereken: USB-TTL donusturucu (FT232 / CP2102 / CH340) + pyserial

Kurulum (bir kere):
    pip install pyserial

Baglanti (ÇOK ÖNEMLİ):
    USB-TTL  <-->  Kart
    GND      <-->  GND
    RX       <-->  TX   (capraz!)
    TX       <-->  RX   (capraz!)   # dinlerken TX'i bagLAMAyabilirsin
    3.3V     <-->  3.3V (GEREKMEZ - karti kendi beslemesiyle calistir,
                        sadece GND ortak olsun. Besleme pinini bagLAMA.)

Calistirma:
    python 01_dinleyici.py                 # portu ve hizi otomatik dener
    python 01_dinleyici.py COM5 115200     # elle port ve hiz ver
    python 01_dinleyici.py /dev/ttyUSB0 9600
"""

import sys
import time
import os
import glob
import datetime

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    print("HATA: pyserial kurulu degil. Sunu calistir:  pip install pyserial")
    sys.exit(1)

# Bu kartlarda en sik gorulen hizlar (baud rate). Sirayla denenir.
OLASI_HIZLAR = [115200, 9600, 57600, 38400, 19200, 76800]

KAYIT_KLASORU = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kayitlar")


def port_bul():
    """Bagli seri portlari listeler, ilkini dondurur."""
    portlar = list(list_ports.comports())
    if not portlar:
        # Linux yedek: ttyUSB / ttyACM tara
        for p in glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*"):
            return p
        return None
    print("Bulunan portlar:")
    for p in portlar:
        print(f"   - {p.device}  ({p.description})")
    return portlar[0].device


def hiz_otomatik_bul(port):
    """Her hizda 2 saniye dinler, en anlamli (en cok veri gelen) hizi secer."""
    print("\nHiz (baud) otomatik aranıyor... Bu sirada scooter ACIK olsun,")
    print("mumkunse telefon uygulamasini da baglı tut ki veri aksin.\n")
    en_iyi_hiz = None
    en_cok_bayt = 0
    for hiz in OLASI_HIZLAR:
        try:
            s = serial.Serial(port, hiz, timeout=0.3)
        except Exception as e:
            print(f"   {hiz:>7} -> port acilamadi ({e})")
            continue
        time.sleep(0.2)
        s.reset_input_buffer()
        toplam = 0
        t0 = time.time()
        while time.time() - t0 < 2.0:
            n = s.in_waiting
            if n:
                toplam += len(s.read(n))
        s.close()
        damga = "  <-- en iyi aday" if toplam > en_cok_bayt else ""
        print(f"   {hiz:>7} -> {toplam:>5} bayt geldi{damga}")
        if toplam > en_cok_bayt:
            en_cok_bayt = toplam
            en_iyi_hiz = hiz
    if en_iyi_hiz and en_cok_bayt > 10:
        print(f"\nSecilen hiz: {en_iyi_hiz}\n")
        return en_iyi_hiz
    print("\nHicbir hizda anlamli veri gelmedi. Kontrol et:")
    print("  - Scooter acik mi?  - RX/TX capraz bagli mi?  - GND ortak mi?")
    return None


def dinle(port, hiz):
    zaman = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    kayit_yolu = os.path.join(KAYIT_KLASORU, f"ham_{zaman}_{hiz}.log")
    os.makedirs(KAYIT_KLASORU, exist_ok=True)

    print(f"Dinleniyor: {port} @ {hiz} baud")
    print(f"Kayit dosyasi: {kayit_yolu}")
    print("Durdurmak icin Ctrl+C.\n")
    print("IPUCU: Telefon uygulamasinda bir deger DEGISTIR (orn. km veya")
    print("       hiz limiti). O anda ekrana hangi baytlarin degistigine bak.\n")
    print("-" * 70)

    s = serial.Serial(port, hiz, timeout=0.05)
    tampon = bytearray()
    son_veri = time.time()

    with open(kayit_yolu, "w", encoding="utf-8") as f:
        f.write(f"# Ham UART kaydi - {zaman} - {hiz} baud\n")
        try:
            while True:
                n = s.in_waiting
                if n:
                    tampon += s.read(n)
                    son_veri = time.time()
                # ~15 ms veri gelmezse bir "cerceve" bitmistir, yazdir
                elif tampon and (time.time() - son_veri) > 0.015:
                    t = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
                    hexstr = " ".join(f"{b:02X}" for b in tampon)
                    satir = f"[{t}] ({len(tampon):>3}B) {hexstr}"
                    print(satir)
                    f.write(satir + "\n")
                    f.flush()
                    tampon = bytearray()
                else:
                    time.sleep(0.002)
        except KeyboardInterrupt:
            print("\n\nDurduruldu. Kayit kaydedildi:")
            print(kayit_yolu)
        finally:
            s.close()


def main():
    print("=" * 70)
    print(" SCOOTER GOSTERGE - UART DINLEYICI (sadece okur, yazmaz)")
    print("=" * 70)

    port = sys.argv[1] if len(sys.argv) > 1 else port_bul()
    if not port:
        print("\nSeri port bulunamadi. USB-TTL takili mi? Surucu kurulu mu?")
        return

    if len(sys.argv) > 2:
        hiz = int(sys.argv[2])
    else:
        hiz = hiz_otomatik_bul(port)
        if not hiz:
            return

    dinle(port, hiz)


if __name__ == "__main__":
    main()
