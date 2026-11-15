import { createAnthropicLlm } from "@/lib/agents/llm";
import { authenticate, supabaseForUser } from "@/lib/auth";
import { createSupabaseRepo } from "@/lib/data/supabase-repo";
import { makeCloseHandler } from "@/lib/handlers";
import { closeJob } from "@/lib/pipeline/close";

export const maxDuration = 60;

const handler = makeCloseHandler({
  authenticate,
  close: (user, input) => closeJob({ repo: createSupabaseRepo(supabaseForUser(user.token)), llm: createAnthropicLlm() }, input),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handler(req, id);
}
