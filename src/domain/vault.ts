/** Compliance Vault read model (append-only ACL approvals + AAAA refusals). */
import { desc, eq } from "drizzle-orm";
import { quotesAndApprovals, vehicles } from "@/db/schema";
import type { Svc } from "./context";
import { verifyAuditChain } from "./audit";

export async function getComplianceVault(svc: Svc) {
  const rows = await svc.db
    .select({ event: quotesAndApprovals, vehicle: vehicles })
    .from(quotesAndApprovals)
    .leftJoin(vehicles, eq(vehicles.id, quotesAndApprovals.vehicleId))
    .where(eq(quotesAndApprovals.workshopId, svc.workshop.id))
    .orderBy(desc(quotesAndApprovals.seq));
  const chain = await verifyAuditChain(svc.db, svc.workshop.id);
  return { rows, chain };
}
