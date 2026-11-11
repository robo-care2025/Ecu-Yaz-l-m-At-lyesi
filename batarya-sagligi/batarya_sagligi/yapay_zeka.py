"""Ölçüm özetini Claude'a gönderip Türkçe batarya sağlık raporu alır.

API anahtarı yoksa program yine çalışır: basit, kural tabanlı bir yerel rapor üretir.
Anahtar için: https://platform.claude.com -> API Keys, sonra programı başlatmadan önce
ANTHROPIC_API_KEY ortam değişkenine yazın (README'de adım adım anlatılıyor).
"""

import json

MODEL = "claude-opus-5-5"

SISTEM = """Sen elektrikli scooter bataryaları konusunda uzman bir servis teknisyenisin.
Sana bir Li-ion batarya paketinin ölçüm özeti JSON olarak verilecek. Ölçümler paketin
dışından alınıyor: toplam voltaj, akım (artı = şarj, eksi = deşarj) ve varsa sıcaklık.
Tek tek hücre voltajları YOK; hücre dengesizliği hakkında kesin konuşma, sadece
şüphe varsa hangi ölçümle doğrulanacağını söyle.

Raporu Türkçe, bir elektronik teknisyeninin müşterisine de gösterebileceği sadelikte yaz:
1. Genel durum (tek cümle, net hüküm)
2. Bulgular (kapasite, iç direnç, voltaj çökmesi, sıcaklık - rakamlarla)
3. Olası nedenler
4. Öneriler (kullanıcıya ve teknisyene ayrı ayrı)
5. Bu ölçümün güvenilirliği (veri yetersizse açıkça söyle; null olan değerleri uydurma)

"referans_ic_direnc_mohm" yeni paket için bir varsayımdır, kesin fabrika değeri değildir.
Kısa tut: en fazla 300 kelime."""


def _ozet_hazirla(durum: dict) -> str:
    d = dict(durum)
    g = d.pop("gecmis", [])
    adim = max(1, len(g) // 120)  # grafiğin en fazla ~120 noktasını gönder
    d["gecmis_ornek"] = g[::adim]
    return json.dumps(d, ensure_ascii=False)


def yerel_rapor(durum: dict) -> str:
    s, o = durum["saglik"], durum["oturum"]
    satirlar = [f"Genel durum: {s['etiket']}"]
    if s["kapasite_ah"] is not None:
        satirlar.append(
            f"Ölçülen kapasite {s['kapasite_ah']} Ah "
            f"(etiket {durum['paket']['nominal_kapasite_ah']} Ah) -> sağlık %{s['saglik_yuzde']}."
        )
    else:
        satirlar.append(
            "Kapasite henüz ölçülemedi. Bunun için bataryayı doluyken dinlendirip en az "
            "%25 boşaltın ve tekrar dinlendirin."
        )
    if s["ic_direnc_mohm"] is not None:
        satirlar.append(
            f"İç direnç {s['ic_direnc_mohm']} mΩ (referansa göre %{s['ic_direnc_artis_yuzde']:+d})."
        )
    else:
        satirlar.append("İç direnç henüz ölçülemedi (ani gaz/fren gerekiyor).")
    satirlar.append(
        f"Bu oturumda {o['desarj_ah']} Ah ({o['desarj_wh']} Wh) harcandı, "
        f"en yüksek akım {o['i_en_yuksek_desarj']} A, en düşük voltaj {o['v_en_dusuk']} V."
    )
    satirlar += [f"UYARI: {u}" for u in durum["uyarilar"]]
    return "\n".join(satirlar)


def rapor_uret(durum: dict) -> dict:
    """{'kaynak': 'claude' | 'yerel', 'metin': ..., 'not': ...} döndürür."""
    if durum.get("anlik") is None:
        return {"kaynak": "yerel", "metin": "Henüz ölçüm yok.", "not": ""}

    def yerel(neden: str) -> dict:
        return {"kaynak": "yerel", "metin": yerel_rapor(durum), "not": neden}

    try:
        import anthropic
    except ImportError:
        return yerel("Yapay zekâ kütüphanesi kurulu değil (pip install anthropic).")

    try:
        istemci = anthropic.Anthropic()
        # 'fallbacks': model bir isteği güvenlik nedeniyle yanıtlamazsa istek otomatik
        # olarak yedek modele gider; rapor yarıda kalmaz.
        yanit = istemci.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium"},
            system=SISTEM,
            messages=[{"role": "user", "content": _ozet_hazirla(durum)}],
        )
    except anthropic.AuthenticationError:
        return yerel("API anahtarı geçersiz.")
    except anthropic.RateLimitError:
        return yerel("Yapay zekâ servisi şu an yoğun; biraz sonra tekrar deneyin.")
    except anthropic.APIStatusError as e:
        return yerel(f"Yapay zekâ servisi hata verdi ({e.status_code}).")
    except anthropic.APIConnectionError:
        return yerel("İnternet bağlantısı yok.")
    except Exception:  # anahtar hiç tanımlı değilse SDK burada hata verir
        return yerel("Yapay zekâ anahtarı tanımlı değil (README'de 'Yapay zekâyı açmak' bölümü).")

    if yanit.stop_reason == "refusal":
        return yerel("Yapay zekâ bu isteği yanıtlamadı.")
    metin = "\n".join(b.text for b in yanit.content if b.type == "text").strip()
    if not metin:
        return yerel("Yapay zekâ boş yanıt döndürdü.")
    return {"kaynak": "claude", "metin": metin, "not": ""}
