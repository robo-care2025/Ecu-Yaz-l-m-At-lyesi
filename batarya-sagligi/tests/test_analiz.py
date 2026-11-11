"""Analiz doğru mu? Simülatörün bildiğimiz değerlerini (6.4 Ah, 240 mΩ) geri bulmalı.

Çalıştırmak için (batarya-sagligi klasöründe):  python -m unittest discover tests
"""

import itertools
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from batarya_sagligi.analiz import BataryaAnalizci, hucre_voltajindan_soc, soc_dan_hucre_voltaji
from batarya_sagligi.kaynak import SimulatorKaynak, satir_coz
from batarya_sagligi.model import Olcum
from batarya_sagligi.yapay_zeka import yerel_rapor


def simule_et(saniye, **kw):
    a = BataryaAnalizci()
    for o in itertools.islice(SimulatorKaynak(**kw).uret(), saniye):
        a.ekle(o)
    return a


class OcvTesti(unittest.TestCase):
    def test_tablo_uclari(self):
        self.assertEqual(hucre_voltajindan_soc(4.2), 1.0)
        self.assertEqual(hucre_voltajindan_soc(2.5), 0.0)
        self.assertAlmostEqual(hucre_voltajindan_soc(3.82), 0.5)

    def test_gidis_donus(self):
        for soc in (0.07, 0.33, 0.5, 0.95):
            self.assertAlmostEqual(hucre_voltajindan_soc(soc_dan_hucre_voltaji(soc)), soc, places=6)


class AnalizTesti(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a = simule_et(3 * 3600)  # 3 saatlik sanal kullanım: sürüş + dinlenme

    def test_kapasite_bulunur(self):
        self.assertIsNotNone(self.a.kapasite_ah)
        self.assertAlmostEqual(self.a.kapasite_ah, 6.4, delta=6.4 * 0.05)

    def test_ic_direnc_bulunur(self):
        self.assertAlmostEqual(self.a.ic_direnc_mohm, 240, delta=24)

    def test_durum_ozeti(self):
        d = self.a.durum()
        self.assertEqual(d["saglik"]["etiket"], "Orta")  # %82 kapasite
        self.assertAlmostEqual(d["saglik"]["saglik_yuzde"], 82, delta=4)
        self.assertFalse(d["anlik"]["soc_tahmini"])
        self.assertIn("6.", yerel_rapor(d))

    def test_saglam_paket_iyi_cikar(self):
        a = simule_et(3 * 3600, kapasite_ah=7.7, ic_direnc=0.18)
        self.assertEqual(a.durum()["saglik"]["etiket"], "İyi")

    def test_soc_sayaci(self):
        a = BataryaAnalizci()
        v = soc_dan_hucre_voltaji(0.8) * 10
        for t in range(0, 3601):  # 1 saat boyunca 3.9 A çek -> 3.9 Ah = %50
            a.ekle(Olcum(t=t, v=v, i=-3.9))
        self.assertAlmostEqual(a.soc, 0.8 - 0.5, places=2)
        self.assertAlmostEqual(a.desarj_ah, 3.9, places=2)

    def test_veri_kesintisi_sayilmaz(self):
        a = BataryaAnalizci()
        a.ekle(Olcum(t=0, v=38, i=-5))
        a.ekle(Olcum(t=1000, v=38, i=-5))  # 1000 sn boşluk: Ah eklenmemeli
        self.assertEqual(a.desarj_ah, 0)

    def test_bos_durum(self):
        d = BataryaAnalizci().durum()
        self.assertIsNone(d["anlik"])
        self.assertEqual(d["saglik"]["etiket"], "Veri toplanıyor")


class SatirTesti(unittest.TestCase):
    def test_gecerli(self):
        o = satir_coz('{"t":12500,"v":38.21,"i":-3.42,"tc":24.5}\r\n')
        self.assertEqual((o.t, o.v, o.i, o.sicaklik), (12.5, 38.21, -3.42, 24.5))

    def test_sicakliksiz_ve_bozuk(self):
        self.assertIsNone(satir_coz('{"t":1,"v":38,"i":0}').sicaklik)
        self.assertIsNone(satir_coz("Batarya olcer basladi"))
        self.assertIsNone(satir_coz('{"t":12,"v":3'))


if __name__ == "__main__":
    unittest.main()
