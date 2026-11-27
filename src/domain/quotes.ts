/**
 * Customer decisions on findings and Fixed Quotes. Every decision that carries legal weight is
 * written to the append-only, hash-chained compliance vault.
 */
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { customers, findings, fixedQuotes, messages, payments, vehicles, type Finding, type FixedQuote } from "@/db/schema";
import { scoped } from "@/db/tenant";
import type { Rail } from "@/adapters/contracts";
import type { Svc } from "./context";
import { appendAuditEvent } from "./audit";
import {
  ACL_ESTIMATE_LABEL,
  FIXED_QUOTE_LABEL,
  FIXED_QUOTE_TERMS,
  assertUnsafeRefusalComplete,
  isDrawnSignature,
  isFullName,
  licenceLabel,
  unsafeRefusalSchema,
  type UnsafeRefusalInput,
} from "./compliance";
import { DomainError, conflict, notFound, unprocessable } from "./errors";
import { isoDate, now } from "./clock";
import { formatAudExact, formatDate, totalsFromLineItems } from "./format";
import { remindAtForHorizon, refreshVehicleReminders } from "./reminders";
import { syncWalletPass } from "./wallet";
import { availableRails, railMeta, workshopFeeCents } from "./payments";
import { RECOVERABLE_STATUSES } from "./status";

async function loadFinding(svc: Svc, findingId: string): Promise<Finding> {
  const [f] = await svc.db.select().from(findings).where(scoped(findings, svc.workshop.id, eq(findings.id, findingId)));
  if (!f) throw notFound("Finding");
  return f;
}

async function loadQuote(svc: Svc, quoteId: string): Promise<FixedQuote> {
  const [q] = await svc.db.select().from(fixedQuotes).where(scoped(fixedQuotes, svc.workshop.id, eq(fixedQuotes.id, quoteId)));
  if (!q) throw notFound("Fixed quote");
  return q;
}

async function driverName(svc: Svc, vehicleId: string): Promise<string> {
  const [row] = await svc.db
    .select({ first: customers.firstName, last: customers.lastName })
    .from(vehicles)
    .leftJoin(customers, eq(customers.id, vehicles.primaryDriverId))
    .where(scoped(vehicles, svc.workshop.id, eq(vehicles.id, vehicleId)));
  return row?.first ? `${row.first} ${row.last}` : "Customer";
}

async function systemMessage(svc: Svc, vehicleId: string, body: string, extra: { quoteId?: string; thread?: "VEHICLE" | "MOD"; modQuoteRequestId?: string | null } = {}) {
  await svc.db.insert(messages).values({
    workshopId: svc.workshop.id,
    vehicleId,
    thread: extra.thread ?? "VEHICLE",
    modQuoteRequestId: extra.modQuoteRequestId ?? null,
    quoteId: extra.quoteId ?? null,
    authorRole: "SYSTEM",
    authorName: "MyGarage",
    body,
  });
}

function assertOpenForDecision(f: Finding) {
  if (!RECOVERABLE_STATUSES.includes(f.status) && f.status !== "APPROVED" && f.status !== "BOOKED")
    throw conflict(`This item is already ${f.status.toLowerCase().replace(/_/g, " ")}.`);
}

// ─── Plan for later / resolved elsewhere / request quote ───────────────────

export const planSchema = z.object({ horizon: z.enum(["1M", "3M", "NEXT_SERVICE"]) });

export async function planForLater(svc: Svc, findingId: string, input: z.infer<typeof planSchema>) {
  const f = await loadFinding(svc, findingId);
  if (f.severity === "HEALTHY_GREEN") throw unprocessable("NOT_A_WATCH_ITEM", "Healthy items don't need a plan.");
  assertOpenForDecision(f);
  const [v] = await svc.db.select().from(vehicles).where(scoped(vehicles, svc.workshop.id, eq(vehicles.id, f.vehicleId)));
  const remindAt = remindAtForHorizon(input.horizon, v);
  await svc.db
    .update(findings)
    .set({ status: "PLANNED", plannedHorizon: input.horizon, plannedRemindAt: remindAt, updatedAt: now() })
    .where(scoped(findings, svc.workshop.id, eq(findings.id, f.id)));
  await appendAuditEvent(svc.db, {
    workshopId: svc.workshop.id,
    eventType: "ESTIMATE_PLANNED",
    actorRole: "CUSTOMER",
    vehicleId: f.vehicleId,
    findingId: f.id,
    signerName: await driverName(svc, f.vehicleId),
    payload: {
      title: f.title,
      horizon: input.horizon,
      remindAt: remindAt.toISOString(),
      estimateLowCents: f.estimateLowCents,
      estimateHighCents: f.estimateHighCents,
      labelShown: ACL_ESTIMATE_LABEL,
    },
  });
  await refreshVehicleReminders(svc.db, svc.workshop.id, f.vehicleId);
  await syncWalletPass(svc.db, svc.adapters, svc.workshop, f.vehicleId);
  return { status: "PLANNED", remindAt: remindAt.toISOString(), remindOn: formatDate(remindAt) };
}

