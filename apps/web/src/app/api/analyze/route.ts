import { createAnthropicLlm, currentModel } from "@/lib/agents/llm";
import { authenticate, supabaseForUser } from "@/lib/auth";
import { createSupabaseRepo } from "@/lib/data/supabase-repo";
import { makeAnalyzeHandler } from "@/lib/handlers";
import { analyzeJob } from "@/lib/pipeline/analyze";

export const maxDuration = 120;

const handler = makeAnalyzeHandler({
  authenticate,
  analyze: (user, input) =>
    analyzeJob({ repo: createSupabaseRepo(supabaseForUser(user.token)), llm: createAnthropicLlm(), model: currentModel() }, input),
});

export async function POST(req: Request) {
  return handler(req);
}
