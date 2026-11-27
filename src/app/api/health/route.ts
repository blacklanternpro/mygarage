import { connection } from "next/server";
import { appContext, run } from "@/lib/server";
import { adapterStatus } from "@/adapters/registry";
import { verifyAuditChain } from "@/domain/audit";

export async function GET() {
  await connection();
  return run(async () => {
    const { db, workshop } = await appContext();
    const vault = await verifyAuditChain(db, workshop.id);
    return { ok: true, workshop: workshop.slug, licence: workshop.licenceNumber, vault, adapters: adapterStatus().map((a) => `${a.port}:${a.mode}`) };
  });
}
