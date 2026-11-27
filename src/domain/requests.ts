/** Customer requests (bookings, mod quotes, messages) and the counter's triage actions. */
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { bookings, customers, findings, households, messages, modQuoteRequests, vehicles, type Customer, type Vehicle } from "@/db/schema";
import { scoped } from "@/db/tenant";
import type { Svc } from "./context";
import { conflict, notFound, unprocessable } from "./errors";
import { addDaysIso, isoDate, now } from "./clock";
import { formatDate, formatShortDay } from "./format";
import { RECOVERABLE_STATUSES } from "./status";
import { syncWalletPass, garageUrl } from "./wallet";
import { shortHash } from "./ids";

async function loadVehicle(svc: Svc, vehicleId: string): Promise<Vehicle> {
  const [v] = await svc.db.select().from(vehicles).where(scoped(vehicles, svc.workshop.id, eq(vehicles.id, vehicleId)));
  if (!v) throw notFound("Vehicle");
  return v;
}

async function loadCustomer(svc: Svc, customerId: string | null | undefined): Promise<Customer | null> {
  if (!customerId) return null;
  const [c] = await svc.db.select().from(customers).where(scoped(customers, svc.workshop.id, eq(customers.id, customerId)));
  return c ?? null;
}

// ─── Booking request ───────────────────────────────────────────────────────

export const bookingSchema = z.object({
  vehicleId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  serviceType: z.enum(["LOGBOOK", "REPAIR", "LOGBOOK_AND_REPAIR"]),
  findingIds: z.array(z.string().uuid()).default([]),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dropOff: z.string().min(1).max(40),
  loanCar: z.boolean().default(false),
  notes: z.string().trim().max(600).optional(),
});

export async function createBooking(svc: Svc, input: z.infer<typeof bookingSchema>) {
  const v = await loadVehicle(svc, input.vehicleId);
  if (input.requestedDate < isoDate(now())) throw unprocessable("DATE_IN_PAST", "Pick a date from today onwards.");
  if (input.serviceType !== "LOGBOOK" && input.findingIds.length === 0)
    throw unprocessable("NO_ITEMS", "Tick at least one watch-list item, or choose a logbook service.");
  let ticked: { id: string; title: string }[] = [];
  if (input.findingIds.length) {
    ticked = await svc.db
      .select({ id: findings.id, title: findings.title })
      .from(findings)
      .where(scoped(findings, svc.workshop.id, eq(findings.vehicleId, v.id), inArray(findings.id, input.findingIds)));
    if (ticked.length !== input.findingIds.length) throw unprocessable("UNKNOWN_ITEMS", "Some ticked items don't belong to this vehicle.");
  }
  const customer = (await loadCustomer(svc, input.customerId)) ?? (await loadCustomer(svc, v.primaryDriverId));
  const [booking] = await svc.db
    .insert(bookings)
    .values({
      workshopId: svc.workshop.id,
      vehicleId: v.id,
      customerId: customer?.id ?? null,
      serviceType: input.serviceType,
      findingIds: input.findingIds,
      requestedDate: input.requestedDate,
      dropOff: input.dropOff,
      loanCar: input.loanCar,
      notes: input.notes ?? null,
    })
    .returning();
  if (input.findingIds.length)
    await svc.db
      .update(findings)
      .set({ status: "BOOKED", updatedAt: now() })
      .where(scoped(findings, svc.workshop.id, inArray(findings.id, input.findingIds), inArray(findings.status, [...RECOVERABLE_STATUSES])));
  const what = [input.serviceType !== "REPAIR" ? "logbook service" : null, ...ticked.map((t) => t.title.toLowerCase())].filter(Boolean).join(", ");
  await svc.db.insert(messages).values({
    workshopId: svc.workshop.id,
    vehicleId: v.id,
    authorRole: "SYSTEM",
    authorName: "MyGarage",
    body: `Booking requested for ${formatShortDay(input.requestedDate)} (${input.dropOff})${input.loanCar ? " with a loan car" : ""}: ${what}. The workshop will confirm.`,
  });
  if (customer)
    await svc.adapters.sms.send({
      to: customer.mobile,
      senderId: svc.workshop.smsSenderId,
      body: `${svc.workshop.name}: thanks ${customer.firstName}, we've got your booking request for ${v.rego} on ${formatDate(input.requestedDate)}. We'll confirm shortly.`,
      tag: "booking-ack",
    });
  await syncWalletPass(svc.db, svc.adapters, svc.workshop, v.id);
  return booking;
}

// ─── Modification quote request ────────────────────────────────────────────

export const MOD_TYPES = {
  SUSPENSION_LIFT: "Suspension lift",
  BULLBAR_LIGHTS: "Bullbar & lighting",
  EXHAUST: "Exhaust upgrade",
  BRAKE_UPGRADE: "Brake upgrade",
  DUAL_BATTERY: "Dual battery system",
  TOWING: "Towbar & brake controller",
  WHEELS_TYRES: "Wheels & tyres",
  OTHER: "Something else",
} as const;

