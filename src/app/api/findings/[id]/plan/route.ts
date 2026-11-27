import { planForLater, planSchema } from "@/domain/quotes";
import { appContext, readJson, run } from "@/lib/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => planForLater(await appContext(), (await ctx.params).id, await readJson(req, planSchema)));
}
