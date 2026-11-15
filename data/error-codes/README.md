# Hata kodu tabloları

Her satır bir hata kodudur. **Kaynağı olmayan kod eklenmez.**

| Kolon | Açıklama |
|---|---|
| brand | Marka (Ducati, Xiaomi, Segway, Ninebot…) |
| model_family | Model ailesi (boş = markanın tüm modelleri) |
| code | Ekranda görünen kod (E10, e 10, 10… hepsi E10'a çevrilir) |
| meaning | Kodun anlamı |
| causes | Olası nedenler, `|` ile ayrılmış |
| source | Kaynak: URL veya belge adı (örn. "Ducati Pro-III kullanım kılavuzu, s.35") |
| verified | Üretici kaynağı ise `true`, forum/topluluk kaynağı ise `false` |

Düzenledikten sonra:

```bash
cd scripts && npx tsx build-error-codes.ts > ../supabase/seed/0002_error_codes.sql
bash ../supabase/tests/rls.test.sh
```
