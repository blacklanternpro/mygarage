import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { resetAndSeed } from "@/db/seed";
import { adapterEvents, findings, fixedQuotes, payments, quotesAndApprovals, reminders, vehicles, walletPasses, workshops } from "@/db/schema";
import { id } from "@/db/seed-data";
import { getHouseholdGarage, getVehicleDetail } from "@/domain/garage";
import { approveFixedQuote, declineFinding, declineFixedQuote, markResolvedElsewhere, payQuote, planForLater } from "@/domain/quotes";
import { verifyAuditChain } from "@/domain/audit";
import { ingestPdf, publishJob } from "@/domain/bridge";
import { createBooking, createModQuoteRequest, getTriageInbox } from "@/domain/requests";
import { getRainyDayPipeline, launchFillBayCampaign, planQuietBay } from "@/domain/pipeline";
import { pendingFindings, publishPendingFinding, saveVoiceFinding, structureDictation } from "@/domain/dvi";
import { DomainError } from "@/domain/errors";
import { addDaysIso, isoDate, now } from "@/domain/clock";
import { FULL_REFUSAL, SIGNATURE, freshDb, svcFor } from "./helpers";

let db: DB;
let close: () => Promise<void>;

const HILUX = id("vehicle:hilux");
const CX5 = id("vehicle:cx5");
const BRAKE_QUOTE = id("quote:hilux-brakes");
const LIFT_QUOTE = id("quote:hilux-lift");
const PADS = id("finding:hilux-front-pads");
const SHOCKS = id("finding:hilux-rear-shocks");

async function expectDomainError(p: Promise<unknown>, status: number, code?: string) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).status).toBe(status);
    if (code) expect((e as DomainError).code).toBe(code);
    return e as DomainError;
  }
  throw new Error(`Expected DomainError ${status}`);
}

beforeAll(async () => {
  ({ db, close } = await freshDb());
});
afterAll(async () => close());
beforeEach(async () => resetAndSeed(db));

describe("seeded demo world", () => {
  it("builds the Hartley household garage", async () => {
    const svc = await svcFor(db);
    const g = await getHouseholdGarage(db, svc.workshop.id, svc.householdId);
    const byModel = Object.fromEntries(g.vehicles.map((c) => [c.vehicle.model, c]));
    expect(Object.keys(byModel)).toEqual(["HiLux", "CX-5", "Ranger"]);
    expect(byModel.HiLux).toMatchObject({ health: "URGENT_RED", red: 1, amber: 2 });
    expect(byModel["CX-5"]).toMatchObject({ health: "HEALTHY_GREEN", red: 0, amber: 0, nextServiceDays: 24, regoExpiryDays: 41 });
    expect(byModel.Ranger).toMatchObject({ health: "WATCH_AMBER", amber: 1 });
    expect(svc.workshop.licenceNumber).toBe("MRB8421");
  });
  it("seeds a verified compliance chain and wallet passes for every vehicle", async () => {
    const svc = await svcFor(db);
    const chain = await verifyAuditChain(db, svc.workshop.id);
    expect(chain).toMatchObject({ ok: true, count: 5 });
    const passes = await db.select().from(walletPasses);
    expect(passes.length).toBe(13);
    expect(await db.select().from(adapterEvents)).toHaveLength(0);
  });
});

