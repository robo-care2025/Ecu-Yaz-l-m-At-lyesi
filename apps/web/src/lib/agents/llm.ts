import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export type Effort = "low" | "medium" | "high";

export type LlmArgs<T> = { schema: z.ZodType<T>; system: string; user: string; effort: Effort };

/** Tüm ajanların yapay zekâyı çağırdığı tek arayüz. Testlerde sahtesi kullanılır. */
export type LlmCall = <T>(args: LlmArgs<T>) => Promise<T>;

export type LlmErrorKind = "refusal" | "invalid_output" | "api";

export class LlmError extends Error {
  constructor(
    public readonly kind: LlmErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export const DEFAULT_MODEL = "claude-opus-5-5";

export function currentModel(): string {
  return process.env.AGENT_MODEL || DEFAULT_MODEL;
}

/** 4xx hataları (yanlış istek, geçersiz anahtar) tekrar denemekle düzelmez. */
function isRetryable(err: unknown): boolean {
  if (err instanceof APIError && typeof err.status === "number") {
    return err.status === 408 || err.status === 409 || err.status === 429 || err.status >= 500;
  }
  return true;
}

export function createAnthropicLlm(opts: { client?: Pick<Anthropic, "beta">; model?: string } = {}): LlmCall {
  const client = opts.client ?? new Anthropic();

  async function once<T>(args: LlmArgs<T>): Promise<T> {
    let response;
    try {
      response = await client.beta.messages.parse({
        model: opts.model ?? currentModel(),
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {
          effort: args.effort,
          format: betaZodOutputFormat(args.schema as z.ZodType<T>),
        },
        system: args.system,
        messages: [{ role: "user", content: args.user }],
      });
    } catch (err) {
      const e = new LlmError("api", err instanceof Error ? err.message : String(err));
      (e as { retryable?: boolean }).retryable = isRetryable(err);
      throw e;
    }
    if (response.stop_reason === "refusal") {
      throw new LlmError("refusal", "Yapay zekâ bu isteği yanıtlamayı reddetti.");
    }
    if (response.parsed_output == null) {
      throw new LlmError("invalid_output", "Yapay zekâ beklenen biçimde cevap vermedi.");
    }
    return response.parsed_output as T;
  }

  return async function call<T>(args: LlmArgs<T>): Promise<T> {
    try {
      return await once(args);
    } catch (err) {
      const retry =
        err instanceof LlmError &&
        err.kind !== "refusal" &&
        (err as { retryable?: boolean }).retryable !== false;
      if (!retry) throw err;
      return await once(args);
    }
  };
}
