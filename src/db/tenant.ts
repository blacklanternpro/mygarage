/**
 * Tenant scoping. Every tenant-table query must carry a workshop_id predicate — use `scoped()`.
 * In Stage 2 the same predicate is backed by Postgres RLS (docs/sql/rls-policies.sql), set per
 * transaction with `SET LOCAL app.workshop_id`.
 */
import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { DbLike } from "./client";
import { households, workshops, type Household, type Workshop } from "./schema";
import { notFound } from "@/domain/errors";
import { DEMO_HOUSEHOLD_KEY, DEMO_WORKSHOP_KEY } from "./seed-data";
import { stableId } from "@/domain/ids";

export function scoped(table: { workshopId: PgColumn }, workshopId: string, ...conditions: (SQL | undefined)[]): SQL {
  return and(eq(table.workshopId, workshopId), ...conditions) as SQL;
}

export const DEMO_WORKSHOP_ID = stableId(DEMO_WORKSHOP_KEY);
export const DEMO_HOUSEHOLD_ID = stableId(DEMO_HOUSEHOLD_KEY);

export interface TenantContext {
  workshop: Workshop;
  household: Household;
}

/**
 * Stage 1 session: the seeded demo workshop + household (no login wall). Stage 2 resolves the
 * workshop from the subdomain and the household from a verified magic-link session.
 */
export async function getDemoContext(db: DbLike): Promise<TenantContext> {
  const slug = process.env.DEMO_WORKSHOP_SLUG || "south-west-mechanical";
  const [workshop] = await db.select().from(workshops).where(eq(workshops.slug, slug)).limit(1);
  if (!workshop) throw notFound(`Workshop "${slug}"`);
  const [household] = await db
    .select()
    .from(households)
    .where(scoped(households, workshop.id, eq(households.id, DEMO_HOUSEHOLD_ID)))
    .limit(1);
  if (!household) throw notFound("Demo household");
  return { workshop, household };
}

export async function getWorkshop(db: DbLike): Promise<Workshop> {
  return (await getDemoContext(db)).workshop;
}
