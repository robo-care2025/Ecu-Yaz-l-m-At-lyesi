"""Küçük web sunucusu: ölçümleri arka planda okur, tarayıcıya ekranı ve veriyi verir.

Ek kütüphane gerektirmez (Python'un kendi http.server modülü).
"""

import csv
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import yapay_zeka
from .analiz import BataryaAnalizci

WEB_DIZINI = Path(__file__).parent / "web"


class Uygulama:
    def __init__(self, kaynak, analizci: BataryaAnalizci, kaynak_adi: str, kayit_yolu: Path | None):
        self.kaynak, self.analizci, self.kaynak_adi = kaynak, analizci, kaynak_adi
        self.kayit_yolu = kayit_yolu
        self.kilit = threading.Lock()
        self.son_veri_zamani = 0.0

    def okuma_dongusu(self):
        yazici = dosya = None
        if self.kayit_yolu:
            self.kayit_yolu.parent.mkdir(parents=True, exist_ok=True)
            dosya = open(self.kayit_yolu, "w", newline="", encoding="utf-8")
            yazici = csv.writer(dosya)
            yazici.writerow(["t", "v", "i", "sicaklik"])
        for o in self.kaynak.oku():
            with self.kilit:
                self.analizci.ekle(o)
                self.son_veri_zamani = time.time()
            if yazici:
                yazici.writerow([o.t, o.v, o.i, "" if o.sicaklik is None else o.sicaklik])
                dosya.flush()

    def durum(self) -> dict:
        with self.kilit:
            d = self.analizci.durum()
            d["baglanti"] = {
                "kaynak": self.kaynak_adi,
                "veri_geliyor": time.time() - self.son_veri_zamani < 5,
                "kayit": str(self.kayit_yolu) if self.kayit_yolu else None,
            }
            return d

    def sifirla(self):
        with self.kilit:
            self.analizci.sifirla()


def isleyici_olustur(uyg: Uygulama):
    class Isleyici(BaseHTTPRequestHandler):
        def log_message(self, *a):  # her isteği ekrana yazma
            pass

        def _gonder(self, kod, govde: bytes, tip="application/json; charset=utf-8"):
            self.send_response(kod)
            self.send_header("Content-Type", tip)
            self.send_header("Content-Length", str(len(govde)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(govde)

        def _json(self, veri, kod=200):
            self._gonder(kod, json.dumps(veri, ensure_ascii=False).encode("utf-8"))

        def do_GET(self):
            if self.path in ("/", "/index.html"):
                self._gonder(200, (WEB_DIZINI / "index.html").read_bytes(), "text/html; charset=utf-8")
            elif self.path == "/api/durum":
                self._json(uyg.durum())
            else:
                self._json({"hata": "bulunamadı"}, 404)

        def do_POST(self):
            if self.path == "/api/rapor":
                self._json(yapay_zeka.rapor_uret(uyg.durum()))
            elif self.path == "/api/sifirla":
                uyg.sifirla()
                self._json({"tamam": True})
            else:
                self._json({"hata": "bulunamadı"}, 404)

    return Isleyici


def calistir(uyg: Uygulama, host: str, port: int):
    threading.Thread(target=uyg.okuma_dongusu, daemon=True).start()
    sunucu = ThreadingHTTPServer((host, port), isleyici_olustur(uyg))
    print(f"\n  Batarya Sağlığı çalışıyor ->  http://localhost:{port}\n  (Durdurmak için Ctrl+C)\n")
    try:
        sunucu.serve_forever()
    except KeyboardInterrupt:
        print("\nKapatıldı.")
