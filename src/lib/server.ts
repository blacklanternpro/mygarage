/**
 * Server glue for pages and route handlers: request-time DB access (Cache Components), the
 * Stage 1 tenant context, adapters, and uniform JSON error mapping.
 */
import { connection } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getDb } from "@/db/client";
import { getDemoContext } from "@/db/tenant";
import { getAdapters } from "@/adapters/registry";
import { AdapterNotConfiguredError } from "@/adapters/contracts";
import { DomainError } from "@/domain/errors";
import type { Svc } from "@/domain/context";

export interface AppContext extends Svc {
  householdId: string;
}

/** Request-scoped context. `connection()` keeps DB reads out of the prerendered shell. */
export async function appContext(): Promise<AppContext> {
  await connection();
  const db = await getDb();
  const { workshop, household } = await getDemoContext(db);
  return { db, workshop, householdId: household.id, adapters: getAdapters({ db, workshopId: workshop.id }) };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof DomainError) return Response.json({ error: { code: e.code, message: e.message, details: e.details ?? null } }, { status: e.status });
  if (e instanceof ZodError)
    return Response.json({ error: { code: "INVALID_INPUT", message: e.issues[0]?.message ?? "Check the form and try again.", details: e.issues } }, { status: 400 });
  if (e instanceof AdapterNotConfiguredError) return Response.json({ error: { code: "ADAPTER_NOT_CONFIGURED", message: e.message } }, { status: 503 });
  console.error(e);
  return Response.json({ error: { code: "INTERNAL", message: "Something went wrong on our side. Try again, or reset the demo." } }, { status: 500 });
}

export async function run<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (e) {
    return errorResponse(e);
  }
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const raw = await req.json().catch(() => ({}));
  return schema.parse(raw);
}
