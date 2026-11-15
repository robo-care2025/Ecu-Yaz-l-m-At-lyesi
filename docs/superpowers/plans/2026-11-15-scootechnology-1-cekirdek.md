# Scootechnology — Plan 1: Çekirdek (veritabanı + alt ajanlar + API) Yapım Planı

> Steps use checkbox (`- [ ]`) syntax for tracking. Implement task-by-task.

**Goal:** Şikâyet metnini alıp teşhis, kontrol sırası, tablodan fiyat ve müşteri mesajı üreten, iş kapanışında arşiv kaydı oluşturan sunucu çekirdeğini ve onu kullanan HTTP API'yi kurmak.

**Architecture:** npm workspaces monorepo. `packages/shared` Zod şemalarını ve marka/kod normalizasyonunu barındırır. `apps/web` (Next.js) içinde ajanlar (`src/lib/agents`), kodla yazılmış yönetici akışı (`src/lib/pipeline`), veri katmanı (`src/lib/data`; arayüz + bellek içi + Supabase uygulaması) ve API route'ları vardır. Ajanlar Claude'u tek bir `LlmCall` arayüzü üzerinden çağırır; testler sahte `LlmCall` kullanır, gerçek API'ye gitmez. Fiyat eşleştirme ve tüm "uydurma önleme" kontrolleri düz koddur.

**Tech Stack:** Node 22, TypeScript, Next.js 16 (App Router), `@anthropic-ai/sdk` 1.8.x, `zod` 4.x, `@supabase/supabase-js` 2.x, Vitest 5.x, Postgres (Supabase), Docker (yalnızca migration testi için).

**Spec:** `docs/superpowers/specs/2026-11-15-scooter-ariza-asistani-design.md`

**Bu plan dizinin 1. parçasıdır.** Plan 2: Android uygulaması (Expo). Plan 3: Web paneli (fiyat listesi, arşiv, ayarlar ekranları). Her biri kendi başına çalışan ve test edilen yazılım üretir. Plan 2 ve 3, bu planın API'si bittikten sonra yazılacak.

## Global Constraints

- Arayüz metinleri, ajan çıktıları ve hata mesajları **Türkçe**.
- Müşteri mesajındaki fiyat **yalnızca `price_items` tablosundan** gelir. Tabloda yoksa metin: `Fiyat bilgisi inceleme sonrası bildirilecektir.`
- Hata kodu anlamı **yalnızca `error_codes` tablosundan** gelir. Tabloda olmayan kod için teşhis "bu kod tabloda yok" der, anlam uydurmaz.
- Program müşteriye mesaj **göndermez**; sadece metin ve `wa.me` bağlantısı üretir.
- `ANTHROPIC_API_KEY` ve `SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucu ortam değişkenlerinde durur; istemci koduna, repoya, loglara girmez.
- Model: `AGENT_MODEL` ortam değişkeni, varsayılan `claude-opus-5-5`. Tüm ajanlar bunu kullanır. Effort: Teşhis `high`, diğer ajanlar `low`. İsteklerde `betas: ["server-side-fallback-2026-07-01"]` + `fallbacks: "default"`.
- Her veri satırı bir `workshop_id`'ye bağlıdır; RLS ile atölye yalnızca kendi verisini görür.
- Marka grupları (başlangıç): `Ducati`, `Xiaomi / Segway-Ninebot`, `Dualtron / Yüksek Voltaj`, `Diğer`. Seçim listelerinde **Ducati ilk sırada**.
- Atölye varsayılanları: ad `E-Scooter Tamir Merkezi`, telefon `0535 647 11 11`, hitap `siz`.
- Müşteriden yalnızca ad ve telefon saklanır.

## Review Focus

1. **Marka yazım çeşitliliği** ("ninebot max g30", "SEGWAY", "Xiaomi m365 pro 2", "dualtron thunder") doğru gruba düşmeli; bilinmeyen marka `Diğer`'e düşmeli. → Task 1 `normalizeBrand` testleri.
2. **Hata kodu biçim çeşitliliği** ("E10", "e 10", "Err10", "hata 10", "10") aynı koda normalize olmalı. → Task 1 `normalizeErrorCode` testleri.
3. **Claude geçersiz çıktı / refusal / ağ hatası** verirse bir kez yeniden denenmeli, sonra işin ham metni kaybolmadan `analiz_hatasi` durumuna geçmeli. → Task 3 `callStructured` testleri + Task 9 `analyzeJob` hata testi.
4. **Cevap ajanı tabloda olmayan bir TL tutarı yazarsa** mesaj reddedilmeli, bir kez yeniden denenmeli, yine olursa fiyatsız şablona düşülmeli. → Task 7 `guardPrices` testleri.
5. **Teşhis ajanı fiyat listesinde olmayan iş kalemi adı uydurursa** o kalem `null`'a çekilmeli (fiyat eşleşmez). Batarya ile ilgili bir neden varken güvenlik uyarısı yoksa varsayılan uyarı eklenmeli. → Task 5 `sanitizeDiagnosis` testleri.

---

## Dosya Yapısı

```
package.json                      # workspaces: apps/*, packages/*
tsconfig.base.json
packages/shared/
  package.json
  src/index.ts                    # dışa aktarımlar
  src/schemas.ts                  # Zod şemaları + tipler
  src/brands.ts                   # marka grupları, normalizeBrand
  src/error-codes.ts              # normalizeErrorCode
  tests/brands.test.ts
  tests/error-codes.test.ts