describe("ACL fixed quote approval + payment", () => {
  it("approves with signature, chains the audit event and pays via PayTo with no surcharge", async () => {
    const svc = await svcFor(db);
    const r = await approveFixedQuote(svc, BRAKE_QUOTE, { signerName: "Sam Hartley", signatureSvg: SIGNATURE, approvedLineIds: ["q1", "q2", "q3"] });
    expect(r.approvedTotalCents).toBe(46800);
    const [q] = await db.select().from(fixedQuotes).where(eq(fixedQuotes.id, BRAKE_QUOTE));
    expect(q.status).toBe("APPROVED");
    const [f] = await db.select().from(findings).where(eq(findings.id, PADS));
    expect(f.status).toBe("APPROVED");
    expect((await verifyAuditChain(db, svc.workshop.id)).ok).toBe(true);

    const paid = await payQuote(svc, BRAKE_QUOTE, { rail: "PAYTO" });
    expect(paid.payment).toMatchObject({ amountCents: 46800, workshopFeeCents: 350, surchargeCents: 0 });
    await expectDomainError(payQuote(svc, BRAKE_QUOTE, { rail: "CARD" }), 409);
  });
  it("requires a full name and drawn signature", async () => {
    const svc = await svcFor(db);
    await expectDomainError(approveFixedQuote(svc, BRAKE_QUOTE, { signerName: "Sam", signatureSvg: "", approvedLineIds: ["q1"] }), 422, "SIGNATURE_REQUIRED");
  });
  it("offers BNPL only above the threshold (lift quote yes, brakes no)", async () => {
    const svc = await svcFor(db);
    await approveFixedQuote(svc, BRAKE_QUOTE, { signerName: "Sam Hartley", signatureSvg: SIGNATURE, approvedLineIds: ["q1", "q2", "q3"] });
    await expectDomainError(payQuote(svc, BRAKE_QUOTE, { rail: "BNPL_AFTERPAY" }), 422, "RAIL_UNAVAILABLE");
    await approveFixedQuote(svc, LIFT_QUOTE, { signerName: "Sam Hartley", signatureSvg: SIGNATURE, approvedLineIds: ["m1", "m2", "m3", "m4"] });
    const paid = await payQuote(svc, LIFT_QUOTE, { rail: "BNPL_AFTERPAY" });
    expect(paid.payment.amountCents).toBe(330000);
  });
  it("enforces zero surcharging at the database level", async () => {
    const svc = await svcFor(db);
    await expect(
      db.insert(payments).values({ workshopId: svc.workshop.id, vehicleId: HILUX, rail: "CARD", amountCents: 1000, workshopFeeCents: 47, surchargeCents: 15, status: "SUCCEEDED", providerRef: "x" }),
    ).rejects.toThrow();
  });
});

describe("AAAA unsafe vehicle refusal", () => {
  it("blocks declining a Red item without the 5-point acknowledgement", async () => {
    const svc = await svcFor(db);
    await expectDomainError(declineFinding(svc, PADS, {}), 422, "AAAA_REFUSAL_REQUIRED");
    await expectDomainError(
      declineFixedQuote(svc, BRAKE_QUOTE, { refusal: { ...FULL_REFUSAL, acknowledgements: { ...FULL_REFUSAL.acknowledgements, unsafeToDrive: false } } }),
      422,
      "AAAA_REFUSAL_INCOMPLETE",
    );
    const [f] = await db.select().from(findings).where(eq(findings.id, PADS));
    expect(f.status).toBe("QUOTED");
  });
  it("records a signed refusal in the vault and declines the quote", async () => {
    const svc = await svcFor(db);
    await declineFixedQuote(svc, BRAKE_QUOTE, { refusal: FULL_REFUSAL });
    const events = await db.select().from(quotesAndApprovals).where(eq(quotesAndApprovals.eventType, "UNSAFE_VEHICLE_REFUSAL"));
    const mine = events.find((e) => e.findingId === PADS);
    expect(mine?.signerName).toBe("Sam Hartley");
    expect(mine?.acknowledgements).toEqual(FULL_REFUSAL.acknowledgements);
    const [q] = await db.select().from(fixedQuotes).where(eq(fixedQuotes.id, BRAKE_QUOTE));
    expect(q.status).toBe("DECLINED");
    expect((await verifyAuditChain(db, svc.workshop.id)).ok).toBe(true);
  });
  it("lets Amber items be declined without the AAAA modal", async () => {
    const svc = await svcFor(db);
    const r = await declineFinding(svc, SHOCKS, {});
    expect(r.unsafeAcknowledgementSeq).toBeNull();
  });
});

