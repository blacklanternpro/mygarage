import { z } from "zod";
import { simulatePush } from "@/domain/wallet";
import { appContext, readJson, run } from "@/lib/server";

const schema = z.object({ vehicleId: z.string().uuid(), message: z.string().trim().min(3).max(180) });

export async function POST(req: Request) {
  return run(async () => {
    const ctx = await appContext();
    const input = await readJson(req, schema);
    return simulatePush(ctx.db, ctx.adapters, ctx.workshop, input.vehicleId, input.message);
  });
}
