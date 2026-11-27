import { paySchema, payQuote } from "@/domain/quotes";
import { appContext, readJson, run } from "@/lib/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => payQuote(await appContext(), (await ctx.params).id, await readJson(req, paySchema)));
}
