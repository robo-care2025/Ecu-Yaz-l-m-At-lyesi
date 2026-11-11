"""Batarya Sağlığı programını başlatır.

Donanım olmadan denemek için:      python baslat.py
ESP32 ölçüm modülü ile (Windows):   python baslat.py --port COM5
ESP32 ölçüm modülü ile (Linux):     python baslat.py --port /dev/ttyUSB0
Eski bir kaydı yeniden izlemek:     python baslat.py --dosya kayitlar/oturum_....csv
"""

import argparse
import time
from pathlib import Path

from batarya_sagligi.analiz import BataryaAnalizci
from batarya_sagligi.kaynak import DosyaKaynak, SeriKaynak, SimulatorKaynak
from batarya_sagligi.model import PaketAyar
from batarya_sagligi.sunucu import Uygulama, calistir


def main():
    p = argparse.ArgumentParser(description="Batarya Sağlığı")
    p.add_argument("--port", help="ESP32'nin seri portu (örn. COM5). Verilmezse simülatör çalışır.")
    p.add_argument("--dosya", help="Yeniden oynatılacak CSV kaydı")
    p.add_argument("--hiz", type=float, default=60, help="Simülatör/kayıt oynatma hızı (kat)")
    p.add_argument("--kapasite", type=float, default=7.8, help="Bataryanın etiket kapasitesi (Ah)")
    p.add_argument("--dinlenme", type=float, default=300,
                   help="Voltajdan şarj seviyesi okumak için akımsız bekleme süresi (sn)")
    p.add_argument("--web-port", type=int, default=8000)
    p.add_argument("--host", default="127.0.0.1",
                   help="Telefondan da bakmak için 0.0.0.0 yazın (aynı Wi-Fi'da)")
    a = p.parse_args()

    kayit = None
    if a.port:
        kaynak, ad = SeriKaynak(a.port), f"ESP32 ({a.port})"
        kayit = Path("kayitlar") / time.strftime("oturum_%Y%m%d_%H%M%S.csv")
    elif a.dosya:
        kaynak, ad = DosyaKaynak(a.dosya, a.hiz), f"Kayıt ({Path(a.dosya).name})"
    else:
        kaynak, ad = SimulatorKaynak(hiz=a.hiz), "Simülatör (sanal batarya)"

    analizci = BataryaAnalizci(PaketAyar(nominal_kapasite_ah=a.kapasite), dinlenme_sn=a.dinlenme)
    calistir(Uygulama(kaynak, analizci, ad, kayit), a.host, a.web_port)


if __name__ == "__main__":
    main()