export const resolvedSchema = z.object({ note: z.string().trim().max(300).optional() });

export async function markResolvedElsewhere(svc: Svc, findingId: string, input: z.infer<typeof resolvedSchema>) {
  const f = await loadFinding(svc, findingId);
  assertOpenForDecision(f);
  await svc.db
    .update(findings)
    .set({ status: "RESOLVED_ELSEWHERE", resolvedNote: input.note ?? null, updatedAt: now() })
    .where(scoped(findings, svc.workshop.id, eq(findings.id, f.id)));
  await appendAuditEvent(svc.db, {
    workshopId: svc.workshop.id,
    eventType: "RESOLVED_ELSEWHERE",
    actorRole: "CUSTOMER",
    vehicleId: f.vehicleId,
    findingId: f.id,
    signerName: await driverName(svc, f.vehicleId),
    payload: { title: f.title, note: input.note ?? null, severity: f.severity },
  });
  await refreshVehicleReminders(svc.db, svc.workshop.id, f.vehicleId);
  await syncWalletPass(svc.db, svc.adapters, svc.workshop, f.vehicleId, { pushMessage: `${f.title} marked as resolved.` });
  return { status: "RESOLVED_ELSEWHERE" };
}

export async function requestFormalQuote(svc: Svc, findingId: string) {
  const f = await loadFinding(svc, findingId);
  assertOpenForDecision(f);
  if (f.status === "QUOTED") throw conflict("A Fixed Quote is already waiting for you on this item.");
  await svc.db.update(findings).set({ status: "QUOTE_REQUESTED", updatedAt: now() }).where(scoped(findings, svc.workshop.id, eq(findings.id, f.id)));
  const who = await driverName(svc, f.vehicleId);
  await systemMessage(svc, f.vehicleId, `${who} asked for a Fixed Quote: ${f.title}. The workshop will re-inspect and price the parts.`);
  return { status: "QUOTE_REQUESTED" };
}

// ─── Fixed Quote approval ──────────────────────────────────────────────────

export const approveSchema = z.object({
  signerName: z.string().trim(),
  signatureSvg: z.string(),
  approvedLineIds: z.array(z.string()).min(1, "Approve at least one line item."),
  userAgent: z.string().max(300).optional(),
});

export async function approveFixedQuote(svc: Svc, quoteId: string, input: z.infer<typeof approveSchema>) {
  const q = await loadQuote(svc, quoteId);
  if (q.status !== "ISSUED") throw conflict(`This quote is already ${q.status.toLowerCase()}.`);
  if (q.validUntil < isoDate(now())) throw conflict("This quote has expired. Ask the workshop to re-issue it.");
  const missing: string[] = [];
  if (!isFullName(input.signerName)) missing.push("signerName");
  if (!isDrawnSignature(input.signatureSvg)) missing.push("signature");
  if (missing.length) throw unprocessable("SIGNATURE_REQUIRED", "Type your full name and sign to approve.", { missing });
  const lines = q.lineItems.filter((l) => input.approvedLineIds.includes(l.id));
  if (!lines.length) throw unprocessable("NO_LINES", "Approve at least one line item.");
  const totals = totalsFromLineItems(lines);
  const decidedAt = now();
  await svc.db
    .update(fixedQuotes)
    .set({ status: "APPROVED", decidedAt, approvedLineIds: lines.map((l) => l.id) })
    .where(scoped(fixedQuotes, svc.workshop.id, eq(fixedQuotes.id, q.id)));
  if (q.findingIds.length)
    await svc.db
      .update(findings)
      .set({ status: "APPROVED", updatedAt: decidedAt })
      .where(scoped(findings, svc.workshop.id, inArray(findings.id, q.findingIds)));
  const event = await appendAuditEvent(svc.db, {
    workshopId: svc.workshop.id,
    eventType: "QUOTE_APPROVED",
    actorRole: "CUSTOMER",
    vehicleId: q.vehicleId,
    quoteId: q.id,
    findingId: q.findingIds[0] ?? null,
    signerName: input.signerName,
    signatureSvg: input.signatureSvg,
    payload: {
      quoteNumber: q.quoteNumber,
      title: q.title,
      label: FIXED_QUOTE_LABEL,
      terms: FIXED_QUOTE_TERMS,
      approvedLineItems: lines,
      declinedLineIds: q.lineItems.filter((l) => !input.approvedLineIds.includes(l.id)).map((l) => l.id),
      approvedTotalCents: totals.totalCents,
      gstCents: totals.gstCents,
      validUntil: q.validUntil,
      licence: licenceLabel(svc.workshop),
      channel: "PWA",
      userAgent: input.userAgent ?? null,
    },
    occurredAt: decidedAt,
  });
  await systemMessage(
    svc,
    q.vehicleId,
    `${input.signerName} approved Fixed Quote ${q.quoteNumber} (${formatAudExact(totals.totalCents)} inc. GST). Signed and timestamped.`,
    { quoteId: q.id, thread: q.modQuoteRequestId ? "MOD" : "VEHICLE", modQuoteRequestId: q.modQuoteRequestId },
  );
  await svc.adapters.sms.send({
    to: svc.workshop.phone,
    senderId: svc.workshop.smsSenderId,
    body: `Quote ${q.quoteNumber} approved by ${input.signerName} — ${formatAudExact(totals.totalCents)}. Book it in.`,
    tag: "advisor-alert",
  });
  await syncWalletPass(svc.db, svc.adapters, svc.workshop, q.vehicleId);
  return { status: "APPROVED", approvedTotalCents: totals.totalCents, auditSeq: event.seq, contentHash: event.contentHash };
}

