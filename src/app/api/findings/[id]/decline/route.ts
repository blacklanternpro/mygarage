import { declineFinding, declineSchema } from "@/domain/quotes";
import { appContext, readJson, run } from "@/lib/server";

/** Red/safety-critical items return 422 unless the 5-point AAAA acknowledgement is complete. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => declineFinding(await appContext(), (await ctx.params).id, await readJson(req, declineSchema)));
}
