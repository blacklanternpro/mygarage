import { z } from "zod";
import { sendMagicLink } from "@/domain/requests";
import { appContext, readJson, run } from "@/lib/server";

const schema = z.object({ vehicleId: z.string().uuid().optional() });

/** Stage 1 simulation of the passwordless SMS magic link (real tokens arrive in Stage 2). */
export async function POST(req: Request) {
  return run(async () => {
    const ctx = await appContext();
    const input = await readJson(req, schema);
    return sendMagicLink(ctx, { householdId: ctx.householdId, vehicleId: input.vehicleId });
  });
}