// ─── Decline (with AAAA enforcement for safety-critical items) ─────────────

export const declineSchema = z.object({
  refusal: unsafeRefusalSchema.optional(),
  reason: z.string().trim().max(300).optional(),
});

async function recordRefusal(svc: Svc, f: Finding, refusal: UnsafeRefusalInput, quote: FixedQuote | null) {
  return appendAuditEvent(svc.db, {
    workshopId: svc.workshop.id,
    eventType: "UNSAFE_VEHICLE_REFUSAL",
    actorRole: "CUSTOMER",
    vehicleId: f.vehicleId,
    findingId: f.id,
    quoteId: quote?.id ?? null,
    signerName: refusal.signerName,
    signatureSvg: refusal.signatureSvg,
    acknowledgements: refusal.acknowledgements,
    payload: {
      findingTitle: f.title,
      measurement: f.measurement,
      reason: refusal.reason ?? null,
      standard: "AAAA Unsafe Vehicle Release Acknowledgement (5-point)",
      quoteNumber: quote?.quoteNumber ?? null,
      licence: licenceLabel(svc.workshop),
      channel: "PWA",
    },
  });
}

export function requiresUnsafeAcknowledgement(f: Pick<Finding, "severity" | "safetyCritical">): boolean {
  return f.severity === "URGENT_RED" || f.safetyCritical;
}

export async function declineFinding(svc: Svc, findingId: string, input: z.infer<typeof declineSchema>) {
  const f = await loadFinding(svc, findingId);
  assertOpenForDecision(f);
  const issued = await svc.db
    .select()
    .from(fixedQuotes)
    .where(scoped(fixedQuotes, svc.workshop.id, eq(fixedQuotes.vehicleId, f.vehicleId), eq(fixedQuotes.status, "ISSUED")));
  const linkedQuote = issued.find((q) => q.findingIds.includes(f.id)) ?? null;
  let auditSeq: number | null = null;
  if (requiresUnsafeAcknowledgement(f)) {
    assertUnsafeRefusalComplete(input.refusal);
    auditSeq = (await recordRefusal(svc, f, input.refusal, linkedQuote)).seq;
  }
  await svc.db.update(findings).set({ status: "DECLINED", updatedAt: now() }).where(scoped(findings, svc.workshop.id, eq(findings.id, f.id)));
  if (linkedQuote) {
    await svc.db.update(fixedQuotes).set({ status: "DECLINED", decidedAt: now() }).where(scoped(fixedQuotes, svc.workshop.id, eq(fixedQuotes.id, linkedQuote.id)));
    await appendAuditEvent(svc.db, {
      workshopId: svc.workshop.id,
      eventType: "QUOTE_DECLINED",
      actorRole: "CUSTOMER",
      vehicleId: f.vehicleId,
      findingId: f.id,
      quoteId: linkedQuote.id,
      signerName: input.refusal?.signerName ?? (await driverName(svc, f.vehicleId)),
      payload: { quoteNumber: linkedQuote.quoteNumber, reason: input.reason ?? input.refusal?.reason ?? null },
    });
  }
  await systemMessage(
    svc,
    f.vehicleId,
    requiresUnsafeAcknowledgement(f)
      ? `Declined against advice: ${f.title}. Unsafe vehicle acknowledgement signed and stored.`
      : `Declined for now: ${f.title}. It stays on your watch-list.`,
  );
  await syncWalletPass(svc.db, svc.adapters, svc.workshop, f.vehicleId);
  return { status: "DECLINED", unsafeAcknowledgementSeq: auditSeq };
}

