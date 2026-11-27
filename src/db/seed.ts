/**
 * Idempotent demo seed. `resetAndSeed` truncates every tenant table (TRUNCATE is permitted on the
 * append-only compliance log; UPDATE/DELETE are not) and rebuilds the demo world.
 */
import { sql } from "drizzle-orm";
import type { DB, DbLike } from "./client";
import {
  TENANT_TABLE_NAMES,
  bookings,
  customers,
  findings,
  fixedQuotes,
  households,
  inspectionReports,
  messages,
  modQuoteRequests,
  nevdisLookups,
  serviceRecords,
  vehicles,
  workshops,
  type LineItem,
} from "./schema";
import {
  BRAKE_QUOTE,
  HARTLEY,
  HARTLEY_MESSAGES,
  HARTLEY_VEHICLES,
  LIFT_QUOTE,
  LIFT_REQUEST,
  STAFF,
  SUPPORT_HOUSEHOLDS,
  TRIAGE_SEEDS,
  TYRE_QUOTE_HISTORIC,
  WALKER_REFUSAL,
  WORKSHOP,
  id,
  seededSignature,
  type SeedFinding,
  type SeedVehicle,
} from "./seed-data";
import { addDaysIso, isoDate, now } from "@/domain/clock";
import { totalsFromLineItems } from "@/domain/format";
import { appendAuditEvent } from "@/domain/audit";
import { ACL_ESTIMATE_LABEL, FIXED_QUOTE_LABEL, FIXED_QUOTE_TERMS } from "@/domain/compliance";
import { getAdapters } from "@/adapters/registry";
import { syncWalletPass } from "@/domain/wallet";
import { refreshVehicleReminders } from "@/domain/reminders";
import { lookupFixture } from "@/adapters/mocks/fixtures/nevdis-registry";

export async function ensureSeeded(db: DB): Promise<boolean> {
  const [w] = await db.select({ id: workshops.id }).from(workshops).limit(1);
  if (w) return false;
  await seedDatabase(db);
  return true;
}

