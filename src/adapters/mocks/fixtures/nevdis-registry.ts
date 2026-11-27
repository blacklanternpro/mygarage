/** Mock NEVDIS register (what BlueFlag/InfoAgent would return). Derived from the demo world. */
import { HARTLEY_VEHICLES, SUPPORT_HOUSEHOLDS } from "@/db/seed-data";
import type { NevdisVehicle } from "../../contracts";
import { addDaysIso, isoDate, now } from "@/domain/clock";
import { regoKey } from "@/domain/format";

export function nevdisRegistry(): Record<string, Omit<NevdisVehicle, "regoExpiry"> & { regoExpiryDays: number }> {
  const all = [...HARTLEY_VEHICLES, ...SUPPORT_HOUSEHOLDS.map((h) => h.vehicle)];
  const out: Record<string, Omit<NevdisVehicle, "regoExpiry"> & { regoExpiryDays: number }> = {};
  for (const v of all) {
    out[`${v.regoState}:${regoKey(v.rego)}`] = {
      rego: v.rego,
      state: v.regoState,
      vin: v.vin,
      make: v.make,
      model: v.model,
      variant: v.variant,
      year: v.year,
      colour: v.colour,
      bodyType: v.bodyType,
      engine: v.engine,
      regoExpiryDays: v.regoExpiryDays,
      stolen: false,
      writtenOff: false,
    };
  }
  return out;
}

export function lookupFixture(state: string, rego: string): NevdisVehicle | null {
  const hit = nevdisRegistry()[`${state.toUpperCase()}:${regoKey(rego)}`];
  if (!hit) return null;
  const { regoExpiryDays, ...rest } = hit;
  return { ...rest, regoExpiry: addDaysIso(isoDate(now()), regoExpiryDays) };
}
