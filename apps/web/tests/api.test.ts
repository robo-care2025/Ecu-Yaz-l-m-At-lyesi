import { describe, expect, it } from "vitest";
import { makeAnalyzeHandler, makeCloseHandler } from "@/lib/handlers";
import { LlmError } from "@/lib/agents/llm";

const user = { userId: "u1", workshopId: "ws-1", token: "t" };
const okAuth = async () => user;
const noAuth = async () => null;

function req(body: unknown, token = true) {
  return new Request("http://x/api", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer t" } : {}) },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analyze", () => {
  it("giriş yoksa 401", async () => {
    const h = makeAnalyzeHandler({ authenticate: noAuth, analyze: async () => { throw new Error("çağrılmamalı"); } });
    const res = await h(req({ rawText: "x" }, false));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Giriş yapmanız gerekiyor.");
  });

  it("boş şikâyet 400", async () => {
    const h = makeAnalyzeHandler({ authenticate: okAuth, analyze: async () => { throw new Error("çağrılmamalı"); } });
    const res = await h(req({ rawText: "  " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Şikâyet metni boş olamaz.");
  });

  it("jobId ile boş metin kabul edilir (yeniden analiz)", async () => {
    let got: any;
    const h = makeAnalyzeHandler({ authenticate: okAuth, analyze: async (_u, input) => { got = input; return { message: "ok" } as any; } });
    const res = await h(req({ rawText: "", jobId: "j1", measurements: ["36V"] }));
    expect(res.status).toBe(200);
    expect(got).toMatchObject({ workshopId: "ws-1", jobId: "j1", measurements: ["36V"] });
  });

  it("geçerli istek 200 ve form ipuçlarını iletir", async () => {
    let got: any;
    const h = makeAnalyzeHandler({ authenticate: okAuth, analyze: async (_u, input) => { got = input; return { message: "Merhaba" } as any; } });
    const res = await h(req({ rawText: "gaz vermiyor", brand: "Ducati", model: "Pro-III", errorCode: "E10" }));
    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("Merhaba");
    expect(got).toMatchObject({ workshopId: "ws-1", rawText: "gaz vermiyor", brandHint: "Ducati", modelHint: "Pro-III", errorCodeHint: "E10" });
  });

  it("yapay zekâ hatasında 502 ve jobId", async () => {
    const h = makeAnalyzeHandler({
      authenticate: okAuth,
      analyze: async () => { throw Object.assign(new LlmError("api", "x"), { jobId: "j9" }); },
    });
    const res = await h(req({ rawText: "gaz vermiyor" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.jobId).toBe("j9");
    expect(body.error).toContain("iş kaydedildi");
  });
});

describe("POST /api/jobs/:id/close", () => {
  it("not zorunlu", async () => {
    const h = makeCloseHandler({ authenticate: okAuth, close: async () => ({ suggestion: null }) });
    const res = await h(req({ note: "" }), "j1");
    expect(res.status).toBe(400);
  });
  it("geçerli istek 200", async () => {
    let got: any;
    const h = makeCloseHandler({ authenticate: okAuth, close: async (_u, input) => { got = input; return { suggestion: null }; } });
    const res = await h(req({ note: "MOSFET değişti", actualPriceTl: 2000, priceItem: "Kontrol kartı tamiri" }), "j1");
    expect(res.status).toBe(200);
    expect(got).toMatchObject({ workshopId: "ws-1", jobId: "j1", actualPriceTl: 2000, actualDuration: null });
  });
});