export async function resetAndSeed(db: DB): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE ${TENANT_TABLE_NAMES.join(", ")} RESTART IDENTITY CASCADE`));
  await seedDatabase(db);
}

export async function seedDatabase(db: DB): Promise<void> {
  await db.transaction(async (tx) => {
    await seedInto(tx);
  });
}

async function seedInto(db: DbLike) {
  const t0 = now();
  const today = isoDate(t0);
  /** A timestamp `daysAgo` days back at a Perth-local hour. */
  const at = (daysAgo: number, hour = 10, minute = 0) =>
    new Date(Date.parse(`${addDaysIso(today, -Math.floor(daysAgo))}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`) - (daysAgo % 1) * 86_400_000);
  const hoursAgo = (h: number) => new Date(t0.getTime() - h * 3_600_000);

  const workshopId = id(WORKSHOP.key);
  const { key: _wk, ...w } = WORKSHOP;
  void _wk;
  await db.insert(workshops).values({ id: workshopId, ...w, createdAt: at(900) });
  const [workshopRow] = await db.select().from(workshops).where(sql`${workshops.id} = ${workshopId}`);

  // ── Hartley household ──
  const householdId = id(HARTLEY.key);
  await db.insert(households).values({ id: householdId, workshopId, name: HARTLEY.name, createdAt: at(800) });
  await db.insert(customers).values(
    HARTLEY.customers.map((c) => ({
      id: id(c.key),
      workshopId,
      householdId,
      firstName: c.firstName,
      lastName: c.lastName,
      mobile: c.mobile,
      email: c.email,
      addressLine: c.addressLine,
      suburb: c.suburb,
      postcode: c.postcode,
      role: c.role,
      createdAt: at(800),
    })),
  );

  const insertVehicle = async (v: SeedVehicle | (Omit<SeedVehicle, "findings" | "serviceRecords" | "inspection" | "primaryDriverKey"> & { primaryDriverKey?: string }), hh: string, driverId: string | null) => {
    await db.insert(vehicles).values({
      id: id(v.key),
      workshopId,
      householdId: hh,
      primaryDriverId: driverId,
      rego: v.rego,
      regoState: v.regoState,
      regoExpiry: addDaysIso(today, v.regoExpiryDays),
      make: v.make,
      model: v.model,
      variant: v.variant,
      year: v.year,
      vin: v.vin,
      colour: v.colour,
      bodyType: v.bodyType,
      engine: v.engine,
      transmission: v.transmission,
      odometerKm: v.odometerKm,
      odometerAt: at(0, 8),
      avgKmPerDay: v.avgKmPerDay,
      nextServiceDueDate: v.nextServiceDays != null ? addDaysIso(today, v.nextServiceDays) : null,
      nextServiceDueKm: v.nextServiceKm,
      nickname: "nickname" in v ? v.nickname ?? null : null,
      createdAt: at(700),
    });
  };

  const insertFindings = async (vehicleId: string, inspectionId: string, list: SeedFinding[], createdAt: Date) => {
    await db.insert(findings).values(
      list.map((f, i) => ({
        id: id(f.key),
        workshopId,
        vehicleId,
        inspectionReportId: inspectionId,
        severity: f.severity,
        category: f.category,
        title: f.title,
        customerExplanation: f.customerExplanation,
        technicianNote: f.technicianNote ?? null,
        measurement: f.measurement ?? null,
        diagram: f.diagram ?? null,
        horizonText: f.horizonText ?? null,
        horizonKm: f.horizonKm ?? null,
        horizonDate: f.horizonDays != null ? addDaysIso(today, f.horizonDays) : null,
        estimateLowCents: f.low ?? null,
        estimateHighCents: f.high ?? null,
        safetyCritical: f.safetyCritical ?? f.severity === "URGENT_RED",
        status: f.status ?? "OPEN",
        source: "SEED",
        sortOrder: i,
        createdAt,
        updatedAt: createdAt,
      })),
    );
  };

  const insertServiceRecord = async (vehicleId: string, r: SeedVehicle["serviceRecords"][number]) => {
    const totals = totalsFromLineItems(r.lineItems);
    await db.insert(serviceRecords).values({
      id: id(r.key),
      workshopId,
      vehicleId,
      invoiceNumber: r.invoiceNumber,
      source: "MECHANICDESK_PDF",
      serviceDate: addDaysIso(today, -r.daysAgo),
      odometerKm: r.odometerKm,
      summary: r.summary,
      lineItems: r.lineItems,
      ...totals,
      technicianName: r.technician,
      advisorName: STAFF.advisor,
      verified: true,
      publishedAt: at(r.daysAgo, 16, 30),
      publishedBy: STAFF.advisor,
      paymentNote: r.paymentNote,
      createdAt: at(r.daysAgo, 16, 30),
    });
  };

  for (const v of HARTLEY_VEHICLES) {
    const vehicleId = id(v.key);
    await insertVehicle(v, householdId, id(v.primaryDriverKey));
    for (const r of v.serviceRecords) await insertServiceRecord(vehicleId, r);
    const inspId = id(v.inspection.key);
    await db.insert(inspectionReports).values({
      id: inspId,
      workshopId,
      vehicleId,
      serviceRecordId: v.inspection.serviceRecordKey ? id(v.inspection.serviceRecordKey) : null,
      inspectedAt: at(v.inspection.daysAgo, 11),
      odometerKm: v.inspection.odometerKm,
      technicianName: v.inspection.technician,
      summary: v.inspection.summary,
      createdAt: at(v.inspection.daysAgo, 11),
    });
    await insertFindings(vehicleId, inspId, v.findings, at(v.inspection.daysAgo, 11));
    const nev = lookupFixture(v.regoState, v.rego);
    if (nev) await db.insert(nevdisLookups).values({ workshopId, regoState: v.regoState, rego: v.rego, payload: { ...nev }, fetchedAt: at(700) });
  }

  // ── Supporting households ──
  for (const h of SUPPORT_HOUSEHOLDS) {
    const hhId = id(h.key);
    const custId = id(`${h.key}:customer`);
    await db.insert(households).values({ id: hhId, workshopId, name: h.name, createdAt: at(400) });
    await db.insert(customers).values({ id: custId, workshopId, householdId: hhId, firstName: h.firstName, lastName: h.lastName, mobile: h.mobile, role: "PRIMARY", createdAt: at(400) });
    await insertVehicle(h.vehicle, hhId, custId);
    const vehicleId = id(h.vehicle.key);
    const inspId = id(`${h.vehicle.key}:inspection`);
    await db.insert(inspectionReports).values({
      id: inspId,
      workshopId,
      vehicleId,
      inspectedAt: at(h.inspectionDaysAgo, 11),
      odometerKm: h.vehicle.odometerKm - Math.round(h.vehicle.avgKmPerDay * h.inspectionDaysAgo),
      technicianName: STAFF.techs[h.vehicle.odometerKm % 3],
      summary: "Logbook service and inspection.",
      createdAt: at(h.inspectionDaysAgo, 11),
    });
    await insertFindings(vehicleId, inspId, h.findings, at(h.inspectionDaysAgo, 11));
  }

  // ── Fixed quotes ──
  const insertQuote = async (q: typeof BRAKE_QUOTE | typeof LIFT_QUOTE | typeof TYRE_QUOTE_HISTORIC, extra: { status: "ISSUED" | "APPROVED"; modKey?: string; decidedDaysAgo?: number }) => {
    const totals = totalsFromLineItems(q.lineItems);
    await db.insert(fixedQuotes).values({
      id: id(q.key),
      workshopId,
      vehicleId: id(q.vehicleKey),
      quoteNumber: q.quoteNumber,
      title: q.title,
      findingIds: q.findingKeys.map(id),
      modQuoteRequestId: extra.modKey ? id(extra.modKey) : null,
      lineItems: q.lineItems,
      ...totals,
      validUntil: addDaysIso(today, q.validDays - q.issuedDaysAgo),
      status: extra.status,
      issuedBy: `${STAFF.advisor} (Service Advisor)`,
      issuedAt: at(q.issuedDaysAgo, 15),
      decidedAt: extra.decidedDaysAgo != null ? at(extra.decidedDaysAgo, 9, 40) : null,
      approvedLineIds: extra.status === "APPROVED" ? q.lineItems.map((l: LineItem) => l.id) : null,
      createdAt: at(q.issuedDaysAgo, 15),
    });
    return totals;
  };

  await db.insert(modQuoteRequests).values({
    id: id(LIFT_REQUEST.key),
    workshopId,
    vehicleId: id(LIFT_REQUEST.vehicleKey),
    customerId: id(LIFT_REQUEST.customerKey),
    modType: LIFT_REQUEST.modType,
    title: LIFT_REQUEST.title,
    description: LIFT_REQUEST.description,
    usage: LIFT_REQUEST.usage,
    budgetBand: LIFT_REQUEST.budgetBand,
    vinSnapshot: "MR0HA3CD100512345",
    variantSnapshot: "2021 Toyota HiLux SR5 4x4 Double Cab · 2.8 L turbo-diesel",
    status: LIFT_REQUEST.status,
    createdAt: at(LIFT_REQUEST.daysAgo, 19, 12),
  });

  const tyreTotals = await insertQuote(TYRE_QUOTE_HISTORIC, { status: "APPROVED", decidedDaysAgo: TYRE_QUOTE_HISTORIC.approvedDaysAgo });
  const brakeTotals = await insertQuote(BRAKE_QUOTE, { status: "ISSUED" });
  const liftTotals = await insertQuote(LIFT_QUOTE, { status: "ISSUED", modKey: LIFT_REQUEST.key });

  // ── Compliance vault (chronological, hash-chained) ──
  const quoteIssued = (q: typeof BRAKE_QUOTE | typeof LIFT_QUOTE | typeof TYRE_QUOTE_HISTORIC, totals: { totalCents: number; gstCents: number }) =>
    appendAuditEvent(db, {
      workshopId,
      eventType: "QUOTE_ISSUED",
      actorRole: "ADVISOR",
      vehicleId: id(q.vehicleKey),
      quoteId: id(q.key),
      findingId: q.findingKeys[0] ? id(q.findingKeys[0]) : null,
      signerName: STAFF.advisor,
      payload: { quoteNumber: q.quoteNumber, title: q.title, label: FIXED_QUOTE_LABEL, terms: FIXED_QUOTE_TERMS, lineItems: q.lineItems, ...totals },
      occurredAt: at(q.issuedDaysAgo, 15),
    });

  await quoteIssued(TYRE_QUOTE_HISTORIC, tyreTotals);
  await appendAuditEvent(db, {
    workshopId,
    eventType: "QUOTE_APPROVED",
    actorRole: "CUSTOMER",
    vehicleId: id(TYRE_QUOTE_HISTORIC.vehicleKey),
    quoteId: id(TYRE_QUOTE_HISTORIC.key),
    signerName: "Sam Hartley",
    signatureSvg: seededSignature("Sam Hartley"),
    payload: {
      quoteNumber: TYRE_QUOTE_HISTORIC.quoteNumber,
      approvedLineIds: TYRE_QUOTE_HISTORIC.lineItems.map((l) => l.id),
      approvedTotalCents: tyreTotals.totalCents,
      channel: "PWA",
      userAgent: "Mobile Safari (seed)",
    },
    occurredAt: at(TYRE_QUOTE_HISTORIC.approvedDaysAgo, 9, 40),
  });
  await appendAuditEvent(db, {
    workshopId,
    eventType: "UNSAFE_VEHICLE_REFUSAL",
    actorRole: "CUSTOMER",
    vehicleId: id(WALKER_REFUSAL.vehicleKey),
    findingId: id(WALKER_REFUSAL.findingKey),
    signerName: WALKER_REFUSAL.signerName,
    signatureSvg: seededSignature(WALKER_REFUSAL.signerName),
    acknowledgements: WALKER_REFUSAL.acknowledgements,
    payload: {
      findingTitle: "Front lower control arm bushes split",
      reason: WALKER_REFUSAL.reason,
      standard: "AAAA Unsafe Vehicle Release Acknowledgement (5-point)",
      estimateLabel: ACL_ESTIMATE_LABEL,
      channel: "Counter tablet",
    },
    occurredAt: at(WALKER_REFUSAL.daysAgo, 16, 5),
  });
  await quoteIssued(BRAKE_QUOTE, brakeTotals);
  await quoteIssued(LIFT_QUOTE, liftTotals);

  // ── Messages ──
  await db.insert(messages).values(
    HARTLEY_MESSAGES.map((m) => ({
      id: id(m.key),
      workshopId,
      vehicleId: id(m.vehicleKey),
      thread: m.thread,
      modQuoteRequestId: m.modKey ? id(m.modKey) : null,
      quoteId: m.quoteKey ? id(m.quoteKey) : null,
      authorRole: m.authorRole,
      authorName: m.authorName,
      body: m.body,
      channel: m.channel ?? "APP",
      createdAt: hoursAgo(m.hoursAgo),
    })),
  );

  // ── Triage inbox seeds ──
  const tb = TRIAGE_SEEDS.booking;
  await db.insert(bookings).values({
    id: id(tb.key),
    workshopId,
    vehicleId: id(tb.vehicleKey),
    customerId: id("household:papadopoulos:customer"),
    serviceType: tb.serviceType,
    findingIds: tb.findingKeys.map(id),
    requestedDate: addDaysIso(today, tb.inDays),
    dropOff: tb.dropOff,
    loanCar: tb.loanCar,
    notes: tb.notes,
    createdAt: hoursAgo(tb.hoursAgo),
  });
  const tm = TRIAGE_SEEDS.mod;
  await db.insert(modQuoteRequests).values({
    id: id(tm.key),
    workshopId,
    vehicleId: id(tm.vehicleKey),
    customerId: id("household:obrien:customer"),
    modType: tm.modType,
    title: tm.title,
    description: tm.description,
    usage: tm.usage,
    budgetBand: tm.budgetBand,
    vinSnapshot: "MPATFS86JHT012345",
    variantSnapshot: "2017 Isuzu D-Max SX 4x2 single cab",
    createdAt: hoursAgo(tm.hoursAgo),
  });
  await db.insert(messages).values({
    workshopId,
    vehicleId: id(tm.vehicleKey),
    thread: "MOD",
    modQuoteRequestId: id(tm.key),
    authorRole: "CUSTOMER",
    authorName: "Shane O'Brien",
    body: tm.description,
    createdAt: hoursAgo(tm.hoursAgo),
  });

  // ── Wallet passes + reminders for every vehicle ──
  const adapters = getAdapters({ db, workshopId });
  const allVehicleIds = [...HARTLEY_VEHICLES.map((v) => id(v.key)), ...SUPPORT_HOUSEHOLDS.map((h) => id(h.vehicle.key))];
  for (const vid of allVehicleIds) {
    await syncWalletPass(db, adapters, workshopRow, vid);
    await refreshVehicleReminders(db, workshopId, vid);
  }
  // Seeding isn't an adapter call history — start the Inspector clean.
  await db.execute(sql`TRUNCATE adapter_events`);
}
