import { eq } from "drizzle-orm";
import { z } from "zod";
import { workshops } from "@/db/schema";
import { appContext, readJson, run } from "@/lib/server";

const schema = z.object({
  bnplEnabled: z.boolean().optional(),
  bnplMinCents: z.number().int().min(10000).max(500000).optional(),
  paytoEnabled: z.boolean().optional(),
  cardEnabled: z.boolean().optional(),
});

/** Owner payment toggles. Note: there is deliberately no surcharge setting. */
export async function POST(req: Request) {
  return run(async () => {
    const ctx = await appContext();
    const input = await readJson(req, schema);
    const [w] = await ctx.db.update(workshops).set(input).where(eq(workshops.id, ctx.workshop.id)).returning();
    return { bnplEnabled: w.bnplEnabled, bnplMinCents: w.bnplMinCents, paytoEnabled: w.paytoEnabled, cardEnabled: w.cardEnabled };
  });
}
