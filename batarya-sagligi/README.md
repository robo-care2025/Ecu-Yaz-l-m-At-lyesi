# Batarya Sağlığı (prototip)

Elektrikli scooter bataryasının **gerçek kapasitesini** ve **iç direncini** ölçüp
yapay zekâ ile Türkçe sağlık raporu çıkaran program. İlk test aracı: **Ducati Pro 1**
(36 V, 7.8 Ah). BMS'inde Bluetooth olmadığı için veriyi kendi ölçüm modülümüzle alıyoruz.

```
 Batarya ──► Ölçüm modülü (ESP32 + INA226) ──USB──► Bilgisayardaki program ──► Tarayıcıda ekran
             voltaj · akım · sıcaklık                kapasite · iç direnç        + yapay zekâ raporu
```

## Hemen denemek (donanım gerekmez)

1. Bilgisayara [Python](https://www.python.org/downloads/) kurun (3.10 veya üstü;
   kurulumda "Add Python to PATH" kutusunu işaretleyin).
2. Bu klasörde komut satırını açıp yazın:
   ```
   python baslat.py
   ```
3. Tarayıcıda **http://localhost:8000** adresini açın.

Donanım bağlı olmadığında program **sanal bir batarya** ile çalışır. Bu sanal
batarya bilerek yaşlı yapılmıştır (6.4 Ah, 240 mΩ); bir-iki dakika içinde ekranda
"Orta — sağlık %82" görmeniz programın doğru hesapladığını gösterir.

## Gerçek batarya ile

1. Ölçüm modülünü kurun: [docs/DONANIM.md](docs/DONANIM.md)
2. `pip install pyserial`
3. `python baslat.py --port COM5` (port numarası Aygıt Yöneticisi'nde görünür)

Her oturum `kayitlar/` klasörüne CSV olarak kaydedilir; sonradan
`python baslat.py --dosya kayitlar/oturum_....csv` ile yeniden izlenebilir.

### Doğru ölçüm için test adımları

| Adım | Ne yapılır | Program ne öğrenir |
|---|---|---|
| 1 | Bataryayı tam şarj et, şarjdan çıkar, **5 dk beklet** | Başlangıç şarj seviyesi (%100) |
| 2 | Scooterı sür (ya da tekeri havada çalıştır), ara ara tam gaz ver | İç direnç |
| 3 | En az %25 (tercihen %70+) boşalınca dur, **5 dk beklet** | Gerçek kapasite |

Bekleme sırasında scooter açık kalabilir; program akım kesilince dinlenmeyi kendisi anlar.

## Yapay zekâyı açmak

Anahtar olmadan da program çalışır, sadece rapor basit olur. Claude raporu için:

1. `pip install anthropic`
2. https://platform.claude.com adresinden bir API anahtarı alın (ücretlidir, rapor başına kuruş mertebesinde).
3. Programı başlatmadan önce aynı komut penceresinde:
   - Windows: `set ANTHROPIC_API_KEY=anahtarınız`
   - Linux/Mac: `export ANTHROPIC_API_KEY=anahtarınız`

Anahtarı hiçbir dosyaya yazmayın, kimseyle paylaşmayın.

## Klasörler

| Yol | İçerik |
|---|---|
| `baslat.py` | Programı başlatır |
| `batarya_sagligi/analiz.py` | Şarj seviyesi, kapasite, iç direnç hesapları |
| `batarya_sagligi/kaynak.py` | Veri kaynakları: simülatör, ESP32, CSV kaydı |
| `batarya_sagligi/yapay_zeka.py` | Claude ile rapor |
| `batarya_sagligi/web/index.html` | Ekran |
| `firmware/batarya_olcer/` | ESP32 yazılımı (Arduino) |
| `araclar/uart_dinleyici.py` | BMS veri hattı var mı diye dinleme aracı |
| `tests/` | Otomatik testler: `python -m unittest discover tests` |

## Prototipin sınırları

- **Tek tek hücre voltajlarını görmüyoruz**, sadece paket toplamını. Hücre
  dengesizliği doğrudan ölçülemez (BMS veri hattı bulunursa eklenecek).
- Şarj seviyesi tablosu genel Li-ion içindir; birkaç puan sapabilir.
- "Referans iç direnç" (180 mΩ) bir varsayımdır. Sağlam olduğu bilinen bir
  Ducati Pro 1 paketi ölçülünce gerçek değerle değiştirilmeli.
- ESP32 yazılımı ve Bluetooth henüz gerçek kartta denenmedi; program şimdilik USB'den okur.
