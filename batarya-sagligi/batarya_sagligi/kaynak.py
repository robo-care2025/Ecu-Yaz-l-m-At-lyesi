"""Ölçümlerin geldiği yerler: simülatör, USB seri port (ESP32), kayıtlı CSV dosyası.

Hepsinin tek bir ortak işi var: `oku()` çağrılınca sırayla Olcum üretmek.
"""

import csv
import json
import math
import random
import time

from .analiz import soc_dan_hucre_voltaji
from .model import Olcum


class SimulatorKaynak:
    """Donanım olmadan denemek için sanal bir Ducati Pro 1 bataryası.

    Bilerek YAŞLANMIŞ bir paket taklit eder (6.4 Ah kapasite, 240 mΩ iç direnç);
    program doğru çalışıyorsa ekranda bu değerleri bulması gerekir.
    Döngü: dinlen -> sür (boşalana kadar) -> dinlen -> şarj et -> dinlen -> ...
    """

    def __init__(self, hiz: float = 60.0, kapasite_ah=6.4, ic_direnc=0.24, tohum=1):
        self.hiz = hiz  # 60 = 1 gerçek saniyede 1 dakikalık sürüş
        self.kapasite_ah = kapasite_ah
        self.r0 = ic_direnc
        self.rnd = random.Random(tohum)

    def uret(self):
        """Bekleme yapmadan ölçüm üretir (testlerde doğrudan kullanılır)."""
        rnd = self.rnd
        t, soc, v_rc, sicaklik = 0.0, 1.0, 0.0, 22.0
        faz, faz_bitis = "dinlen", 420.0
        sonraki_faz = "sur"
        parca_bitis, hedef_akim = 0.0, 0.0
        r1, tau, dt = 0.08, 30.0, 1.0

        while True:
            ocv = soc_dan_hucre_voltaji(soc) * 10
            if faz == "dinlen":
                akim = -0.04  # scooter açıkken ekranın çektiği akım
                if t >= faz_bitis:
                    faz = sonraki_faz
            elif faz == "sur":
                if t >= parca_bitis:
                    tip = rnd.choices(["hizlan", "seyir", "dur"], [3, 5, 2])[0]
                    if tip == "hizlan":
                        hedef_akim, sure = -rnd.uniform(11, 15), rnd.uniform(4, 8)
                    elif tip == "seyir":
                        hedef_akim, sure = -rnd.uniform(3.5, 7), rnd.uniform(20, 60)
                    else:
                        hedef_akim, sure = -0.05, rnd.uniform(5, 20)
                    parca_bitis = t + sure
                akim = hedef_akim
                if soc < 0.12:
                    faz, faz_bitis, sonraki_faz = "dinlen", t + 600, "sarj"
            else:  # şarj: önce sabit 2 A, 42 V'a gelince akım azalır
                akim = min(2.0, max(0.0, (42.0 - ocv - v_rc) / self.r0))
                if akim < 0.2:
                    faz, faz_bitis, sonraki_faz = "dinlen", t + 600, "sur"

            v_rc += (akim * r1 - v_rc) * (1 - math.exp(-dt / tau))
            v = ocv + akim * self.r0 + v_rc
            soc = min(1.0, max(0.0, soc + akim * dt / 3600 / self.kapasite_ah))
            sicaklik += (akim * akim * self.r0 * 0.004 - (sicaklik - 22.0) * 0.002) * dt

            yield Olcum(
                t=t,
                v=v + rnd.gauss(0, 0.01),
                i=akim + rnd.gauss(0, 0.02),
                sicaklik=sicaklik + rnd.gauss(0, 0.1),
            )
            t += dt

    def oku(self):
        for o in self.uret():
            yield o
            time.sleep(1.0 / self.hiz)


def satir_coz(satir: str) -> Olcum | None:
    """ESP32'den gelen bir satırı çözer. Örnek: {"t":12345,"v":38.21,"i":-3.42,"tc":24.5}"""
    satir = satir.strip()
    if not satir.startswith("{"):
        return None  # açılış mesajı vb.
    try:
        d = json.loads(satir)
        return Olcum(t=d["t"] / 1000.0, v=float(d["v"]), i=float(d["i"]), sicaklik=d.get("tc"))
    except (ValueError, KeyError, TypeError):
        return None  # bozuk satır; atla


class SeriKaynak:
    """USB ile bağlı ESP32 ölçüm modülünden okur."""

    def __init__(self, port: str, baud: int = 115200):
        self.port, self.baud = port, baud

    def oku(self):
        import serial  # pyserial; sadece gerçek donanımda gerekir

        while True:
            try:
                with serial.Serial(self.port, self.baud, timeout=2) as s:
                    print(f"[seri] {self.port} bağlandı")
                    while True:
                        o = satir_coz(s.readline().decode("utf-8", "replace"))
                        if o:
                            yield o
            except serial.SerialException as e:
                print(f"[seri] bağlantı yok ({e}); 3 sn sonra tekrar denenecek")
                time.sleep(3)


class DosyaKaynak:
    """Daha önce kaydedilmiş bir CSV oturumunu yeniden oynatır."""

    def __init__(self, yol: str, hiz: float = 50.0):
        self.yol, self.hiz = yol, hiz

    def oku(self):
        with open(self.yol, newline="", encoding="utf-8") as f:
            onceki_t = None
            for s in csv.DictReader(f):
                o = Olcum(
                    t=float(s["t"]), v=float(s["v"]), i=float(s["i"]),
                    sicaklik=float(s["sicaklik"]) if s.get("sicaklik") else None,
                )
                if onceki_t is not None and self.hiz > 0:
                    time.sleep(min(1.0, max(0.0, (o.t - onceki_t) / self.hiz)))
                onceki_t = o.t
                yield o