/** Declining a whole quote = declining each linked finding (AAAA rules apply per finding). */
export async function declineFixedQuote(svc: Svc, quoteId: string, input: z.infer<typeof declineSchema>) {
  const q = await loadQuote(svc, quoteId);
  if (q.status !== "ISSUED") throw conflict(`This quote is already ${q.status.toLowerCase()}.`);
  if (q.findingIds.length) {
    const linked = await svc.db.select().from(findings).where(scoped(findings, svc.workshop.id, inArray(findings.id, q.findingIds)));
    for (const f of linked) if (requiresUnsafeAcknowledgement(f)) assertUnsafeRefusalComplete(input.refusal);
    const results = [];
    for (const f of linked) results.push(await declineFinding(svc, f.id, input));
    return { status: "DECLINED", results };
  }
  await svc.db.update(fixedQuotes).set({ status: "DECLINED", decidedAt: now() }).where(scoped(fixedQuotes, svc.workshop.id, eq(fixedQuotes.id, q.id)));
  await appendAuditEvent(svc.db, {
    workshopId: svc.workshop.id,
    eventType: "QUOTE_DECLINED",
    actorRole: "CUSTOMER",
    vehicleId: q.vehicleId,
    quoteId: q.id,
    signerName: await driverName(svc, q.vehicleId),
    payload: { quoteNumber: q.quoteNumber, reason: input.reason ?? null },
  });
  await systemMessage(svc, q.vehicleId, `Quote ${q.quoteNumber} declined.`, { thread: q.modQuoteRequestId ? "MOD" : "VEHICLE", modQuoteRequestId: q.modQuoteRequestId });
  return { status: "DECLINED" };
}

// ─── Checkout ──────────────────────────────────────────────────────────────

export const paySchema = z.object({ rail: z.enum(["PAYTO", "CARD", "APPLE_PAY", "GOOGLE_PAY", "BNPL_AFTERPAY", "BNPL_ZIP"]) });

export function quoteApprovedTotal(q: FixedQuote): number {
  const ids = q.approvedLineIds ?? q.lineItems.map((l) => l.id);
  return totalsFromLineItems(q.lineItems.filter((l) => ids.includes(l.id))).totalCents;
}

export async function payQuote(svc: Svc, quoteId: string, input: z.infer<typeof paySchema>) {
  const q = await loadQuote(svc, quoteId);
  if (q.status !== "APPROVED") throw conflict("Approve the Fixed Quote before paying.");
  const [already] = await svc.db.select().from(payments).where(and(eq(payments.workshopId, svc.workshop.id), eq(payments.quoteId, q.id), eq(payments.status, "SUCCEEDED")));
  if (already) throw conflict("This quote has already been paid.");
  const amountCents = quoteApprovedTotal(q);
  const option = availableRails(svc.workshop, amountCents).find((r) => r.rail === input.rail);
  if (!option?.available) throw new DomainError(422, "RAIL_UNAVAILABLE", option?.reason ?? "That payment method isn't available.");
  const fee = workshopFeeCents(input.rail as Rail, amountCents);
  const intent = await svc.adapters.payment.createIntent({ amountCents, rail: input.rail as Rail, reference: q.quoteNumber, workshopFeeCents: fee });
  const [payment] = await svc.db
    .insert(payments)
    .values({
      workshopId: svc.workshop.id,
      vehicleId: q.vehicleId,
      quoteId: q.id,
      rail: input.rail,
      amountCents,
      workshopFeeCents: fee,
      surchargeCents: 0,
      status: intent.status,
      providerRef: intent.id,
    })
    .returning();
  await systemMessage(svc, q.vehicleId, `Paid ${formatAudExact(amountCents)} for ${q.quoteNumber} via ${railMeta(input.rail as Rail).label.replace("Pay instantly via ", "")}. No surcharge.`, {
    quoteId: q.id,
    thread: q.modQuoteRequestId ? "MOD" : "VEHICLE",
    modQuoteRequestId: q.modQuoteRequestId,
  });
  return { payment, intent };
}