supabase/
  migrations/0001_init.sql        # tablolar + RLS
  seed/0001_seed.sql              # marka grupları, markalar, örnek fiyatlar
  seed/0002_error_codes.sql       # Task 11 üretir
  tests/rls.test.sh               # docker postgres'te migration + RLS testi
  tests/auth_stub.sql             # auth.uid() taklidi
apps/web/
  package.json
  .env.example
  src/lib/agents/llm.ts           # LlmCall tipi + Anthropic uygulaması
  src/lib/agents/fake-llm.ts      # testler için
  src/lib/agents/toparlayici.ts
  src/lib/agents/teshis.ts
  src/lib/agents/cevap.ts
  src/lib/agents/arsivci.ts
  src/lib/pricing/match.ts
  src/lib/pricing/suggest.ts
  src/lib/data/repo.ts            # Repo arayüzü
  src/lib/data/memory-repo.ts
  src/lib/data/supabase-repo.ts
  src/lib/pipeline/analyze.ts
  src/lib/pipeline/close.ts
  src/lib/auth.ts
  src/app/api/analyze/route.ts
  src/app/api/jobs/[id]/close/route.ts
  tests/...                       # her modül için *.test.ts
data/error-codes/                 # Task 11: kaynaklı CSV'ler
```

---

### Task 1: Monorepo iskeleti + ortak şemalar + marka/kod normalizasyonu

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `packages/shared/package.json`, `packages/shared/src/{index,schemas,brands,error-codes}.ts`
- Test: `packages/shared/tests/brands.test.ts`, `packages/shared/tests/error-codes.test.ts`

**Interfaces:**
- Produces (`@scoot/shared`):
  - `BRAND_GROUPS: readonly ["Ducati","Xiaomi / Segway-Ninebot","Dualtron / Yüksek Voltaj","Diğer"]`, `type BrandGroup`
  - `BRANDS: { name: string; group: BrandGroup; aliases: string[] }[]` — sıra: Ducati, Segway, Ninebot, Xiaomi, Onvo, Dualtron (Ducati ilk). Onvo → `Diğer`.
  - `normalizeBrand(input: string | null): { brand: string | null; group: BrandGroup }`
  - `normalizeErrorCode(input: string): string | null` — çıktı biçimi `E<sayı>` (örn. `E10`); sayı yoksa `null`.
  - Zod şemaları ve tipleri:
    - `ParsedJob = { brand: string|null; model: string|null; errorCodes: string[]; symptoms: string[]; customerName: string|null; customerPhone: string|null; missingInfo: string[] }`
    - `Diagnosis = { causes: { title: string; probability: number /*0-100 int*/; reasoning: string; priceItem: string|null }[]; checks: { step: string; expected: string|null }[]; questions: string[]; safetyWarnings: string[]; unknownCodes: string[] }`
    - `PriceMatch = { priceItem: string; group: BrandGroup; minTl: number; maxTl: number; duration: string } | { priceItem: string; missing: true }`
    - `CustomerMessage = { text: string }`
    - `RepairRecordDraft = { actualFault: string; actions: string[]; partsReplaced: string[] }`

- [ ] **Step 1: Kök `package.json` (workspaces `apps/*`, `packages/*`; script `test`: `npm run test --workspaces --if-present`), `tsconfig.base.json` (strict, ES2022, moduleResolution bundler) ve `packages/shared/package.json` (name `@scoot/shared`, vitest devDep, zod dep) oluştur; `npm install`.**

- [ ] **Step 2: Başarısız testleri yaz**

```ts
// brands.test.ts
it.each([
  ["ninebot max g30", "Ninebot", "Xiaomi / Segway-Ninebot"],
  ["SEGWAY", "Segway", "Xiaomi / Segway-Ninebot"],
  ["Xiaomi m365 pro 2", "Xiaomi", "Xiaomi / Segway-Ninebot"],
  ["dualtron thunder", "Dualtron", "Dualtron / Yüksek Voltaj"],
  ["ducati pro-iii", "Ducati", "Ducati"],
  ["Onvo", "Onvo", "Diğer"],
  ["Kugoo", null, "Diğer"],
  [null, null, "Diğer"],
])("normalizeBrand(%s)", (inp, brand, group) =>
  expect(normalizeBrand(inp)).toEqual({ brand, group }));
it("Ducati listede ilk", () => expect(BRANDS[0].name).toBe("Ducati"));

// error-codes.test.ts
it.each([["E10","E10"],["e 10","E10"],["Err10","E10"],["hata 10","E10"],["10","E10"],["E014","E14"],["yok",null]])(
  "normalizeErrorCode(%s)", (i, o) => expect(normalizeErrorCode(i)).toBe(o));
```

- [ ] **Step 3: Çalıştır, başarısız olduğunu gör** — `npm test -w @scoot/shared` → FAIL (modül yok).
- [ ] **Step 4: `brands.ts`, `error-codes.ts`, `schemas.ts`, `index.ts`'i uygula.** `normalizeBrand`: küçük harfe çevir, her markanın `name` + `aliases` listesinden metinde geçen ilkini bul. `normalizeErrorCode`: ilk rakam dizisini al, baştaki sıfırları at, `E` ekle.
- [ ] **Step 5: Çalıştır, geçtiğini gör** — `npm test -w @scoot/shared` → PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat(shared): şemalar, marka ve hata kodu normalizasyonu"`

---

### Task 2: Veritabanı şeması, RLS ve başlangıç verileri

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/seed/0001_seed.sql`, `supabase/tests/auth_stub.sql`, `supabase/tests/rls.test.sh`

**Interfaces:**
- Produces (tablolar; tüm `id`'ler `uuid default gen_random_uuid()`, tümünde `created_at timestamptz default now()`):
  - `workshops(id, name text, phone text, signature text, address_form text check in ('siz','sen') default 'siz')`
  - `profiles(user_id uuid pk references auth.users, workshop_id uuid references workshops)`
  - `brand_groups(id, workshop_id, name text, sort int)` — unique(workshop_id, name)
  - `brands(id, workshop_id, name text, group_id uuid references brand_groups, sort int)`
  - `price_items(id, workshop_id, item_name text, group_id uuid references brand_groups, min_tl int, max_tl int, duration text, is_sample bool default true)` — unique(workshop_id, item_name, group_id); check `min_tl <= max_tl`
  - `error_codes(id, workshop_id uuid null /*null = herkese açık ortak veri*/, brand text, model_family text null, code text, meaning text, causes text[], source text not null, verified bool default false)`
  - `jobs(id, workshop_id, status text check in ('yeni','analiz_edildi','analiz_hatasi','musteriye_yazildi','tamirde','bitti'), raw_text text not null, parsed jsonb, brand text, model text, customer_name text, customer_phone text, measurements text[] default '{}')`
  - `job_analyses(id, workshop_id, job_id references jobs on delete cascade, diagnosis jsonb, prices jsonb, message text, model text)`
  - `repair_records(id, workshop_id, job_id references jobs, brand text, model text, symptoms text[], actual_fault text, actions text[], parts_replaced text[], actual_price_tl int null, actual_duration text null)`
  - SQL fonksiyonu `current_workshop_id() returns uuid` (`profiles`'tan `auth.uid()` ile).
  - RLS: her tabloda `workshop_id = current_workshop_id()` için select/insert/update/delete politikaları; `error_codes` için select ayrıca `workshop_id is null` satırlarını görür.
  - SQL fonksiyonu `seed_workshop(p_workshop uuid)`: 4 marka grubu (sort: Ducati=1), 6 marka (Ducati sort=1), ve örnek fiyat satırları ekler. Örnek fiyat satırları (hepsi `is_sample=true`; usta düzeltecek): Kontrol kartı tamiri, Kontrol kartı değişimi, Batarya hücre değişimi, BMS değişimi, Gaz kolu değişimi, Fren kolu / sensörü değişimi, Motor hall sensörü değişimi, Ekran / dashboard kartı değişimi, Şarj soketi değişimi, Lastik / iç lastik değişimi — her biri `Diğer` grubu için bir satır, ayrıca `Kontrol kartı tamiri` Ducati, Xiaomi / Segway-Ninebot ve Dualtron grupları için birer satır.
  - `0001_seed.sql`: varsayılan atölyeyi (`E-Scooter Tamir Merkezi`, `0535 647 11 11`) oluşturur ve `seed_workshop` çağırır.

- [ ] **Step 1: Başarısız testi yaz — `supabase/tests/rls.test.sh`**: `postgres:16` container başlatır, `auth_stub.sql` (auth şeması, `auth.users`, `request.jwt.claim.sub` ayarından okuyan `auth.uid()`, `authenticated` rolü), migration ve seed'i uygular; iki atölye + iki kullanıcı oluşturur ve şunları doğrular (her biri `psql -v ON_ERROR_STOP=1`, başarısızsa `exit 1`):
  - A kullanıcısı olarak `select count(*) from jobs` yalnızca A'nın işlerini sayar (B'nin işi eklenmişken sonuç 1).
  - A kullanıcısı B'nin `workshop_id`'si ile `insert into jobs` yaparsa hata alır.
  - `select name from brand_groups order by sort limit 1` → `Ducati`.
  - `error_codes`'ta `workshop_id is null` satırı her iki kullanıcıya da görünür.
  - `price_items`'a `min_tl > max_tl` satırı eklemek hata verir.
- [ ] **Step 2: Çalıştır, başarısız olduğunu gör** — `bash supabase/tests/rls.test.sh` → FAIL (migration dosyası yok).
- [ ] **Step 3: `0001_init.sql`, `0001_seed.sql`'i uygula.**
- [ ] **Step 4: Çalıştır, geçtiğini gör** — `bash supabase/tests/rls.test.sh` → son satır `RLS OK`.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): şema, RLS ve başlangıç verileri"`

