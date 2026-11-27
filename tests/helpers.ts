import { openDatabase, type DB } from "@/db/client";
import { resetAndSeed } from "@/db/seed";
import { getDemoContext } from "@/db/tenant";
import { getAdapters } from "@/adapters/registry";
import type { Svc } from "@/domain/context";
import { seededSignature } from "@/db/seed-data";

export async function freshDb(): Promise<{ db: DB; close: () => Promise<void> }> {
  const { client, db } = await openDatabase();
  await resetAndSeed(db);
  return { db, close: () => client.close() };
}

export async function svcFor(db: DB): Promise<Svc & { householdId: string }> {
  const ctx = await getDemoContext(db);
  return { db, workshop: ctx.workshop, adapters: getAdapters({ db, workshopId: ctx.workshop.id }), householdId: ctx.household.id };
}

export const SIGNATURE = seededSignature("Sam Hartley");

export const FULL_REFUSAL = {
  acknowledgements: { unsafeToDrive: true, mechanicalReason: true, mechanicalDangers: true, safetyDangers: true, repairOrTowRecommended: true },
  signerName: "Sam Hartley",
  signatureSvg: SIGNATURE,
};
