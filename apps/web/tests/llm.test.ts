import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createAnthropicLlm, LlmError } from "@/lib/agents/llm";
import { createFakeLlm } from "@/lib/agents/fake-llm";

const Schema = z.object({ ok: z.boolean() });

function fakeClient(...responses: unknown[]) {
  const parse = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) parse.mockRejectedValueOnce(r);
    else parse.mockResolvedValueOnce(r);
  }
  return { client: { beta: { messages: { parse } } } as any, parse };
}

const good = { stop_reason: "end_turn", parsed_output: { ok: true } };
const args = { schema: Schema, system: "sys", user: "usr", effort: "high" as const };

afterEach(() => {
  delete process.env.AGENT_MODEL;
});

describe("createAnthropicLlm", () => {
  it("geçerli çıktıyı döner ve isteği doğru ayarlarla gönderir", async () => {
    const { client, parse } = fakeClient(good);
    const llm = createAnthropicLlm({ client });
    await expect(llm(args)).resolves.toEqual({ ok: true });
    const req = parse.mock.calls[0][0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toContain("server-side-fallback-2026-07-01");
    expect(req.output_config.effort).toBe("high");
    expect(req.system).toBe("sys");
    expect(req.messages).toEqual([{ role: "user", content: "usr" }]);
  });

  it("geçersiz çıktıda bir kez yeniden dener", async () => {
    const { client, parse } = fakeClient({ stop_reason: "end_turn", parsed_output: null }, good);
    await expect(createAnthropicLlm({ client })(args)).resolves.toEqual({ ok: true });
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("iki kez geçersiz çıktıda invalid_output hatası verir", async () => {
    const bad = { stop_reason: "end_turn", parsed_output: null };
    const { client } = fakeClient(bad, bad);
    const err = await createAnthropicLlm({ client })(args).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.kind).toBe("invalid_output");
  });

  it("refusal'da yeniden denemez", async () => {
    const { client, parse } = fakeClient({ stop_reason: "refusal", parsed_output: null });
    const err = await createAnthropicLlm({ client })(args).catch((e) => e);
    expect(err.kind).toBe("refusal");
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("ağ hatasında bir kez yeniden dener, yine olursa api hatası verir", async () => {
    const { client, parse } = fakeClient(new Error("ağ"), new Error("ağ"));
    const err = await createAnthropicLlm({ client })(args).catch((e) => e);
    expect(err.kind).toBe("api");
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("AGENT_MODEL ortam değişkenine uyar", async () => {
    process.env.AGENT_MODEL = "x-model";
    const { client, parse } = fakeClient(good);
    await createAnthropicLlm({ client })(args);
    expect(parse.mock.calls[0][0].model).toBe("x-model");
  });
});

describe("createFakeLlm", () => {
  it("cevapları sırayla döner ve çağrıları kaydeder", async () => {
    const llm = createFakeLlm([{ ok: true }, new LlmError("api", "x")]);
    await expect(llm(args)).resolves.toEqual({ ok: true });
    await expect(llm(args)).rejects.toBeInstanceOf(LlmError);
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[0]).toEqual({ system: "sys", user: "usr", effort: "high" });
  });
});