describe("compliance vault immutability", () => {
  it("rejects UPDATE and DELETE on quotes_and_approvals", async () => {
    const cause = async (p: Promise<unknown>) => {
      try {
        await p;
        return "no error";
      } catch (e) {
        const err = e as { message: string; cause?: { message?: string } };
        return `${err.message} ${err.cause?.message ?? ""}`;
      }
    };
    expect(await cause(db.update(quotesAndApprovals).set({ signerName: "Someone else" }))).toMatch(/append-only: UPDATE/);
    expect(await cause(db.delete(quotesAndApprovals))).toMatch(/append-only: DELETE/);
  });
  it("detects tampering even if the trigger is bypassed", async () => {
    const svc = await svcFor(db);
    await db.execute(sql`ALTER TABLE quotes_and_approvals DISABLE TRIGGER quotes_and_approvals_immutable`);
    await db.execute(sql`UPDATE quotes_and_approvals SET signer_name = 'Tampered' WHERE seq = 2`);
    await db.execute(sql`ALTER TABLE quotes_and_approvals ENABLE TRIGGER quotes_and_approvals_immutable`);
    const chain = await verifyAuditChain(db, svc.workshop.id);
    expect(chain.ok).toBe(false);
    expect(chain.brokenAtSeq).toBe(2);
  });
});

describe("customer watch-list actions", () => {
  it("plans an item for later and schedules a reminder", async () => {
    const svc = await svcFor(db);
    const r = await planForLater(svc, SHOCKS, { horizon: "3M" });
    expect(r.status).toBe("PLANNED");
    const rem = await db.select().from(reminders).where(and(eq(reminders.findingId, SHOCKS), eq(reminders.kind, "WATCH_ITEM")));
    expect(rem).toHaveLength(1);
  });
  it("marks resolved elsewhere and updates the wallet pass count", async () => {
    const svc = await svcFor(db);
    const [before] = await db.select().from(walletPasses).where(eq(walletPasses.vehicleId, HILUX));
    await markResolvedElsewhere(svc, id("finding:hilux-battery"), { note: "Replaced at roadside assist" });
    const [after] = await db.select().from(walletPasses).where(eq(walletPasses.vehicleId, HILUX));
    expect(after.version).toBe(before.version + 1);
    expect(JSON.stringify(after.payload)).toContain("2 open (1 urgent)");
  });
  it("books ticked items and a loan car", async () => {
    const svc = await svcFor(db);
    const b = await createBooking(svc, { vehicleId: HILUX, serviceType: "REPAIR", findingIds: [SHOCKS], requestedDate: addDaysIso(isoDate(now()), 3), dropOff: "7:30 – 8:30 am", loanCar: true });
    expect(b.loanCar).toBe(true);
    const [f] = await db.select().from(findings).where(eq(findings.id, SHOCKS));
    expect(f.status).toBe("BOOKED");
  });
});

describe("PDF bridge publish", () => {
  it("ingests the bundled sample, then publishes to the CX-5 garage and wallet pass", async () => {
    const svc = await svcFor(db);
    const bytes = new Uint8Array(fs.readFileSync(path.join(process.cwd(), "public/samples/sample-mechanicdesk-invoice.pdf")));
    const ing = await ingestPdf(svc, { filename: "sample-mechanicdesk-invoice.pdf", bytes, source: "SAMPLE" });
    expect(ing.vehicle?.id).toBe(CX5);
    expect(ing.job.status).toBe("IN_REVIEW");
    expect(ing.confidence).toBeGreaterThan(0.9);
    const [passBefore] = await db.select().from(walletPasses).where(eq(walletPasses.vehicleId, CX5));

    const pub = await publishJob(svc, ing.job.id, { reviewSeconds: 8.2, publishedBy: "Kirsty Brennan", recommendations: [] });
    expect(pub.findingsPublished).toBe(2);
    expect(pub.walletPushed).toBe(true);
    const detail = await getVehicleDetail(db, svc.workshop.id, CX5);
    expect(detail!.serviceRecords[0].invoiceNumber).toBe("MD-30458");
    expect(detail!.card.health).toBe("WATCH_AMBER");
    expect(detail!.amber.map((f) => f.title)).toContain("Rear tyres at 3.5 mm");
    expect(detail!.green).toHaveLength(8);
    const [v] = await db.select().from(vehicles).where(eq(vehicles.id, CX5));
    expect(v.odometerKm).toBe(67540);
    expect(v.nextServiceDueKm).toBe(77540);
    const [passAfter] = await db.select().from(walletPasses).where(eq(walletPasses.vehicleId, CX5));
    expect(passAfter.version).toBe(passBefore.version + 1);
    expect(JSON.stringify(passAfter.payload)).toContain("77,540 km");

    await expectDomainError(publishJob(svc, ing.job.id, { publishedBy: "Kirsty", recommendations: [] }), 409);
  });
});