---

### Task 3: Claude çağrı katmanı (`LlmCall`)

**Files:**
- Create: `apps/web/package.json` (Next.js 16, `@anthropic-ai/sdk`, `zod`, `@supabase/supabase-js`, `@scoot/shared`, vitest), `apps/web/.env.example`, `apps/web/src/lib/agents/llm.ts`, `apps/web/src/lib/agents/fake-llm.ts`
- Test: `apps/web/tests/llm.test.ts`

**Interfaces:**
- Produces:
  - `type Effort = "low" | "medium" | "high"`
  - `type LlmCall = <T>(args: { schema: z.ZodType<T>; system: string; user: string; effort: Effort }) => Promise<T>`
  - `class LlmError extends Error { kind: "refusal" | "invalid_output" | "api" }`
  - `createAnthropicLlm(opts?: { client?: Pick<Anthropic, "beta">; model?: string }): LlmCall` — `client.beta.messages.parse({ model, max_tokens: 16000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort, format: betaZodOutputFormat(schema) }, system, messages: [{ role: "user", content: user }] })`. `model` varsayılanı `process.env.AGENT_MODEL ?? "claude-opus-5-5"`. `stop_reason === "refusal"` → `LlmError("refusal")`; `parsed_output == null` → `LlmError("invalid_output")`; SDK hataları → `LlmError("api")`. `invalid_output` ve `api` için **bir kez** yeniden dener; `refusal` için yeniden denemez.
  - `createFakeLlm(responses: unknown[] | ((args) => unknown)): LlmCall & { calls: {system: string; user: string; effort: Effort}[] }` — sırayla döner, `Error` örneği verilirse fırlatır.
