import { appContext } from "@/lib/server";
import { getHouseholdGarage, getVehicleDetail } from "@/domain/garage";
import { licenceLabel } from "@/domain/compliance";
import { addDaysIso, isoDate, now } from "@/domain/clock";
import type { ServiceStickerPass } from "@/adapters/contracts";
import { households } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GarageView } from "./GarageView";
import { qrSvg } from "@/lib/qr";
import { garageUrl } from "@/domain/wallet";
import type { GarageData } from "./types";

/** Server loader for the Living Garage. Runs at request time (inside Suspense). */
export async function GarageScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await appContext();
  const garage = await getHouseholdGarage(ctx.db, ctx.workshop.id, ctx.householdId);
  const requested = typeof sp.v === "string" ? sp.v : undefined;
  const selected = garage.vehicles.find((c) => c.vehicle.id === requested)?.vehicle.id ?? garage.vehicles[0]?.vehicle.id;
  const detail = selected ? await getVehicleDetail(ctx.db, ctx.workshop.id, selected) : null;
  if (!detail) return <p className="p-6">No vehicles in this garage yet.</p>;
  const [hh] = await ctx.db.select().from(households).where(eq(households.id, ctx.householdId));
  const today = isoDate(now());
  const bookingDays: string[] = [];
  for (let i = 1; bookingDays.length < 10 && i < 20; i++) {
    const d = addDaysIso(today, i);
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow !== 0) bookingDays.push(d);
  }
  const w = ctx.workshop;
  const pass = (detail.walletPass?.payload as { sticker?: ServiceStickerPass } | undefined)?.sticker ?? null;
  const data: GarageData = {
    workshop: {
      name: w.name,
      phone: w.phone,
      email: w.email,
      hoursText: w.hoursText,
      brandPrimary: w.brandPrimary,
      brandAccent: w.brandAccent,
      licenceState: w.licenceState,
      licenceType: w.licenceType,
      licenceNumber: w.licenceNumber,
      addressLine: w.addressLine,
      suburb: w.suburb,
      state: w.state,
      postcode: w.postcode,
      paytoEnabled: w.paytoEnabled,
      cardEnabled: w.cardEnabled,
      bnplEnabled: w.bnplEnabled,
      bnplMinCents: w.bnplMinCents,
      smsSenderId: w.smsSenderId,
      wms: w.wms,
    },
    licence: licenceLabel(w),
    householdName: hh?.name ?? "Your household",
    people: garage.customers.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, role: c.role })),
    cards: garage.vehicles,
    detail,
    today,
    bookingDays,
    pass,
    qr: await qrSvg(garageUrl(detail.card.vehicle.id)),
    passVersion: detail.walletPass?.version ?? 0,
    passUpdatedAt: detail.walletPass?.updatedAt ? detail.walletPass.updatedAt.toISOString() : null,
    lastPush: detail.walletPass?.lastPushAt && detail.walletPass.lastPushMessage ? { at: detail.walletPass.lastPushAt.toISOString(), message: detail.walletPass.lastPushMessage } : null,
    paidQuoteIds: detail.payments.filter((p) => p.status === "SUCCEEDED" && p.quoteId).map((p) => p.quoteId!),
  };
  return <GarageView data={data} />;
}
