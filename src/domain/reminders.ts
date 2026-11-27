/**
 * Multi-trigger reminders (research §3): whichever arrives first of the workshop's next-service
 * date, the km threshold interpolated from the vehicle's real daily distance, rego expiry, or the
 * customer's own "plan for later" timer. Wallet push first, SMS as fallback.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { DbLike } from "@/db/client";
import { findings, reminders, vehicles, type Vehicle } from "@/db/schema";
import { addDaysIso, isoDate, now } from "./clock";
import { formatDate, formatKm } from "./format";

export interface ServiceTrigger {
  dateDue: string | null;
  kmDue: number | null;
  kmProjectedDate: string | null;
  first: { by: "DATE" | "KM"; date: string } | null;
}

export function serviceTrigger(v: Pick<Vehicle, "nextServiceDueDate" | "nextServiceDueKm" | "odometerKm" | "odometerAt" | "avgKmPerDay">): ServiceTrigger {
  let kmProjectedDate: string | null = null;
  if (v.nextServiceDueKm != null && v.avgKmPerDay > 0) {
    const daysToKm = Math.max(0, Math.round((v.nextServiceDueKm - v.odometerKm) / v.avgKmPerDay));
    kmProjectedDate = addDaysIso(isoDate(v.odometerAt), daysToKm);
  }
  const candidates: { by: "DATE" | "KM"; date: string }[] = [];
  if (v.nextServiceDueDate) candidates.push({ by: "DATE", date: v.nextServiceDueDate });
  if (kmProjectedDate) candidates.push({ by: "KM", date: kmProjectedDate });
  candidates.sort((a, b) => a.date.localeCompare(b.date));
  return { dateDue: v.nextServiceDueDate, kmDue: v.nextServiceDueKm, kmProjectedDate, first: candidates[0] ?? null };
}

export function remindAtForHorizon(horizon: "1M" | "3M" | "NEXT_SERVICE", v: Parameters<typeof serviceTrigger>[0], from: Date = now()): Date {
  const today = isoDate(from);
  if (horizon === "1M") return new Date(`${addDaysIso(today, 30)}T01:00:00Z`);
  if (horizon === "3M") return new Date(`${addDaysIso(today, 91)}T01:00:00Z`);
  const t = serviceTrigger(v).first;
  return new Date(`${addDaysIso(t?.date ?? addDaysIso(today, 120), -7)}T01:00:00Z`);
}

/** Rebuild scheduled (non-campaign) reminders for a vehicle. */
export async function refreshVehicleReminders(db: DbLike, workshopId: string, vehicleId: string) {
  const [v] = await db.select().from(vehicles).where(and(eq(vehicles.workshopId, workshopId), eq(vehicles.id, vehicleId)));
  if (!v) return;
  await db
    .delete(reminders)
    .where(and(eq(reminders.workshopId, workshopId), eq(reminders.vehicleId, vehicleId), eq(reminders.status, "SCHEDULED"), inArray(reminders.kind, ["SERVICE_DUE", "SERVICE_KM", "REGO_EXPIRY", "WATCH_ITEM"])));
  const rows: (typeof reminders.$inferInsert)[] = [];
  const t = serviceTrigger(v);
  const name = `${v.make} ${v.model}`;
  if (t.first) {
    const when = new Date(`${addDaysIso(t.first.date, -7)}T01:00:00Z`);
    const msg =
      t.first.by === "KM"
        ? `Your ${name} is due for a service at ${formatKm(t.kmDue ?? 0)} — at your usual driving that's around ${formatDate(t.first.date)}.`
        : `Your ${name} is due for a service on ${formatDate(t.first.date)}.`;
    rows.push({ workshopId, vehicleId, customerId: v.primaryDriverId, kind: t.first.by === "KM" ? "SERVICE_KM" : "SERVICE_DUE", channel: "WALLET_PUSH", scheduledFor: when, message: msg });
  }
  rows.push({
    workshopId,
    vehicleId,
    customerId: v.primaryDriverId,
    kind: "REGO_EXPIRY",
    channel: "SMS",
    scheduledFor: new Date(`${addDaysIso(v.regoExpiry, -14)}T01:00:00Z`),
    message: `${v.regoState} rego for ${v.rego} expires on ${formatDate(v.regoExpiry)}.`,
  });
  const planned = await db
    .select()
    .from(findings)
    .where(and(eq(findings.workshopId, workshopId), eq(findings.vehicleId, vehicleId), eq(findings.status, "PLANNED")));
  for (const f of planned) {
    if (!f.plannedRemindAt) continue;
    rows.push({ workshopId, vehicleId, findingId: f.id, customerId: v.primaryDriverId, kind: "WATCH_ITEM", channel: "WALLET_PUSH", scheduledFor: f.plannedRemindAt, message: `Reminder: ${f.title} on your ${name}.` });
  }
  if (rows.length) await db.insert(reminders).values(rows);
}
