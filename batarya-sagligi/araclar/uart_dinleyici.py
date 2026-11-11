"""BMS veri hattı dinleyici.

Amaç: Bataryadan kontrol kartına giden ince kabloda BMS'in veri yollayıp
yollamadığını ve hangi hızda (baud) konuştuğunu bulmak. Sadece DİNLER, hiçbir
şey göndermez.

ÖNCE OKUYUN (docs/DONANIM.md, "BMS veri hattı" bölümü):
  - Hattın voltajını multimetre ile ölçün. 3.3 V'tan yüksekse voltaj bölücü şart.
  - USB-TTL adaptörün sadece RX ve GND uçlarını bağlayın. TX BAĞLANMAZ.

Kullanım:
  python araclar/uart_dinleyici.py COM7              -> yaygın hızları sırayla dener
  python araclar/uart_dinleyici.py COM7 --baud 9600  -> tek hızda sürekli dinler, dosyaya yazar
"""

import argparse
import sys
import time

HIZLAR = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200]


def puanla(veri: bytes) -> float:
    """0-1 arası kaba bir 'anlamlı veri' puanı verir.

    Yanlış hızda okunan veri çoğunlukla 0x00 / 0xFF yığınıdır; doğru hızda
    farklı baytlar görülür. Kesin sonuç değil, sadece ipucudur.
    """
    if len(veri) < 16:
        return 0.0
    sayim = {}
    for b in veri:
        sayim[b] = sayim.get(b, 0) + 1
    # Çerçeve hatası olan yanlış hızlarda 0x00 / 0xFF yığılır; onları ödüllendirme.
    anlamli = sum(n for b, n in sayim.items() if b not in (0x00, 0xFF))
    cesit = len(sayim)
    return round(anlamli / len(veri) * min(1.0, cesit / 8), 2)


def dinle(port, baud, sure):
    import serial

    with serial.Serial(port, baud, timeout=0.2) as s:
        s.reset_input_buffer()
        bitis, veri = time.time() + sure, bytearray()
        while time.time() < bitis:
            veri += s.read(256)
        return bytes(veri)


def hex_yaz(veri: bytes, satir=16) -> str:
    return "\n".join(
        "  " + " ".join(f"{b:02X}" for b in veri[n:n + satir]) for n in range(0, len(veri), satir)
    )


def main():
    p = argparse.ArgumentParser(description="BMS veri hattı dinleyici (sadece okur)")
    p.add_argument("port", help="USB-TTL adaptörün portu, örn. COM7 veya /dev/ttyUSB0")
    p.add_argument("--baud", type=int, help="Tek bir hızda sürekli dinle")
    p.add_argument("--sure", type=float, default=4, help="Her hız için dinleme süresi (sn)")
    a = p.parse_args()

    try:
        import serial  # noqa: F401
    except ImportError:
        sys.exit("pyserial kurulu değil:  pip install pyserial")

    if a.baud:
        dosya = time.strftime(f"bms_ham_{a.baud}_%Y%m%d_%H%M%S.bin")
        print(f"{a.baud} baud dinleniyor, ham veri '{dosya}' dosyasına yazılıyor. Durdurmak: Ctrl+C")
        with open(dosya, "wb") as f:
            try:
                while True:
                    veri = dinle(a.port, a.baud, 1)
                    if veri:
                        f.write(veri)
                        f.flush()
                        print(f"[{time.strftime('%H:%M:%S')}] {len(veri)} bayt\n{hex_yaz(veri)}")
            except KeyboardInterrupt:
                print("\nDurduruldu.")
        return

    print("Scooter açık olsun. Her hız birkaç saniye dinlenecek...\n")
    sonuc = []
    for baud in HIZLAR:
        veri = dinle(a.port, baud, a.sure)
        sonuc.append((puanla(veri), baud, veri))
        print(f"{baud:>7} baud: {len(veri):>5} bayt, düzenlilik {puanla(veri)}")
        if veri:
            print(hex_yaz(veri[:48]))

    if not any(v for _, _, v in sonuc):
        print("\nHiç veri gelmedi. Ya bu kabloda veri yok (BMS haberleşmesiz olabilir),"
              "\nya da yanlış kablo/GND bağlantısı. Bu durumda harici ölçüm modülü ile devam edilir.")
        return
    puan, baud, _ = max(sonuc, key=lambda x: (x[0], len(x[2])))
    print(f"\nEn olası hız: {baud} baud (kesin değil, puan {puan}).")
    print(f"Doğrulamak için:  python araclar/uart_dinleyici.py {a.port} --baud {baud}")
    print("Aynı bayt dizisi düzenli tekrar ediyorsa doğru hızdır. Çıkan .bin dosyasını saklayın;")
    print("protokolü çözmek için o dosyaya ihtiyacımız olacak.")


if __name__ == "__main__":
    main()
