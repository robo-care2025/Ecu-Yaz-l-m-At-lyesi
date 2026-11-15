import { describe, expect, it } from "vitest";
import { buildErrorCodesSql, parseCsv } from "../build-error-codes";

const HEADER = "brand,model_family,code,meaning,causes,source,verified";

describe("parseCsv", () => {
  it("tırnaklı alanları ve virgülleri doğru ayırır", () => {
    expect(parseCsv(`a,b\n"x, y","z ""q"""\n`)).toEqual([["a", "b"], ["x, y", 'z "q"']]);
  });
});

describe("buildErrorCodesSql", () => {
  it("geçerli satırlardan insert üretir ve kodu normalize eder", () => {
    const sql = buildErrorCodesSql({
      "xiaomi.csv": `${HEADER}\nXiaomi,M365,e 10,"Kontrol kartı iletişim hatası","kablo|kart",https://ornek.com/a,false\nXiaomi,,E14,Gaz kolu hatası,gaz kolu,https://ornek.com/b,true\n`,
    });
    expect(sql.match(/insert into error_codes/g)).toHaveLength(2);
    expect(sql).toContain("'E10'");
    expect(sql).toContain("ARRAY['kablo','kart']");
    expect(sql).toContain("null, 'Xiaomi', 'M365'");
    expect(sql).toContain("'Xiaomi', null, 'E14'");
  });

  it("tek tırnakları kaçışlar", () => {
    const sql = buildErrorCodesSql({ "a.csv": `${HEADER}\nXiaomi,,E1,Motor'un hatası,,kaynak,false\n` });
    expect(sql).toContain("'Motor''un hatası'");
  });

  it("kaynağı boş satırda dosya ve satır numarasıyla hata verir", () => {
    expect(() => buildErrorCodesSql({ "a.csv": `${HEADER}\nXiaomi,,E1,x,,,false\n` })).toThrow(/a\.csv.*2/);
  });

  it("tekrarlı kodda hata verir", () => {
    expect(() =>
      buildErrorCodesSql({ "a.csv": `${HEADER}\nXiaomi,,E1,x,,k,false\nXiaomi,,e1,y,,k,false\n` }),
    ).toThrow(/tekrar/i);
  });
});
