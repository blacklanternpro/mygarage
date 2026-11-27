import { getDb } from "@/db/client";
import { resetAndSeed } from "@/db/seed";
import { verifyAuditChain } from "@/domain/audit";
import { DEMO_WORKSHOP_ID } from "@/db/tenant";
import { run } from "@/lib/server";
import { connection } from "next/server";

/** One-click demo reset: truncate every tenant table and re-seed in-process. */
export async function POST() {
  await connection();
  return run(async () => {
    const db = await getDb();
    const t = Date.now();
    await resetAndSeed(db);
    const chain = await verifyAuditChain(db, DEMO_WORKSHOP_ID);
    return { ok: true, ms: Date.now() - t, vault: chain };
  });
}