export const modQuoteSchema = z.object({
  vehicleId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  modType: z.enum(Object.keys(MOD_TYPES) as [keyof typeof MOD_TYPES, ...(keyof typeof MOD_TYPES)[]]),
  description: z.string().trim().min(10, "Tell us a bit more (at least 10 characters).").max(1500),
  usage: z.string().trim().max(200).optional(),
  budgetBand: z.string().trim().max(60).optional(),
  productLink: z.string().trim().url().max(500).optional().or(z.literal("")),
  photos: z
    .array(z.object({ contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().max(3_000_000) }))
    .max(4)
    .default([]),
});

export async function createModQuoteRequest(svc: Svc, input: z.infer<typeof modQuoteSchema>) {
  const v = await loadVehicle(svc, input.vehicleId);
  const customer = (await loadCustomer(svc, input.customerId)) ?? (await loadCustomer(svc, v.primaryDriverId));
  const photoKeys: string[] = [];
  for (const p of input.photos) {
    const obj = await svc.adapters.media.put({ workshopId: svc.workshop.id, kind: "PHOTO", contentType: p.contentType, bytes: new Uint8Array(Buffer.from(p.base64, "base64")), vehicleId: v.id });
    photoKeys.push(obj.key);
  }
  const title = MOD_TYPES[input.modType];
  const [req] = await svc.db
    .insert(modQuoteRequests)
    .values({
      workshopId: svc.workshop.id,
      vehicleId: v.id,
      customerId: customer?.id ?? null,
      modType: input.modType,
      title,
      description: input.description,
      usage: input.usage ?? null,
      budgetBand: input.budgetBand ?? null,
      productLink: input.productLink || null,
      vinSnapshot: v.vin,
      variantSnapshot: `${v.year} ${v.make} ${v.model} ${v.variant} · ${v.engine}`,
      photoKeys,
    })
    .returning();
  await svc.db.insert(messages).values({
    workshopId: svc.workshop.id,
    vehicleId: v.id,
    thread: "MOD",
    modQuoteRequestId: req.id,
    authorRole: "CUSTOMER",
    authorName: customer ? `${customer.firstName} ${customer.lastName}` : "Customer",
    body: input.description,
  });
  return req;
}

// ─── Messaging ─────────────────────────────────────────────────────────────

export const messageSchema = z.object({
  vehicleId: z.string().uuid(),
  thread: z.enum(["VEHICLE", "MOD"]).default("VEHICLE"),
  modQuoteRequestId: z.string().uuid().optional(),
  authorRole: z.enum(["CUSTOMER", "ADVISOR", "TECH"]),
  authorName: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1, "Write a message first.").max(1500),
});

export async function postMessage(svc: Svc, input: z.infer<typeof messageSchema>) {
  const v = await loadVehicle(svc, input.vehicleId);
  if (input.thread === "MOD") {
    if (!input.modQuoteRequestId) throw unprocessable("THREAD_REQUIRED", "Pick a quote thread.");
    const [r] = await svc.db.select({ id: modQuoteRequests.id }).from(modQuoteRequests).where(scoped(modQuoteRequests, svc.workshop.id, eq(modQuoteRequests.id, input.modQuoteRequestId), eq(modQuoteRequests.vehicleId, v.id)));
    if (!r) throw notFound("Quote thread");
  }
  const [msg] = await svc.db
    .insert(messages)
    .values({ workshopId: svc.workshop.id, vehicleId: v.id, thread: input.thread, modQuoteRequestId: input.modQuoteRequestId ?? null, authorRole: input.authorRole, authorName: input.authorName, body: input.body })
    .returning();
  if (input.authorRole !== "CUSTOMER") {
    const driver = await loadCustomer(svc, v.primaryDriverId);
    if (driver)
      await svc.adapters.sms.send({
        to: driver.mobile,
        senderId: svc.workshop.smsSenderId,
        body: `${svc.workshop.name}: new message about your ${v.make} ${v.model} (${v.rego}). Read it in your garage: ${garageUrl(v.id)}`,
        tag: "message-alert",
      });
  }
  return msg;
}

// ─── Triage (counter) ──────────────────────────────────────────────────────

export const triageSchema = z.object({
  kind: z.enum(["booking", "mod"]),
  id: z.string().uuid(),
  action: z.enum(["confirm", "triage", "close"]),
  reply: z.string().trim().max(1000).optional(),
  advisorName: z.string().trim().max(80).default("Kirsty Brennan"),
});