- `.env.example`: `ANTHROPIC_API_KEY=`, `AGENT_MODEL=claude-opus-5-5`, `NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=`, `SUPABASE_SERVICE_ROLE_KEY=`

- [ ] **Step 1: Başarısız testleri yaz** (sahte `client.beta.messages.parse` ile):
  - `parsed_output` döndüğünde değeri döner ve istek `model: "claude-opus-5-5"`, `fallbacks: "default"`, `betas` içinde `server-side-fallback-2026-07-01`, `output_config.effort` iletilen değer ile gider.
  - İlk çağrı `parsed_output: null`, ikincisi geçerli → sonuç döner, `parse` 2 kez çağrılmış.
  - İki kez `parsed_output: null` → `LlmError` ve `kind === "invalid_output"`.
  - `stop_reason: "refusal"` → `kind === "refusal"`, `parse` 1 kez çağrılmış.
  - `AGENT_MODEL=x` ortamında istek `model: "x"` ile gider.
- [ ] **Step 2: Çalıştır** — `npm test -w apps/web -- llm` → FAIL.
- [ ] **Step 3: `llm.ts` ve `fake-llm.ts`'i uygula.**
- [ ] **Step 4: Çalıştır** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(agents): Claude çağrı katmanı ve sahte LLM"`

---

### Task 4: Toparlayıcı ajan

**Files:**
- Create: `apps/web/src/lib/agents/toparlayici.ts`
- Test: `apps/web/tests/toparlayici.test.ts`

**Interfaces:**
- Consumes: `LlmCall` (Task 3), `ParsedJob`, `normalizeBrand`, `normalizeErrorCode` (Task 1)
- Produces: `toparla(input: { rawText: string; brandHint?: string | null; modelHint?: string | null; errorCodeHint?: string | null }, llm: LlmCall): Promise<ParsedJob>`

Sistem istemi (özü): "Elektrikli scooter atölyesine gelen dağınık bir müşteri mesajını yapılandır. Metinde olmayan bilgiyi uydurma, boş bırak. Belirtileri kısa Türkçe maddeler hâlinde yaz." Effort `low`. Formdan gelen `*Hint` alanları metindekinden önceliklidir.

- [ ] **Step 1: Başarısız testleri yaz:**
  - LLM `{brand:"ninebot", errorCodes:["e 10"], ...}` dönerse sonuç `brand === "Ninebot"`, `errorCodes` `["E10"]`.
  - `brandHint: "Ducati"` verilip LLM `brand: "Xiaomi"` dönerse sonuç `brand === "Ducati"`.
  - `errorCodeHint: "14"` ve LLM `errorCodes: ["E10"]` → `["E14","E10"]` (tekrarsız, ipucu önce).
  - `normalizeErrorCode` `null` döndüren kodlar listeden çıkarılır.
  - LLM'e giden `user` metni ham metni içerir; `effort === "low"`.
- [ ] **Step 2: Çalıştır** → FAIL. **Step 3: Uygula.** **Step 4: Çalıştır** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(agents): toparlayıcı ajan"`

---

