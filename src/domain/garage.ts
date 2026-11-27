/** Read models for the Customer Living Garage. */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { DbLike } from "@/db/client";
import {
  bookings,
  customers,
  findings,
  fixedQuotes,
  inspectionReports,
  messages,
  modQuoteRequests,
  payments,
  quotesAndApprovals,
  serviceRecords,
  vehicles,
  walletPasses,
  type AuditEvent,
  type Booking,
  type Customer,
  type Finding,
  type FixedQuote,
  type InspectionReport,
  type Message,
  type ModQuoteRequest,
  type Payment,
  type ServiceRecord,
  type Severity,
  type Vehicle,
  type WalletPass,
} from "@/db/schema";
import { scoped } from "@/db/tenant";
import { daysUntil, now } from "./clock";
import { OUTSTANDING_STATUSES, SEVERITY_RANK, worstSeverity } from "./status";
import { serviceTrigger, type ServiceTrigger } from "./reminders";

export interface VehicleCard {
  vehicle: Vehicle;
  health: Severity;
  red: number;
  amber: number;
  green: number;
  nextServiceDays: number | null;
  regoExpiryDays: number;
  trigger: ServiceTrigger;
}

export type FindingView = Finding & { quote: FixedQuote | null };

export interface ModThread {
  request: ModQuoteRequest;
  messages: Message[];
  quote: FixedQuote | null;
}

export interface VehicleDetail {
  card: VehicleCard;
  driver: Customer | null;
  red: FindingView[];
  amber: FindingView[];
  green: FindingView[];
  closed: FindingView[];
  quotes: FixedQuote[];
  serviceRecords: ServiceRecord[];
  latestInspection: InspectionReport | null;
  vehicleThread: Message[];
  modThreads: ModThread[];
  bookings: Booking[];
  walletPass: WalletPass | null;
  payments: Payment[];
  auditEvents: AuditEvent[];
}

function card(vehicle: Vehicle, fs: Pick<Finding, "severity" | "status" | "reviewStatus">[], greenCount: number): VehicleCard {
  const open = fs.filter((f) => f.reviewStatus === "PUBLISHED" && f.severity !== "HEALTHY_GREEN" && OUTSTANDING_STATUSES.includes(f.status));
  const red = open.filter((f) => f.severity === "URGENT_RED").length;
  const amber = open.length - red;
  return {
    vehicle,
    health: worstSeverity(open.map((f) => f.severity)),
    red,
    amber,
    green: greenCount,
    nextServiceDays: vehicle.nextServiceDueDate ? daysUntil(vehicle.nextServiceDueDate, now()) : null,
    regoExpiryDays: daysUntil(vehicle.regoExpiry, now()),
    trigger: serviceTrigger(vehicle),
  };
}

export async function getHouseholdGarage(db: DbLike, workshopId: string, householdId: string) {
  const people = await db.select().from(customers).where(scoped(customers, workshopId, eq(customers.householdId, householdId))).orderBy(asc(customers.createdAt), asc(customers.firstName));
  const cars = await db.select().from(vehicles).where(scoped(vehicles, workshopId, eq(vehicles.householdId, householdId))).orderBy(asc(vehicles.createdAt), desc(vehicles.year));
  const ids = cars.map((c) => c.id);
  const fs = ids.length ? await db.select().from(findings).where(scoped(findings, workshopId, inArray(findings.vehicleId, ids))) : [];
  const cards = cars.map((v) => {
    const mine = fs.filter((f) => f.vehicleId === v.id);
    const green = mine.filter((f) => f.severity === "HEALTHY_GREEN" && f.status === "OPEN" && f.reviewStatus === "PUBLISHED").length;
    return card(v, mine, green);
  });
  return { customers: people, vehicles: cards };
}

