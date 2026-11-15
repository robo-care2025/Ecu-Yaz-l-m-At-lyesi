/**
 * data/error-codes/*.csv dosyalarından supabase/seed/0002_error_codes.sql üretir.
 * Kural: kaynağı olmayan kod eklenmez; aynı (marka, model ailesi, kod) iki kez yazılamaz.
 * Kullanım: npx tsx build-error-codes.ts > ../supabase/seed/0002_error_codes.sql
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeErrorCode } from "@scoot/shared";

const COLUMNS = ["brand", "model_family", "code", "meaning", "causes", "source", "verified"] as const;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

const lit = (s: string | null) => (s === null || s === "" ? "null" : `'${s.replace(/'/g, "''")}'`);

export function buildErrorCodesSql(csvTexts: Record<string, string>): string {
  const out = [
    "-- OTOMATİK ÜRETİLDİ: scripts/build-error-codes.ts. Elle düzenlemeyin; data/error-codes/*.csv dosyalarını düzenleyin.",
    "delete from error_codes where workshop_id is null;",
  ];
  const seen = new Set<string>();
  for (const [file, text] of Object.entries(csvTexts)) {
    const [header, ...rows] = parseCsv(text);
    if (header?.join(",") !== COLUMNS.join(",")) throw new Error(`${file}: başlık satırı "${COLUMNS.join(",")}" olmalı`);
    rows.forEach((cells, idx) => {
      const line = idx + 2;
      const r = Object.fromEntries(COLUMNS.map((c, i) => [c, (cells[i] ?? "").trim()])) as Record<(typeof COLUMNS)[number], string>;
      if (!r.brand || !r.meaning) throw new Error(`${file} satır ${line}: marka ve anlam zorunlu`);
      if (!r.source) throw new Error(`${file} satır ${line}: kaynak (source) boş olamaz`);
      const code = normalizeErrorCode(r.code);
      if (!code) throw new Error(`${file} satır ${line}: geçersiz kod "${r.code}"`);
      const key = `${r.brand.toLowerCase()}|${r.model_family.toLowerCase()}|${code}`;
      if (seen.has(key)) throw new Error(`${file} satır ${line}: tekrar eden kod ${r.brand} ${r.model_family} ${code}`);
      seen.add(key);
      const causes = r.causes ? r.causes.split("|").map((c) => c.trim()).filter(Boolean) : [];
      const arr = causes.length ? `ARRAY[${causes.map(lit).join(",")}]` : "'{}'::text[]";
      out.push(
        `insert into error_codes (workshop_id, brand, model_family, code, meaning, causes, source, verified) values ` +
          `(null, ${lit(r.brand)}, ${lit(r.model_family || null)}, ${lit(code)}, ${lit(r.meaning)}, ${arr}, ${lit(r.source)}, ${r.verified === "true"});`,
      );
    });
  }
  return out.join("\n") + "\n";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/error-codes");
  const files = readdirSync(dir).filter((f) => f.endsWith(".csv")).sort();
  process.stdout.write(buildErrorCodesSql(Object.fromEntries(files.map((f) => [f, readFileSync(path.join(dir, f), "utf8")]))));
}