### Task 5: Teşhis ajanı + çıktı temizleme

**Files:**
- Create: `apps/web/src/lib/agents/teshis.ts`
- Test: `apps/web/tests/teshis.test.ts`

**Interfaces:**
- Consumes: `LlmCall`, `ParsedJob`, `Diagnosis`
- Produces:
  - `type ErrorCodeRow = { brand: string; modelFamily: string | null; code: string; meaning: string; causes: string[]; verified: boolean }`
  - `type SimilarRepair = { brand: string | null; model: string | null; symptoms: string[]; actualFault: string; actions: string[] }`
  - `teshisEt(job: ParsedJob, ctx: { errorCodes: ErrorCodeRow[]; similar: SimilarRepair[]; priceItemNames: string[]; measurements: string[] }, llm: LlmCall): Promise<Diagnosis>`
  - `sanitizeDiagnosis(d: Diagnosis, ctx: { priceItemNames: string[]; jobCodes: string[]; knownCodes: string[] }): Diagnosis`
  - `BATTERY_WARNING = "Lityum batarya ile çalışırken kısa devre ve ısınma riskine dikkat edin; hasarlı/şişmiş hücreleri şarj etmeyin."`

Ajan, araç döngüsü kullanmaz: hata kodları ve benzer vakalar **çağrıdan önce kodla** bulunup istemde verilir (bkz. Task 9). Sistem istemi: rol (deneyimli scooter elektronik teknisyeni asistanı), "verilen hata kodu tablosu dışında kod anlamı yazma", "`priceItem` alanına yalnızca verilen listeden bir ad yaz ya da null", "kontrol adımlarında ölçülebilir beklenen değer ver (V, Ω) ama emin değilsen null bırak", "doğrulanmamış (`verified=false`) kod satırlarını 'doğrulanmamış' diye belirt". Effort `high`.

`sanitizeDiagnosis` kuralları (düz kod):
1. `priceItem` `priceItemNames` içinde değilse `null`.
2. `probability` 0–100'e kırpılır, tam sayıya yuvarlanır; nedenler olasılığa göre azalan sıralanır; toplam 100'ü aşarsa orantılı ölçeklenir.
3. `unknownCodes` = `jobCodes` içinde olup `knownCodes` içinde olmayanlar (LLM ne derse desin bu kodla hesaplanır).
4. Herhangi bir neden başlığı `/batarya|bms|hücre|şarj/i` ile eşleşir ve `safetyWarnings` boşsa `BATTERY_WARNING` eklenir.

- [ ] **Step 1: Başarısız testleri yaz** (`sanitizeDiagnosis` için 4 kuralın her biri ayrı test; `teshisEt` için: LLM'e giden `user` metni tablo kodlarını, benzer vakaları, fiyat kalemi adlarını ve ölçümleri içerir; `effort === "high"`; dönüş `sanitizeDiagnosis`'ten geçmiştir — LLM `priceItem: "Uydurma iş"` dönerse sonuçta `null`).
- [ ] **Step 2: Çalıştır** → FAIL. **Step 3: Uygula.** **Step 4: Çalıştır** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(agents): teşhis ajanı ve çıktı temizleme"`

---

### Task 6: Fiyat eşleştirici (düz kod)

**Files:**
- Create: `apps/web/src/lib/pricing/match.ts`
- Test: `apps/web/tests/match.test.ts`

**Interfaces:**
- Consumes: `Diagnosis`, `PriceMatch`, `BrandGroup`
- Produces:
  - `type PriceItemRow = { itemName: string; group: BrandGroup; minTl: number; maxTl: number; duration: string }`
  - `matchPrices(diag: Diagnosis, group: BrandGroup, items: PriceItemRow[]): PriceMatch[]` — `priceItem`'ı dolu her neden için (tekrarsız, olasılık sırasıyla): önce `(itemName, group)`, yoksa `(itemName, "Diğer")`, yoksa `{ priceItem, missing: true }`.

- [ ] **Step 1: Başarısız testleri yaz:** Ducati grubu için Ducati satırı varken Ducati satırı seçilir; Ducati satırı yokken `Diğer` satırı seçilir; hiçbiri yoksa `missing: true`; `priceItem: null` nedenler atlanır; aynı kalem iki nedende geçerse bir kez listelenir.
- [ ] **Step 2–4:** FAIL → uygula → PASS (`npm test -w apps/web -- match`).
- [ ] **Step 5: Commit** — `git commit -m "feat(pricing): fiyat eşleştirici"`

---

### Task 7: Cevap ajanı + fiyat koruması

**Files:**
- Create: `apps/web/src/lib/agents/cevap.ts`
- Test: `apps/web/tests/cevap.test.ts`