export async function getVehicleDetail(db: DbLike, workshopId: string, vehicleId: string): Promise<VehicleDetail | null> {
  const [vehicle] = await db.select().from(vehicles).where(scoped(vehicles, workshopId, eq(vehicles.id, vehicleId)));
  if (!vehicle) return null;
  const [fs, quotes, records, inspections, msgs, mods, books, passRows, pays, audit] = await Promise.all([
    db.select().from(findings).where(scoped(findings, workshopId, eq(findings.vehicleId, vehicleId))).orderBy(asc(findings.sortOrder), asc(findings.createdAt)),
    db.select().from(fixedQuotes).where(scoped(fixedQuotes, workshopId, eq(fixedQuotes.vehicleId, vehicleId))).orderBy(desc(fixedQuotes.issuedAt)),
    db.select().from(serviceRecords).where(scoped(serviceRecords, workshopId, eq(serviceRecords.vehicleId, vehicleId))).orderBy(desc(serviceRecords.serviceDate)),
    db.select().from(inspectionReports).where(scoped(inspectionReports, workshopId, eq(inspectionReports.vehicleId, vehicleId))).orderBy(desc(inspectionReports.inspectedAt)),
    db.select().from(messages).where(scoped(messages, workshopId, eq(messages.vehicleId, vehicleId))).orderBy(asc(messages.createdAt)),
    db.select().from(modQuoteRequests).where(scoped(modQuoteRequests, workshopId, eq(modQuoteRequests.vehicleId, vehicleId))).orderBy(desc(modQuoteRequests.createdAt)),
    db.select().from(bookings).where(scoped(bookings, workshopId, eq(bookings.vehicleId, vehicleId))).orderBy(desc(bookings.createdAt)),
    db.select().from(walletPasses).where(scoped(walletPasses, workshopId, eq(walletPasses.vehicleId, vehicleId))),
    db.select().from(payments).where(scoped(payments, workshopId, eq(payments.vehicleId, vehicleId))).orderBy(desc(payments.createdAt)),
    db.select().from(quotesAndApprovals).where(and(eq(quotesAndApprovals.workshopId, workshopId), eq(quotesAndApprovals.vehicleId, vehicleId))).orderBy(desc(quotesAndApprovals.seq)),
  ]);
  const driver = vehicle.primaryDriverId
    ? ((await db.select().from(customers).where(scoped(customers, workshopId, eq(customers.id, vehicle.primaryDriverId))))[0] ?? null)
    : null;

  const quoteFor = (f: Finding) =>
    quotes.find((q) => q.findingIds.includes(f.id) && (q.status === "ISSUED" || q.status === "APPROVED")) ??
    quotes.find((q) => q.findingIds.includes(f.id)) ??
    null;
  const published = fs.filter((f) => f.reviewStatus === "PUBLISHED").map((f) => ({ ...f, quote: quoteFor(f) }));
  const outstanding = published.filter((f) => OUTSTANDING_STATUSES.includes(f.status));
  const bySeverity = (s: Severity) => outstanding.filter((f) => f.severity === s);
  const green = published.filter((f) => f.severity === "HEALTHY_GREEN" && f.status === "OPEN");
  const closed = published.filter((f) => f.severity !== "HEALTHY_GREEN" && !OUTSTANDING_STATUSES.includes(f.status));
  const greenCount = green.length;

  return {
    card: card(vehicle, fs, greenCount),
    driver,
    red: bySeverity("URGENT_RED"),
    amber: bySeverity("WATCH_AMBER").sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
    green,
    closed,
    quotes,
    serviceRecords: records,
    latestInspection: inspections[0] ?? null,
    vehicleThread: msgs.filter((m) => m.thread === "VEHICLE"),
    modThreads: mods.map((r) => ({
      request: r,
      messages: msgs.filter((m) => m.modQuoteRequestId === r.id),
      quote: quotes.find((q) => q.modQuoteRequestId === r.id) ?? null,
    })),
    bookings: books,
    walletPass: passRows[0] ?? null,
    payments: pays,
    auditEvents: audit,
  };
}
