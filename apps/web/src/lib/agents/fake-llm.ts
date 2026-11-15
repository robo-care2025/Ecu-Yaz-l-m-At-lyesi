import type { Effort, LlmArgs, LlmCall } from "./llm";

export type FakeLlm = LlmCall & { calls: { system: string; user: string; effort: Effort }[] };

/**
 * Testler için sahte yapay zekâ. Cevapları sırayla döner; Error örneği verilirse fırlatır.
 * Fonksiyon verilirse her çağrıda o çalışır.
 */
export function createFakeLlm(responses: unknown[] | ((args: LlmArgs<unknown>, index: number) => unknown)): FakeLlm {
  const calls: FakeLlm["calls"] = [];
  const fn = async <T>(args: LlmArgs<T>): Promise<T> => {
    const index = calls.length;
    calls.push({ system: args.system, user: args.user, effort: args.effort });
    const r =
      typeof responses === "function" ? responses(args as LlmArgs<unknown>, index) : responses[index];
    if (r instanceof Error) throw r;
    if (r === undefined) throw new Error(`Sahte LLM: ${index}. çağrı için cevap yok`);
    return r as T;
  };
  return Object.assign(fn, { calls });
}
