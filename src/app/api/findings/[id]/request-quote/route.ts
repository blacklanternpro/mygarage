import { requestFormalQuote } from "@/domain/quotes";
import { appContext, run } from "@/lib/server";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => requestFormalQuote(await appContext(), (await ctx.params).id));
}
