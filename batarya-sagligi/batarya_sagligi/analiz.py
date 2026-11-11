"""Batarya sağlığı hesapları.

Üç şeyi ölçüyoruz:

1. ŞARJ SEVİYESİ (SoC): Batarya dinlenirken voltajından okunur (OCV tablosu),
   akım çekilirken giren-çıkan Amper-saat sayılarak takip edilir.
2. GERÇEK KAPASİTE: İki dinlenme noktası arasında "kaç Ah çıktı" / "şarj yüzde kaç
   düştü" oranı. Örn. %100'den %20'ye inerken 5.1 Ah çıktıysa kapasite 5.1/0.8 = 6.4 Ah.
3. İÇ DİRENÇ: Akım aniden değişince voltajın ne kadar çöktüğü (R = dV / dI).
   Yaşlanan bataryada iç direnç artar, gaza basınca voltaj daha çok düşer.
"""

from collections import deque
from statistics import median

from .model import Olcum, PaketAyar

# Li-ion (NMC/NCA) tek hücre için dinlenme voltajı -> şarj yüzdesi tablosu.
# Genel bir tablodur; hücre markasına göre birkaç puan oynayabilir.
OCV_TABLOSU = [
    (3.00, 0.00), (3.45, 0.05), (3.68, 0.10), (3.74, 0.20), (3.77, 0.30),
    (3.79, 0.40), (3.82, 0.50), (3.87, 0.60), (3.92, 0.70), (3.98, 0.80),
    (4.06, 0.90), (4.20, 1.00),
]