describe("mod quotes, triage, pipeline, bay DVI", () => {
  it("lands a customer mod quote in the triage inbox with VIN/variant attached", async () => {
    const svc = await svcFor(db);
    const req = await createModQuoteRequest(svc, { vehicleId: CX5, modType: "TOWING", description: "Towbar and brake controller for a small box trailer please.", photos: [] });
    const inbox = await getTriageInbox(svc);
    const hit = inbox.mods.find((m) => m.request.id === req.id);
    expect(hit?.request.vinSnapshot).toBe("JM0KF4W7A00123456");
    expect(hit?.request.variantSnapshot).toContain("CX-5 Touring AWD");
  });
  it("ranks deferred work and fills a quiet bay", async () => {
    const svc = await svcFor(db);
    const p = await getRainyDayPipeline(svc);
    expect(p.totals.count).toBeGreaterThanOrEqual(12);
    expect(p.totals.recoverableCents).toBeGreaterThan(500_000);
    for (let i = 1; i < p.items.length; i++) expect(p.items[i - 1].score).toBeGreaterThanOrEqual(p.items[i].score);
    const plan = planQuietBay(p.items, 7.5);
    expect(plan.reduce((s, i) => s + i.hours, 0)).toBeLessThanOrEqual(7.5);
    const launched = await launchFillBayCampaign(svc, { findingIds: plan.map((i) => i.finding.id), advisorName: "Kirsty Brennan" });
    expect(launched.sent.length).toBe(plan.length);
    const sms = await db.select().from(adapterEvents).where(eq(adapterEvents.port, "sms"));
    expect(sms.length).toBe(plan.length);
    expect(String(sms[0].request.body)).toContain("Non-binding est.");
  });
  it("saves a dictated finding for advisor review, then publishes it to the garage", async () => {
    const svc = await svcFor(db);
    const draft = structureDictation("Left rear shock misting oil, watch it for next service, roughly 400 to 450 bucks for the pair.");
    const f = await saveVoiceFinding(svc, { vehicleId: CX5, technicianName: "Jordan Pike", transcript: draft.transcript, severity: draft.severity, title: draft.title, customerExplanation: draft.customerExplanation, category: draft.category, measurement: draft.measurement, horizonText: draft.horizonText, estimateLowCents: draft.estimateLowCents, estimateHighCents: draft.estimateHighCents });
    expect(f.reviewStatus).toBe("PENDING_REVIEW");
    expect((await getVehicleDetail(db, svc.workshop.id, CX5))!.amber).toHaveLength(0);
    expect((await pendingFindings(svc)).map((p) => p.finding.id)).toContain(f.id);
    await publishPendingFinding(svc, f.id, { advisorName: "Kirsty Brennan", reject: false });
    expect((await getVehicleDetail(db, svc.workshop.id, CX5))!.amber.map((a) => a.id)).toContain(f.id);
  });
});

describe("tenant isolation", () => {
  it("never returns another workshop's vehicle", async () => {
    const [other] = await db
      .insert(workshops)
      .values({ slug: "other-shop", name: "Other Shop", ownerNames: "X", staffCount: 2, addressLine: "1 St", suburb: "Perth", state: "WA", postcode: "6000", phone: "08", email: "x@example.com", abn: "0", licenceState: "WA", licenceType: "MRB", licenceNumber: "MRB0001", wms: "COSTAR", brandPrimary: "#000000", brandAccent: "#ffffff", smsSenderId: "Other", hoursText: "-", labourRateCents: 15000 })
      .returning();
    expect(await getVehicleDetail(db, other.id, HILUX)).toBeNull();
  });
});
