import { approveFixedQuote, approveSchema } from "@/domain/quotes";
import { appContext, readJson, run } from "@/lib/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const input = await readJson(req, approveSchema);
    return approveFixedQuote(await appContext(), (await ctx.params).id, { ...input, userAgent: input.userAgent ?? req.headers.get("user-agent") ?? undefined });
  });
}