def _ara_deger(x, tablo):
    """Tabloda iki nokta arasını doğrusal olarak doldurur."""
    if x <= tablo[0][0]:
        return tablo[0][1]
    for (x0, y0), (x1, y1) in zip(tablo, tablo[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return tablo[-1][1]


def hucre_voltajindan_soc(v_hucre: float) -> float:
    return _ara_deger(v_hucre, OCV_TABLOSU)


def soc_dan_hucre_voltaji(soc: float) -> float:
    return _ara_deger(soc, [(s, v) for v, s in OCV_TABLOSU])


class BataryaAnalizci:
    AKIM_DINLENME_ESIGI = 0.15  # A - bunun altı "batarya dinleniyor" sayılır
    KAPASITE_MIN_SOC_FARKI = 0.25  # kapasite hesabı için en az %25'lik şarj değişimi
    DIRENC_MIN_AKIM_ADIMI = 2.0  # A - iç direnç için en az bu kadar ani akım değişimi
    GECMIS_ARALIK_SN = 5.0  # grafik için kaç saniyede bir nokta saklanacak

    def __init__(self, ayar: PaketAyar | None = None, dinlenme_sn: float = 300.0):
        self.ayar = ayar or PaketAyar()
        # Voltajın oturması için akımsız geçmesi gereken süre. Gerçek bataryada
        # ne kadar uzun beklenirse şarj seviyesi okuması o kadar doğru olur.
        self.dinlenme_sn = dinlenme_sn
        self.sifirla()

    def sifirla(self):
        self.son: Olcum | None = None
        self.olcum_sayisi = 0
        self.ah_sayac = 0.0  # net Ah (şarj +, deşarj -)
        self.desarj_ah = 0.0
        self.sarj_ah = 0.0
        self.desarj_wh = 0.0
        self.dinlenme_suresi = 0.0
        self._dinlenmede_esitlendi = False
        self._capa = None  # (ah_sayac, soc) - son güvenilir dinlenme noktası
        self._capalar: list[tuple[float, float]] = []
        self._soc_tahmini = True  # henüz hiç dinlenme noktası yoksa True
        self.soc = None
        self.kapasite_olcumleri: list[float] = []
        self.direnc_olcumleri: deque[float] = deque(maxlen=40)
        self._pencere: deque[Olcum] = deque()
        self._direnc_bekleme_t = -1e9
        self.v_en_dusuk = None
        self.v_en_yuksek = None
        self.i_en_yuksek_desarj = 0.0
        self.sicaklik_en_yuksek = None
        self.gecmis: deque[dict] = deque(maxlen=900)
        self._son_gecmis_t = -1e9

    # ------------------------------------------------------------------ hesap
    @property
    def kapasite_ah(self) -> float | None:
        """Ölçülen gerçek kapasite (son 5 ölçümün ortancası), yoksa None."""
        if not self.kapasite_olcumleri:
            return None
        return median(self.kapasite_olcumleri[-5:])

    @property
    def ic_direnc_mohm(self) -> float | None:
        if len(self.direnc_olcumleri) < 3:
            return None
        return median(self.direnc_olcumleri) * 1000

    def _voltajdan_soc(self, v: float) -> float:
        return hucre_voltajindan_soc(v / self.ayar.seri_hucre)

    def ekle(self, o: Olcum):
        onceki = self.son
        self.son = o
        self.olcum_sayisi += 1

        if onceki is None or o.t < onceki.t:
            # İlk ölçüm (ya da cihaz yeniden başladı): voltajdan kaba bir başlangıç yap.
            self._capa = (self.ah_sayac, self._voltajdan_soc(o.v))
            self.dinlenme_suresi = 0.0
            self._pencere.clear()
            dt = 0.0
        else:
            dt = o.t - onceki.t
            if dt > 30:  # veri kesilmiş; arayı sayma
                dt = 0.0
                self.dinlenme_suresi = 0.0
                self._pencere.clear()

        # 1) Amper-saat sayacı
        ah = o.i * dt / 3600.0
        self.ah_sayac += ah
        if ah < 0:
            self.desarj_ah -= ah
            self.desarj_wh -= ah * o.v
        else:
            self.sarj_ah += ah

        # 2) Dinlenme takibi ve voltajdan şarj seviyesi eşitleme
        if abs(o.i) < self.AKIM_DINLENME_ESIGI:
            self.dinlenme_suresi += dt
            if self.dinlenme_suresi >= self.dinlenme_sn and not self._dinlenmede_esitlendi:
                self._dinlenme_noktasi(o)
        else:
            self.dinlenme_suresi = 0.0
            self._dinlenmede_esitlendi = False

        # 3) Anlık şarj seviyesi = son dinlenme noktası + o zamandan beri sayılan Ah
        kap = self.kapasite_ah or self.ayar.nominal_kapasite_ah
        ah0, soc0 = self._capa
        self.soc = min(1.0, max(0.0, soc0 + (self.ah_sayac - ah0) / kap))

        # 4) İç direnç
        self._direnc_guncelle(o)

        # 5) İstatistikler
        self.v_en_dusuk = o.v if self.v_en_dusuk is None else min(self.v_en_dusuk, o.v)
        self.v_en_yuksek = o.v if self.v_en_yuksek is None else max(self.v_en_yuksek, o.v)
        self.i_en_yuksek_desarj = max(self.i_en_yuksek_desarj, -o.i)
        if o.sicaklik is not None:
            self.sicaklik_en_yuksek = (
                o.sicaklik if self.sicaklik_en_yuksek is None
                else max(self.sicaklik_en_yuksek, o.sicaklik)
            )

        if o.t - self._son_gecmis_t >= self.GECMIS_ARALIK_SN or o.t < self._son_gecmis_t:
            self._son_gecmis_t = o.t
            self.gecmis.append({
                "t": round(o.t, 1), "v": round(o.v, 2), "i": round(o.i, 2),
                "soc": round(self.soc * 100, 1),
            })

    def _dinlenme_noktasi(self, o: Olcum):
        """Batarya yeterince dinlendi: voltajdan gerçek şarj seviyesini oku."""
        self._dinlenmede_esitlendi = True
        soc = self._voltajdan_soc(o.v)
        yeni = (self.ah_sayac, soc)
        # Şarj seviyesi yeterince farklı olan en yakın eski nokta ile kapasite hesapla.
        for ah_eski, soc_eski in reversed(self._capalar):
            fark = abs(soc - soc_eski)
            if fark >= self.KAPASITE_MIN_SOC_FARKI:
                kapasite = abs(self.ah_sayac - ah_eski) / fark
                nominal = self.ayar.nominal_kapasite_ah
                if 0.2 * nominal <= kapasite <= 1.3 * nominal:  # saçma değerleri at
                    self.kapasite_olcumleri.append(kapasite)
                break
        self._capalar.append(yeni)
        self._capalar = self._capalar[-20:]
        self._capa = yeni
        self._soc_tahmini = False

    def _direnc_guncelle(self, o: Olcum):
        """Son ~2 saniyede akım aniden değiştiyse R = dV / dI hesapla."""
        p = self._pencere
        p.append(o)
        while p and o.t - p[0].t > 2.0:
            p.popleft()
        if len(p) < 2 or o.t - self._direnc_bekleme_t < 2.0:
            return
        eski = p[0]
        di = o.i - eski.i
        if abs(di) < self.DIRENC_MIN_AKIM_ADIMI:
            return
        r = (o.v - eski.v) / di
        if 0.02 < r < 1.0:  # 20 mΩ - 1 Ω arası mantıklı
            self.direnc_olcumleri.append(r)
            self._direnc_bekleme_t = o.t

    # ---------------------------------------------------------------- sonuç
    def uyarilar(self) -> list[str]:
        u = []
        a, o = self.ayar, self.son
        if o is None:
            return u
        if o.v < a.v_min:
            u.append(f"Voltaj çok düşük ({o.v:.1f} V). Derin deşarj hücrelere zarar verir.")
        if o.v > a.v_max + 0.5:
            u.append(f"Voltaj çok yüksek ({o.v:.1f} V). Şarj cihazını/BMS'i kontrol edin.")
        if o.sicaklik is not None and o.sicaklik > a.max_sicaklik:
            u.append(f"Batarya sıcak ({o.sicaklik:.0f} °C).")
        r = self.ic_direnc_mohm
        if r and r > 1.5 * a.referans_ic_direnc_mohm:
            u.append(
                f"İç direnç yüksek ({r:.0f} mΩ, referans {a.referans_ic_direnc_mohm:.0f} mΩ). "
                "Yük altında voltaj fazla çöküyor."
            )
        k = self.kapasite_ah
        if k and k < 0.7 * a.nominal_kapasite_ah:
            u.append(f"Kapasite etiket değerinin %70'inin altında ({k:.1f} Ah).")
        return u

    def durum(self) -> dict:
        """Arayüzün ve yapay zekânın kullandığı özet."""
        a, o = self.ayar, self.son
        k = self.kapasite_ah
        r = self.ic_direnc_mohm
        saglik = round(min(100.0, k / a.nominal_kapasite_ah * 100), 1) if k else None
        direnc_artis = round((r / a.referans_ic_direnc_mohm - 1) * 100) if r else None

        if saglik is None and r is None:
            etiket = "Veri toplanıyor"
        elif (saglik is not None and saglik < 70) or (direnc_artis is not None and direnc_artis > 80):
            etiket = "Zayıf"
        elif (saglik is not None and saglik < 85) or (direnc_artis is not None and direnc_artis > 40):
            etiket = "Orta"
        else:
            etiket = "İyi"

        return {
            "paket": {
                "ad": a.ad, "nominal_kapasite_ah": a.nominal_kapasite_ah,
                "seri_hucre": a.seri_hucre,
                "referans_ic_direnc_mohm": a.referans_ic_direnc_mohm,
            },
            "anlik": None if o is None else {
                "t": round(o.t, 1), "v": round(o.v, 2), "i": round(o.i, 2),
                "guc_w": round(o.v * o.i, 1),
                "hucre_v": round(o.v / a.seri_hucre, 3),
                "sicaklik": None if o.sicaklik is None else round(o.sicaklik, 1),
                "soc": None if self.soc is None else round(self.soc * 100, 1),
                "soc_tahmini": self._soc_tahmini,
                "dinleniyor": abs(o.i) < self.AKIM_DINLENME_ESIGI,
            },
            "saglik": {
                "etiket": etiket,
                "saglik_yuzde": saglik,
                "kapasite_ah": None if k is None else round(k, 2),
                "kapasite_olcum_sayisi": len(self.kapasite_olcumleri),
                "ic_direnc_mohm": None if r is None else round(r),
                "ic_direnc_artis_yuzde": direnc_artis,
                "direnc_olcum_sayisi": len(self.direnc_olcumleri),
            },
            "oturum": {
                "olcum_sayisi": self.olcum_sayisi,
                "desarj_ah": round(self.desarj_ah, 2),
                "sarj_ah": round(self.sarj_ah, 2),
                "desarj_wh": round(self.desarj_wh, 1),
                "v_en_dusuk": self.v_en_dusuk and round(self.v_en_dusuk, 2),
                "v_en_yuksek": self.v_en_yuksek and round(self.v_en_yuksek, 2),
                "i_en_yuksek_desarj": round(self.i_en_yuksek_desarj, 1),
                "sicaklik_en_yuksek": self.sicaklik_en_yuksek and round(self.sicaklik_en_yuksek, 1),
            },
            "uyarilar": self.uyarilar(),
            "gecmis": list(self.gecmis),
        }
