import { connection } from "next/server";
import { desc, eq } from "drizzle-orm";
import { adapterEvents } from "@/db/schema";
import { adapterStatus } from "@/adapters/registry";
import { appContext, run } from "@/lib/server";

/** Adapter Inspector: MOCK/LIVE status per port + the latest mock calls. */
export async function GET() {
  await connection();
  return run(async () => {
    const { db, workshop } = await appContext();
    const events = await db.select().from(adapterEvents).where(eq(adapterEvents.workshopId, workshop.id)).orderBy(desc(adapterEvents.createdAt), desc(adapterEvents.seq)).limit(40);
    return { adapters: adapterStatus(), events };
  });
}
