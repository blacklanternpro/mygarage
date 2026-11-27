/**
 * Apple/Google Wallet "Digital Service Sticker". The payload is derived purely from DB state, so
 * its hash only changes when something the customer would see changes — that bumps the pass
 * version and (optionally) triggers a lock-screen push through the WalletPassAdapter.
 */
import { and, eq, inArray, ne } from "drizzle-orm";
import type { DbLike } from "@/db/client";
import { findings, vehicles, walletPasses, type Vehicle, type WalletPass, type Workshop } from "@/db/schema";
import type { Adapters, ServiceStickerPass } from "@/adapters/contracts";
import { canonicalJson, sha256, shortHash } from "./ids";
import { formatDate, formatKm } from "./format";
import { licenceLabel } from "./compliance";
import { OUTSTANDING_STATUSES } from "./status";
import { serviceTrigger } from "./reminders";

export function passSerial(vehicleId: string): string {
  return `MG-${shortHash(vehicleId, 10).toUpperCase()}`;
}

export function garageUrl(vehicleId: string): string {
  const base = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
  return `${base}/?v=${vehicleId}`;
}

export async function watchListCounts(db: DbLike, workshopId: string, vehicleId: string) {
  const rows = await db
    .select({ severity: findings.severity })
    .from(findings)
    .where(
      and(
        eq(findings.workshopId, workshopId),
        eq(findings.vehicleId, vehicleId),
        eq(findings.reviewStatus, "PUBLISHED"),
        ne(findings.severity, "HEALTHY_GREEN"),
        inArray(findings.status, OUTSTANDING_STATUSES),
      ),
    );
  const red = rows.filter((r) => r.severity === "URGENT_RED").length;
  return { total: rows.length, red, amber: rows.length - red };
}

export function buildStickerPass(
  workshop: Workshop,
  v: Vehicle,
  counts: { total: number; red: number; amber: number },
): ServiceStickerPass {
  const t = serviceTrigger(v);
  const nextService =
    v.nextServiceDueDate && v.nextServiceDueKm
      ? `${formatDate(v.nextServiceDueDate)} or ${formatKm(v.nextServiceDueKm)}`
      : v.nextServiceDueDate
        ? formatDate(v.nextServiceDueDate)
        : "Ask the workshop";
  const watch =
    counts.total === 0 ? "All clear" : counts.red ? `${counts.total} open (${counts.red} urgent)` : `${counts.total} to watch`;
  return {
    serialNumber: passSerial(v.id),
    organizationName: workshop.name,
    description: `${v.year} ${v.make} ${v.model} service sticker`,
    logoText: workshop.name,
    brandColour: workshop.brandPrimary,
    primary: [{ key: "rego", label: `${v.make} ${v.model}`, value: `${v.rego} · ${v.regoState}` }],
    secondary: [{ key: "nextService", label: "Next service due", value: nextService }],
    auxiliary: [
      { key: "watch", label: "Open watch-list", value: watch },
      { key: "regoExpiry", label: "Rego expires", value: formatDate(v.regoExpiry) },
    ],
    back: [
      { key: "licence", label: "Licensed repairer", value: `${workshop.name} — ${licenceLabel(workshop)}` },
      { key: "phone", label: "Bookings", value: workshop.phone },
      { key: "hours", label: "Hours", value: workshop.hoursText },
      { key: "vehicle", label: "Vehicle", value: `${v.year} ${v.make} ${v.model} ${v.variant}` },
      { key: "odometer", label: "Last recorded odometer", value: formatKm(v.odometerKm) },
      ...(t.first?.by === "KM" && t.kmProjectedDate
        ? [{ key: "projected", label: "Projected service date", value: `Around ${formatDate(t.kmProjectedDate)} at your usual driving` }]
        : []),
      { key: "garage", label: "Your garage", value: garageUrl(v.id) },
      { key: "estimates", label: "About estimates", value: "Prices on your watch-list are non-binding indicative estimates only, subject to re-inspection and parts pricing." },
    ],
    barcodeMessage: garageUrl(v.id),
    relevantDate: t.first ? `${t.first.date}T08:00:00+08:00` : undefined,
  };
}

export interface SyncResult {
  pass: WalletPass;
  changed: boolean;
  pushed: boolean;
}

/** Recompute the pass; bump version + push when the visible content changed. */
export async function syncWalletPass(
  db: DbLike,
  adapters: Adapters,
  workshop: Workshop,
  vehicleId: string,
  opts: { pushMessage?: string | null } = {},
): Promise<SyncResult> {
  const [v] = await db.select().from(vehicles).where(and(eq(vehicles.workshopId, workshop.id), eq(vehicles.id, vehicleId)));
  if (!v) throw new Error("Vehicle not found for wallet sync");
  const sticker = buildStickerPass(workshop, v, await watchListCounts(db, workshop.id, vehicleId));
  const issued = await adapters.wallet.issue(sticker);
  const payload = { sticker, apple: issued.applePassJson, google: issued.googleObject, signature: issued.signature };
  const payloadHash = sha256(canonicalJson(sticker));
  const [existing] = await db.select().from(walletPasses).where(eq(walletPasses.vehicleId, vehicleId));
  if (!existing) {
    const [pass] = await db
      .insert(walletPasses)
      .values({ workshopId: workshop.id, vehicleId, serialNumber: sticker.serialNumber, passTypeIdentifier: String(issued.applePassJson.passTypeIdentifier), version: 1, payload, payloadHash })
      .returning();
    return { pass, changed: true, pushed: false };
  }
  if (existing.payloadHash === payloadHash) return { pass: existing, changed: false, pushed: false };
  let pushed = false;
  let lastPushAt = existing.lastPushAt;
  let lastPushMessage = existing.lastPushMessage;
  if (opts.pushMessage) {
    await adapters.wallet.pushUpdate({ serialNumber: sticker.serialNumber, message: opts.pushMessage });
    pushed = true;
    lastPushAt = new Date();
    lastPushMessage = opts.pushMessage;
  }
  const [pass] = await db
    .update(walletPasses)
    .set({ payload, payloadHash, version: existing.version + 1, updatedAt: new Date(), lastPushAt, lastPushMessage })
    .where(eq(walletPasses.id, existing.id))
    .returning();
  return { pass, changed: true, pushed };
}

/** Explicit "simulate lock-screen push" from the demo. */
export async function simulatePush(db: DbLike, adapters: Adapters, workshop: Workshop, vehicleId: string, message: string) {
  const [pass] = await db.select().from(walletPasses).where(and(eq(walletPasses.workshopId, workshop.id), eq(walletPasses.vehicleId, vehicleId)));
  if (!pass) throw new Error("No wallet pass for vehicle");
  const result = await adapters.wallet.pushUpdate({ serialNumber: pass.serialNumber, message });
  const [updated] = await db.update(walletPasses).set({ lastPushAt: new Date(), lastPushMessage: message }).where(eq(walletPasses.id, pass.id)).returning();
  return { pass: updated, result };
}