**Interfaces:**
- Consumes: `LlmCall`, `ParsedJob`, `Diagnosis`, `PriceMatch`, `CustomerMessage`
- Produces:
  - `type WorkshopInfo = { name: string; phone: string; addressForm: "siz" | "sen" }`
  - `NO_PRICE_TEXT = "Fiyat bilgisi inceleme sonrası bildirilecektir."`
  - `guardPrices(text: string, prices: PriceMatch[]): boolean` — metindeki tüm TL tutarlarını (`/(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:TL|₺)/gi`, ayrıca "1.500 – 2.500 TL" aralıklarının ilk sayısı) çıkarır; her biri eşleşen fiyatların `minTl`/`maxTl` değerlerinden biriyse `true`.
  - `cevapYaz(input: { job: ParsedJob; diag: Diagnosis; prices: PriceMatch[]; workshop: WorkshopInfo }, llm: LlmCall): Promise<CustomerMessage>`
  - `fallbackMessage(input): CustomerMessage` — LLM'siz şablon: selam (hitaba göre), en olası neden başlığı "ön değerlendirmemize göre" diliyle, `NO_PRICE_TEXT`, atölye adı + telefon imzası.

Sistem istemi: sade Türkçe, teknik jargon yok, "kesin" yerine "ön değerlendirme", fiyatları yalnızca verilen listeden aynen yaz, eksik fiyat varsa `NO_PRICE_TEXT` cümlesini kullan, sonunda imza `<ad> · <telefon>`, hitap `siz`/`sen`. Effort `low`.
Akış: LLM → `guardPrices` false ise bir kez daha (istemde "önceki mesajda listede olmayan tutar vardı" uyarısıyla) → yine false ise `fallbackMessage`. LLM hata fırlatırsa `fallbackMessage`.

- [ ] **Step 1: Başarısız testleri yaz:**
  - `guardPrices("tahmini 1.500 – 2.500 TL", [{min 1500,max 2500}])` → `true`; `"3.000 TL"` ile → `false`; tutarsız metin → `true`.
  - LLM ilk seferde `"... 9.999 TL ..."`, ikinci seferde geçerli metin dönerse ikinci metin döner, `calls.length === 2`.
  - LLM iki kez de geçersiz tutar dönerse sonuç `fallbackMessage` (içinde `NO_PRICE_TEXT` ve `E-Scooter Tamir Merkezi · 0535 647 11 11`).
  - `addressForm: "sen"` için `fallbackMessage` "siz" kelimesini içermez.
- [ ] **Step 2–4:** FAIL → uygula → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(agents): cevap ajanı ve fiyat koruması"`

---

### Task 8: Arşivci ajan + fiyat güncelleme önerisi

**Files:**
- Create: `apps/web/src/lib/agents/arsivci.ts`, `apps/web/src/lib/pricing/suggest.ts`
- Test: `apps/web/tests/arsivci.test.ts`, `apps/web/tests/suggest.test.ts`

**Interfaces:**
- Consumes: `LlmCall`, `ParsedJob`, `RepairRecordDraft`, `PriceItemRow`
- Produces:
  - `arsivle(input: { job: ParsedJob; note: string }, llm: LlmCall): Promise<RepairRecordDraft>` — effort `low`; istem: "ustanın kısa notunu kayda çevir, notta olmayanı ekleme".
  - `type PriceSuggestion = { itemName: string; group: BrandGroup; currentMin: number; currentMax: number; actualTl: number; message: string }`
  - `suggestPriceUpdate(actualTl: number, row: PriceItemRow | null): PriceSuggestion | null` — `row` yoksa `null`; `actualTl < minTl * 0.75` veya `actualTl > maxTl * 1.25` ise öneri; `message` örn.: `"Ducati grubunda 'Kontrol kartı tamiri' için gerçek fiyat 4.000 TL, tablodaki aralık 1.500–2.500 TL. Güncellemek ister misiniz?"`

- [ ] **Step 1: Başarısız testleri yaz:** `suggestPriceUpdate(4000, {min 1500,max 2500})` → öneri, `message` yukarıdaki biçimde; `suggestPriceUpdate(2600, …)` → `null` (sınır içinde %25); `row=null` → `null`; `arsivle` LLM çıktısını şemayla döndürür ve `user` metninde not geçer.
- [ ] **Step 2–4:** FAIL → uygula → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(agents): arşivci ve fiyat önerisi"`

---

### Task 9: Veri katmanı + yönetici akışlar (`analyzeJob`, `closeJob`)

**Files:**
- Create: `apps/web/src/lib/data/{repo,memory-repo,supabase-repo}.ts`, `apps/web/src/lib/pipeline/{analyze,close}.ts`
- Test: `apps/web/tests/analyze.test.ts`, `apps/web/tests/close.test.ts`

