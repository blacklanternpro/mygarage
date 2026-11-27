/**
 * Compliance vault writer. `quotes_and_approvals` is append-only (DB trigger) and hash-chained:
 * content_hash = sha256(prev_hash + canonical JSON of the event body).
 */
import { asc, desc, eq } from "drizzle-orm";
import type { DbLike } from "@/db/client";
import { quotesAndApprovals, type AuditEvent, type AuditEventType, type RefusalAcknowledgements } from "@/db/schema";
import { canonicalJson, sha256 } from "./ids";
import { now } from "./clock";

export const GENESIS_HASH = "0".repeat(64);

export interface AuditInput {
  workshopId: string;
  eventType: AuditEventType;
  actorRole: "CUSTOMER" | "ADVISOR" | "TECH" | "SYSTEM";
  vehicleId?: string | null;
  findingId?: string | null;
  quoteId?: string | null;
  signerName?: string | null;
  signatureSvg?: string | null;
  acknowledgements?: RefusalAcknowledgements | null;
  payload: Record<string, unknown>;
  occurredAt?: Date;
}

function hashBody(e: {
  workshopId: string;
  seq: number;
  eventType: string;
  actorRole: string;
  vehicleId: string | null;
  findingId: string | null;
  quoteId: string | null;
  signerName: string | null;
  signatureSvg: string | null;
  acknowledgements: unknown;
  payload: unknown;
  occurredAt: Date;
}) {
  return canonicalJson({
    workshopId: e.workshopId,
    seq: e.seq,
    eventType: e.eventType,
    actorRole: e.actorRole,
    vehicleId: e.vehicleId,
    findingId: e.findingId,
    quoteId: e.quoteId,
    signerName: e.signerName,
    signatureSha256: e.signatureSvg ? sha256(e.signatureSvg) : null,
    acknowledgements: e.acknowledgements ?? null,
    payload: e.payload,
    occurredAt: e.occurredAt.toISOString(),
  });
}

export async function appendAuditEvent(db: DbLike, input: AuditInput): Promise<AuditEvent> {
  const [last] = await db
    .select({ seq: quotesAndApprovals.seq, contentHash: quotesAndApprovals.contentHash })
    .from(quotesAndApprovals)
    .where(eq(quotesAndApprovals.workshopId, input.workshopId))
    .orderBy(desc(quotesAndApprovals.seq))
    .limit(1);
  const seq = (last?.seq ?? 0) + 1;
  const prevHash = last?.contentHash ?? GENESIS_HASH;
  // Millisecond precision only — Postgres timestamptz stores microseconds, JS Dates hold ms.
  const occurredAt = new Date(Math.floor((input.occurredAt ?? now()).getTime()));
  const row = {
    workshopId: input.workshopId,
    seq,
    eventType: input.eventType,
    actorRole: input.actorRole,
    vehicleId: input.vehicleId ?? null,
    findingId: input.findingId ?? null,
    quoteId: input.quoteId ?? null,
    signerName: input.signerName ?? null,
    signatureSvg: input.signatureSvg ?? null,
    acknowledgements: input.acknowledgements ?? null,
    payload: input.payload,
    occurredAt,
  };
  const contentHash = sha256(prevHash + hashBody(row));
  const [inserted] = await db.insert(quotesAndApprovals).values({ ...row, prevHash, contentHash }).returning();
  return inserted;
}

export interface ChainVerification {
  ok: boolean;
  count: number;
  headHash: string;
  brokenAtSeq: number | null;
}

/** Recompute every hash in order; any edit (even via superuser) breaks the chain. */
export async function verifyAuditChain(db: DbLike, workshopId: string): Promise<ChainVerification> {
  const rows = await db
    .select()
    .from(quotesAndApprovals)
    .where(eq(quotesAndApprovals.workshopId, workshopId))
    .orderBy(asc(quotesAndApprovals.seq));
  let prev = GENESIS_HASH;
  for (const r of rows) {
    const expected = sha256(prev + hashBody(r));
    if (r.prevHash !== prev || r.contentHash !== expected) {
      return { ok: false, count: rows.length, headHash: prev, brokenAtSeq: r.seq };
    }
    prev = r.contentHash;
  }
  return { ok: true, count: rows.length, headHash: prev, brokenAtSeq: null };
}
