"""Temel veri tipleri: tek bir ölçüm ve batarya paketinin ayarları."""

from dataclasses import dataclass


@dataclass
class Olcum:
    """Ölçüm modülünden gelen tek bir satır.

    t        : saniye cinsinden zaman (cihaz açıldığından beri)
    v        : paket voltajı (Volt)
    i        : akım (Amper). ARTI = şarj oluyor, EKSİ = deşarj oluyor (akım çekiliyor)
    sicaklik : batarya sıcaklığı (°C), sensör yoksa None
    """

    t: float
    v: float
    i: float
    sicaklik: float | None = None


@dataclass
class PaketAyar:
    """Test edilen bataryanın etiket değerleri.

    Varsayılanlar Ducati Pro 1 içindir (36 V, 7.8 Ah, 280 Wh - kullanım kılavuzu değerleri).
    Başka bir scooter için sadece bu değerleri değiştirmek yeterli.
    """

    ad: str = "Ducati Pro 1"
    seri_hucre: int = 10  # 36 V paket = 10 hücre seri
    nominal_kapasite_ah: float = 7.8
    v_min: float = 30.0  # bunun altı derin deşarj
    v_max: float = 42.0  # tam dolu voltaj
    # Yeni paketin beklenen iç direnci. Bu bir VARSAYIMDIR (hücre + BMS + kablo);
    # sağlam olduğu bilinen bir paketi ölçünce buraya o değer yazılmalı.
    referans_ic_direnc_mohm: float = 180.0
    max_sicaklik: float = 55.0