**Interfaces:**
- Consumes: Task 1–8'in tüm dışa aktarımları
- Produces:
  - `interface Repo {`
    `getWorkshop(workshopId: string): Promise<WorkshopInfo>;`
    `getPriceItems(workshopId: string): Promise<PriceItemRow[]>;`
    `getErrorCodes(workshopId: string, brand: string | null, codes: string[]): Promise<ErrorCodeRow[]>;`
    `findSimilarRepairs(workshopId: string, brand: string | null, symptoms: string[], limit: number): Promise<SimilarRepair[]>;`
    `createJob(workshopId: string, rawText: string): Promise<{ id: string }>;`
    `updateJob(jobId: string, patch: Partial<{ status: JobStatus; parsed: ParsedJob; brand: string|null; model: string|null; customerName: string|null; customerPhone: string|null; measurements: string[] }>): Promise<void>;`
    `getJob(jobId: string): Promise<JobRow | null>;`
    `saveAnalysis(a: { workshopId: string; jobId: string; diagnosis: Diagnosis; prices: PriceMatch[]; message: string; model: string }): Promise<void>;`
    `saveRepairRecord(r: { workshopId: string; jobId: string; job: ParsedJob; draft: RepairRecordDraft; actualPriceTl: number | null; actualDuration: string | null }): Promise<void>; }`
  - `type JobStatus = "yeni" | "analiz_edildi" | "analiz_hatasi" | "musteriye_yazildi" | "tamirde" | "bitti"`; `type JobRow = { id; workshopId; status; rawText; parsed: ParsedJob | null; measurements: string[] }`
  - `createMemoryRepo(seed?: Partial<...>): Repo` (testler için), `createSupabaseRepo(client: SupabaseClient): Repo` (kullanıcı JWT'li istemci; RLS geçerli).
  - `findSimilarRepairs` (Supabase): aynı marka + `symptoms` dizisiyle kesişen (`&&`) kayıtlar, en yeni önce, `limit` 5.
  - `type AnalysisResult = { jobId: string; parsed: ParsedJob; diagnosis: Diagnosis; prices: PriceMatch[]; message: string; whatsappUrl: string | null }`
  - `analyzeJob(deps: { repo: Repo; llm: LlmCall; model: string }, input: { workshopId: string; jobId?: string; rawText: string; brandHint?: string|null; modelHint?: string|null; errorCodeHint?: string|null; measurements?: string[] }): Promise<AnalysisResult>`
    Sıra: (`jobId` yoksa) `createJob` → `toparla` → `updateJob(parsed…)` → `getErrorCodes` + `findSimilarRepairs` + `getPriceItems` → `teshisEt` → `matchPrices(normalizeBrand(parsed.brand).group)` → `getWorkshop` → `cevapYaz` → `saveAnalysis` → `updateJob(status "analiz_edildi")`. `toparla` veya `teshisEt` `LlmError` fırlatırsa: `updateJob(status "analiz_hatasi")` ve hata yeniden fırlatılır (ham metin `createJob`'da zaten kayıtlı).
    `jobId` verilirse (ölçüm ekleyip yeniden analiz): `getJob`'tan ham metin alınır, `measurements` birleştirilip kaydedilir, yeni iş açılmaz.
  - `whatsappUrl`: `customerPhone` varsa `https://wa.me/90XXXXXXXXXX?text=<encodeURIComponent(message)>` (başındaki `0`/`+90` normalize edilir), yoksa `null`.
  - `closeJob(deps: { repo: Repo; llm: LlmCall }, input: { workshopId: string; jobId: string; note: string; actualPriceTl: number | null; actualDuration: string | null; priceItem: string | null }): Promise<{ suggestion: PriceSuggestion | null }>` — `arsivle` → `saveRepairRecord` → `updateJob(status "bitti")` → `suggestPriceUpdate`.

- [ ] **Step 1: Başarısız testleri yaz** (`createMemoryRepo` + `createFakeLlm`):
  - Uçtan uca: ham metin `"Ninebot max g30, ekranda e10 yazıyor gaz vermiyor, Ali 0532 111 22 33"` → sonuç `prices`, `message` dolu; repo'da iş `analiz_edildi`; `whatsappUrl` `https://wa.me/905321112233?text=` ile başlar.
  - Teşhis ajanına giden `user` metni, repo'daki `E10` satırının anlamını ve benzer vakayı içerir.
  - Toparlayıcı `LlmError` fırlatırsa iş `analiz_hatasi`, `raw_text` korunmuş, `analyzeJob` reddeder.
  - `jobId` ile ikinci çağrı yeni iş açmaz, `measurements` `["Batarya 36V"]` kaydedilir ve teşhis `user` metninde geçer.
  - `closeJob` gerçek fiyat 4000, tablo 1500–2500 → `suggestion` dolu; iş `bitti`; repair record kaydedilmiş.
- [ ] **Step 2–4:** FAIL → uygula → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(pipeline): veri katmanı ve yönetici akışlar"`

---

### Task 10: API route'ları + kimlik doğrulama

**Files:**
- Create: `apps/web/src/lib/auth.ts`, `apps/web/src/app/api/analyze/route.ts`, `apps/web/src/app/api/jobs/[id]/close/route.ts`, `apps/web/src/app/page.tsx` (tek satırlık "Scootechnology API çalışıyor" sayfası), `apps/web/next.config.ts`
- Test: `apps/web/tests/api.test.ts`

**Interfaces:**
- Consumes: `analyzeJob`, `closeJob`, `createSupabaseRepo`, `createAnthropicLlm`
- Produces:
  - `authenticate(req: Request, deps?: { getUser?: (token: string) => Promise<{ userId: string; workshopId: string } | null> }): Promise<{ userId: string; workshopId: string; token: string } | null>` — `Authorization: Bearer <supabase access token>`; kullanıcıyı `supabase.auth.getUser(token)` ile, atölyeyi `profiles`'tan bulur.
  - `POST /api/analyze` gövde: `{ rawText: string (1–5000 karakter); jobId?: string; brand?: string; model?: string; errorCode?: string; measurements?: string[] }` → 200 `AnalysisResult`; 400 doğrulama hatası `{ error: "Şikâyet metni boş olamaz." }`; 401 `{ error: "Giriş yapmanız gerekiyor." }`; 502 `LlmError` → `{ error: "Yapay zekâ şu an cevap veremedi, iş kaydedildi. Biraz sonra tekrar deneyin.", jobId }`.
  - `POST /api/jobs/:id/close` gövde: `{ note: string; actualPriceTl?: number; actualDuration?: string; priceItem?: string }` → 200 `{ suggestion }`.
  - Route handler'lar, test edilebilmesi için `makeAnalyzeHandler(deps)` / `makeCloseHandler(deps)` fabrikalarından üretilir; `route.ts` gerçek bağımlılıklarla bağlar.

- [ ] **Step 1: Başarısız testleri yaz:** token yok → 401; boş `rawText` → 400 ve Türkçe mesaj; sahte bağımlılıklarla geçerli istek → 200 ve `message` alanı; `analyzeJob` `LlmError` fırlatınca → 502 ve `jobId`.
- [ ] **Step 2–4:** FAIL → uygula → PASS. Ek olarak `npm run build -w apps/web` hatasız biter.
- [ ] **Step 5: Gerçek ortam duman testi (kullanıcı onayıyla):** Supabase projesi oluşturulur (Supabase MCP `create_project` — maliyeti kullanıcıya söylenip onay alınarak), `0001_init.sql` + `0001_seed.sql` uygulanır, kullanıcının Anthropic API anahtarı güvenli formla (`request_credential`, host `api.anthropic.com`) alınır. Test kullanıcısıyla gerçek bir şikâyet `POST /api/analyze`'a gönderilir; beklenen: 200, Türkçe mesaj, `E-Scooter Tamir Merkezi · 0535 647 11 11` imzası. Bu adım bir kez çalıştırılır (gerçek API ücreti doğurur).
- [ ] **Step 6: Commit** — `git commit -m "feat(api): analiz ve iş kapatma uç noktaları"`

---

### Task 11: Hata kodu verisi (Ducati, Xiaomi, Segway-Ninebot)

**Files:**
- Create: `data/error-codes/{ducati,xiaomi,segway-ninebot}.csv`, `scripts/build-error-codes.ts`, `supabase/seed/0002_error_codes.sql` (üretilir)
- Test: `scripts/tests/build-error-codes.test.ts`

**Interfaces:**
- CSV kolonları: `brand,model_family,code,meaning,causes,source,verified` (`causes` `|` ile ayrılmış; `source` bir URL ya da belge adı, **boş olamaz**; `verified` `true/false`).
- `buildErrorCodesSql(csvTexts: Record<string,string>): string` — her satırı `normalizeErrorCode` ile normalize eder, `workshop_id` `NULL` (ortak veri) ile `insert` üretir; kaynağı boş satırda hata fırlatır; aynı (brand, model_family, code) iki kez varsa hata fırlatır.

- [ ] **Step 1: Başarısız testleri yaz:** geçerli 2 satırlık CSV → 2 `insert`; `source` boş satır → hata mesajı satır numarasını içerir; `e 10` → `E10`; tekrarlı kod → hata.
- [ ] **Step 2–4:** FAIL → `scripts/build-error-codes.ts`'i uygula → PASS.
- [ ] **Step 5: Veriyi derle.** Üretici kılavuzları, resmi destek sayfaları ve tamirci forumlarından kodları topla; **her satıra kaynağını yaz**. Üretici kaynağından gelenler `verified=true`, forum/topluluk kaynaklı olanlar `verified=false`. Kaynak bulunamayan kod eklenmez. Ducati önceliklidir. Bitince `npx tsx scripts/build-error-codes.ts > supabase/seed/0002_error_codes.sql` ve `bash supabase/tests/rls.test.sh` (seed'le birlikte) yine `RLS OK`.
- [ ] **Step 6: Commit** — `git commit -m "feat(data): kaynaklı hata kodu tabloları"`

---

## Bu planın bitiş ölçütü

- `npm test` tüm paketlerde yeşil, `bash supabase/tests/rls.test.sh` → `RLS OK`, `npm run build -w apps/web` hatasız.
- Task 10 Step 5'teki gerçek duman testi Türkçe teşhis + tablodan fiyatlı mesaj döndürdü.
- Sonraki adım: **Plan 2 — Android uygulaması** (giriş, iş listesi, yeni iş + sesli giriş + WhatsApp paylaşım hedefi, iş detayı, iş kapatma), bu API'yi kullanır.
