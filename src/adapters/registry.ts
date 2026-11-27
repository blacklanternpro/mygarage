/**
 * The ONLY place that decides which implementation backs each port.
 * Env flags: ADAPTER_<PORT>=mock|live (default mock). See .env.example.
 */
import type { DbLike } from "@/db/client";
import type { AdapterInfo, Adapters, PortName } from "./contracts";
import { MockIngestionAdapter } from "./mocks/ingestion";
import {
  MockMediaStorageAdapter,
  MockNevdisAdapter,
  MockPaymentAdapter,
  MockSmsAdapter,
  MockVoiceSttAdapter,
  MockWalletPassAdapter,
} from "./mocks/others";
import { liveAdapters } from "./live/stubs";

export const PORT_NAMES: PortName[] = ["ingestion", "nevdis", "sms", "wallet", "stt", "media", "payment"];

export function requestedMode(port: PortName): "mock" | "live" {
  const v = (process.env[`ADAPTER_${port.toUpperCase()}`] || "mock").trim().toLowerCase();
  return v === "live" ? "live" : "mock";
}

export function getAdapters(ctx: { db: DbLike; workshopId: string | null }): Adapters {
  const live = liveAdapters();
  const mocks: Adapters = {
    ingestion: new MockIngestionAdapter(ctx),
    nevdis: new MockNevdisAdapter(ctx),
    sms: new MockSmsAdapter(ctx),
    wallet: new MockWalletPassAdapter(ctx),
    stt: new MockVoiceSttAdapter(ctx),
    media: new MockMediaStorageAdapter(ctx),
    payment: new MockPaymentAdapter(ctx),
  };
  const pick = <K extends PortName>(port: K): Adapters[K] => (requestedMode(port) === "live" ? live[port] : mocks[port]);
  return {
    ingestion: pick("ingestion"),
    nevdis: pick("nevdis"),
    sms: pick("sms"),
    wallet: pick("wallet"),
    stt: pick("stt"),
    media: pick("media"),
    payment: pick("payment"),
  };
}

/** Status for the Adapter Inspector (no DB needed). */
export function adapterStatus(): AdapterInfo[] {
  const a = getAdapters({ db: null as unknown as DbLike, workshopId: null });
  return PORT_NAMES.map((p) => a[p].info);
}
