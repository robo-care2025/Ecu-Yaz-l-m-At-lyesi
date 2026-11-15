import { z } from "zod";
import { LlmError } from "./agents/llm";
import type { AnalysisResult, AnalyzeInput } from "./pipeline/analyze";
import type { CloseInput } from "./pipeline/close";
import type { PriceSuggestion } from "./pricing/suggest";

export type AuthUser = { userId: string; workshopId: string; token: string };
type Authenticate = (req: Request) => Promise<AuthUser | null>;

const json = (body: unknown, status = 200) => Response.json(body, { status });
const UNAUTHORIZED = () => json({ error: "Giriş yapmanız gerekiyor." }, 401);

const AnalyzeBody = z
  .object({
    rawText: z.string().max(5000, "Şikâyet metni çok uzun (en fazla 5000 karakter)."),
    jobId: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    errorCode: z.string().optional(),
    measurements: z.array(z.string().max(200)).max(20).optional(),
  })
  .refine((b) => b.jobId || b.rawText.trim().length > 0, { message: "Şikâyet metni boş olamaz." });

const CloseBody = z.object({
  note: z.string().trim().min(1, "Lütfen sorunu ve yaptığınız işlemi kısaca yazın.").max(3000),
  actualPriceTl: z.number().int().nonnegative().optional(),
  actualDuration: z.string().max(100).optional(),
  priceItem: z.string().optional(),
});

async function readBody<T>(req: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: json({ error: "İstek okunamadı." }, 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, res: json({ error: parsed.error.issues[0]?.message ?? "Geçersiz istek." }, 400) };
  return { ok: true, data: parsed.data };
}

function aiError(err: unknown): Response | null {
  if (!(err instanceof LlmError)) return null;
  return json(
    {
      error: "Yapay zekâ şu an cevap veremedi, iş kaydedildi. Biraz sonra tekrar deneyin.",
      jobId: (err as { jobId?: string }).jobId ?? null,
    },
    502,
  );
}

export function makeAnalyzeHandler(deps: {
  authenticate: Authenticate;
  analyze: (user: AuthUser, input: AnalyzeInput) => Promise<AnalysisResult>;
}) {
  return async (req: Request): Promise<Response> => {
    const user = await deps.authenticate(req);
    if (!user) return UNAUTHORIZED();
    const body = await readBody(req, AnalyzeBody);
    if (!body.ok) return body.res;
    const b = body.data;
    try {
      const result = await deps.analyze(user, {
        workshopId: user.workshopId,
        jobId: b.jobId,
        rawText: b.rawText.trim(),
        brandHint: b.brand ?? null,
        modelHint: b.model ?? null,
        errorCodeHint: b.errorCode ?? null,
        measurements: b.measurements,
      });
      return json(result);
    } catch (err) {
      const r = aiError(err);
      if (r) return r;
      console.error("analyze failed", err instanceof Error ? err.message : err);
      return json({ error: "Beklenmeyen bir hata oluştu." }, 500);
    }
  };
}

export function makeCloseHandler(deps: {
  authenticate: Authenticate;
  close: (user: AuthUser, input: CloseInput) => Promise<{ suggestion: PriceSuggestion | null }>;
}) {
  return async (req: Request, jobId: string): Promise<Response> => {
    const user = await deps.authenticate(req);
    if (!user) return UNAUTHORIZED();
    const body = await readBody(req, CloseBody);
    if (!body.ok) return body.res;
    const b = body.data;
    try {
      return json(
        await deps.close(user, {
          workshopId: user.workshopId,
          jobId,
          note: b.note,
          actualPriceTl: b.actualPriceTl ?? null,
          actualDuration: b.actualDuration ?? null,
          priceItem: b.priceItem ?? null,
        }),
      );
    } catch (err) {
      const r = aiError(err);
      if (r) return r;
      console.error("close failed", err instanceof Error ? err.message : err);
      return json({ error: "Beklenmeyen bir hata oluştu." }, 500);
    }
  };
}
