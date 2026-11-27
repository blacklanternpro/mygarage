import { publishJob, publishSchema } from "@/domain/bridge";
import { appContext, readJson, run } from "@/lib/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => publishJob(await appContext(), (await ctx.params).id, await readJson(req, publishSchema)));
}
