import { publishFindingSchema, publishPendingFinding } from "@/domain/dvi";
import { appContext, readJson, run } from "@/lib/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => publishPendingFinding(await appContext(), (await ctx.params).id, await readJson(req, publishFindingSchema)));
}
