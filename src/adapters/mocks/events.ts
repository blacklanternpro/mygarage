/** Persistent state for mock adapters — every call is logged to adapter_events (Inspector feed). */
import { and, desc, eq, isNull } from "drizzle-orm";
import type { DbLike } from "@/db/client";
import { adapterEvents } from "@/db/schema";
import type { AdapterMode, PortName } from "../contracts";

export interface MockContext {
  db: DbLike;
  workshopId: string | null;
}

export async function nextSeq(ctx: MockContext, port: PortName): Promise<number> {
  const [last] = await ctx.db
    .select({ seq: adapterEvents.seq })
    .from(adapterEvents)
    .where(and(eq(adapterEvents.port, port), ctx.workshopId ? eq(adapterEvents.workshopId, ctx.workshopId) : isNull(adapterEvents.workshopId)))
    .orderBy(desc(adapterEvents.seq))
    .limit(1);
  return (last?.seq ?? 0) + 1;
}

export async function logEvent(
  ctx: MockContext,
  e: { port: PortName; operation: string; seq: number; request: Record<string, unknown>; response: Record<string, unknown>; mode?: AdapterMode },
) {
  await ctx.db.insert(adapterEvents).values({
    workshopId: ctx.workshopId,
    port: e.port,
    operation: e.operation,
    seq: e.seq,
    mode: e.mode ?? "MOCK",
    request: e.request,
    response: e.response,
  });
}