export async function triageAction(svc: Svc, input: z.infer<typeof triageSchema>) {
  if (input.kind === "booking") {
    const [b] = await svc.db.select().from(bookings).where(scoped(bookings, svc.workshop.id, eq(bookings.id, input.id)));
    if (!b) throw notFound("Booking");
    const status = input.action === "close" ? "DECLINED" : "CONFIRMED";
    await svc.db.update(bookings).set({ status }).where(scoped(bookings, svc.workshop.id, eq(bookings.id, b.id)));
    const body = input.reply || (status === "CONFIRMED" ? `You're booked in for ${formatShortDay(b.requestedDate)}, drop off ${b.dropOff}.${b.loanCar ? " A loan car will be ready." : ""}` : "We can't fit that date — reply here and we'll find another.");
    await postMessage(svc, { vehicleId: b.vehicleId, thread: "VEHICLE", authorRole: "ADVISOR", authorName: input.advisorName, body });
    return { status };
  }
  const [r] = await svc.db.select().from(modQuoteRequests).where(scoped(modQuoteRequests, svc.workshop.id, eq(modQuoteRequests.id, input.id)));
  if (!r) throw notFound("Mod quote request");
  if (r.status === "CLOSED") throw conflict("This request is closed.");
  const status = input.action === "close" ? "CLOSED" : r.status === "QUOTED" ? "QUOTED" : "TRIAGED";
  await svc.db.update(modQuoteRequests).set({ status }).where(scoped(modQuoteRequests, svc.workshop.id, eq(modQuoteRequests.id, r.id)));
  if (input.reply) await postMessage(svc, { vehicleId: r.vehicleId, thread: "MOD", modQuoteRequestId: r.id, authorRole: "ADVISOR", authorName: input.advisorName, body: input.reply });
  return { status };
}

export async function getTriageInbox(svc: Svc) {
  const [books, mods] = await Promise.all([
    svc.db
      .select({ booking: bookings, vehicle: vehicles, customer: customers })
      .from(bookings)
      .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
      .leftJoin(customers, eq(customers.id, bookings.customerId))
      .where(scoped(bookings, svc.workshop.id))
      .orderBy(desc(bookings.createdAt)),
    svc.db
      .select({ request: modQuoteRequests, vehicle: vehicles, customer: customers })
      .from(modQuoteRequests)
      .innerJoin(vehicles, eq(vehicles.id, modQuoteRequests.vehicleId))
      .leftJoin(customers, eq(customers.id, modQuoteRequests.customerId))
      .where(scoped(modQuoteRequests, svc.workshop.id))
      .orderBy(desc(modQuoteRequests.createdAt)),
  ]);
  const quoteRequests = await svc.db
    .select({ finding: findings, vehicle: vehicles })
    .from(findings)
    .innerJoin(vehicles, eq(vehicles.id, findings.vehicleId))
    .where(scoped(findings, svc.workshop.id, eq(findings.status, "QUOTE_REQUESTED")))
    .orderBy(desc(findings.updatedAt));
  const findingTitles = new Map<string, string>();
  const allIds = books.flatMap((b) => b.booking.findingIds);
  if (allIds.length) {
    const rows = await svc.db.select({ id: findings.id, title: findings.title }).from(findings).where(scoped(findings, svc.workshop.id, inArray(findings.id, allIds)));
    rows.forEach((r) => findingTitles.set(r.id, r.title));
  }
  return {
    bookings: books.map((b) => ({ ...b, items: b.booking.findingIds.map((id) => findingTitles.get(id) ?? "Item") })),
    mods,
    quoteRequests,
  };
}

// ─── SMS magic link (Stage 1 simulation) ───────────────────────────────────

export async function sendMagicLink(svc: Svc, input: { householdId: string; vehicleId?: string }) {
  const [hh] = await svc.db.select().from(households).where(scoped(households, svc.workshop.id, eq(households.id, input.householdId)));
  if (!hh) throw notFound("Household");
  const [primary] = await svc.db
    .select()
    .from(customers)
    .where(and(eq(customers.workshopId, svc.workshop.id), eq(customers.householdId, hh.id), eq(customers.role, "PRIMARY")));
  if (!primary) throw notFound("Primary contact");
  const issuedAt = now();
  const token = shortHash(`${hh.id}|${issuedAt.toISOString().slice(0, 16)}`, 24);
  const link = `${process.env.PUBLIC_BASE_URL || "http://localhost:3000"}/?v=${input.vehicleId ?? ""}&t=${token}`;
  const body = `${svc.workshop.name}: hi ${primary.firstName}, your vehicle report is ready. View your garage (no password needed): ${link}`;
  const sms = await svc.adapters.sms.send({ to: primary.mobile, senderId: svc.workshop.smsSenderId, body, tag: "magic-link" });
  return { to: primary.mobile, firstName: primary.firstName, body, link, token, expiresAt: new Date(issuedAt.getTime() + 15 * 60_000).toISOString(), sms, nextServiceHint: addDaysIso(isoDate(issuedAt), 0) };
}
