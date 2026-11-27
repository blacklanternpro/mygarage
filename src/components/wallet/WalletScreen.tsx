import Link from "next/link";
import { eq } from "drizzle-orm";
import { appContext } from "@/lib/server";
import { getHouseholdGarage } from "@/domain/garage";
import { walletPasses } from "@/db/schema";
import { scoped } from "@/db/tenant";
import type { ServiceStickerPass } from "@/adapters/contracts";
import { garageUrl } from "@/domain/wallet";
import { qrSvg } from "@/lib/qr";
import { Rego } from "@/components/ui/Rego";
import { WalletStandalone } from "./WalletStandalone";

/** Surface 2: the Apple/Google Wallet "Digital Service Sticker", reflecting live DB state. */
export async function WalletScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await appContext();
  const garage = await getHouseholdGarage(ctx.db, ctx.workshop.id, ctx.householdId);
  const vid = garage.vehicles.find((c) => c.vehicle.id === sp.v)?.vehicle.id ?? garage.vehicles[0]?.vehicle.id;
  const [pass] = vid ? await ctx.db.select().from(walletPasses).where(scoped(walletPasses, ctx.workshop.id, eq(walletPasses.vehicleId, vid))) : [];
  if (!pass || !vid) return <p className="p-6">No pass yet.</p>;
  const payload = pass.payload as { sticker: ServiceStickerPass; apple: Record<string, unknown>; google: Record<string, unknown>; signature: string };
  const card = garage.vehicles.find((c) => c.vehicle.id === vid)!;
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
      <div>
        <h1 className="text-[24px] font-bold">Digital service sticker</h1>
        <p className="mt-1 max-w-[60ch] text-[15px] text-slate">
          The windscreen sticker, rebuilt as an Apple Wallet and Google Wallet pass. It updates itself whenever the workshop publishes a service or a watch-list item changes, and reminders arrive free on the lock screen.
        </p>
        <nav aria-label="Choose vehicle" className="mt-4 flex flex-wrap gap-2">
          {garage.vehicles.map((c) => (
            <Link key={c.vehicle.id} href={`/wallet?v=${c.vehicle.id}`} aria-current={c.vehicle.id === vid ? "true" : undefined} className={`rounded-md border-[1.5px] px-2 py-1.5 ${c.vehicle.id === vid ? "border-sump bg-bench" : "border-transparent"}`}>
              <Rego rego={c.vehicle.rego} state={c.vehicle.regoState} size="sm" />
            </Link>
          ))}
        </nav>
        <dl className="mt-6 grid max-w-[560px] grid-cols-2 gap-px overflow-hidden rounded-md border border-chalk bg-chalk text-[14px]">
          <div className="bg-bench px-3 py-2">
            <dt className="text-[12px] font-semibold text-slate">Pass version</dt>
            <dd className="readout text-[17px]">v{pass.version}</dd>
          </div>
          <div className="bg-bench px-3 py-2">
            <dt className="text-[12px] font-semibold text-slate">Serial</dt>
            <dd className="readout text-[15px]">{pass.serialNumber}</dd>
          </div>
          <div className="col-span-2 bg-bench px-3 py-2">
            <dt className="text-[12px] font-semibold text-slate">Payload hash (changes only when the customer would see a difference)</dt>
            <dd className="readout break-all text-[12px]">{pass.payloadHash}</dd>
          </div>
          <div className="col-span-2 bg-bench px-3 py-2">
            <dt className="text-[12px] font-semibold text-slate">Open watch-list right now</dt>
            <dd className="text-[15px] font-semibold">{card.red + card.amber === 0 ? "All clear" : `${card.red + card.amber} item(s), ${card.red} urgent`}</dd>
          </div>
        </dl>
        <details className="mt-6 max-w-[560px] rounded-md border border-chalk bg-bench">
          <summary className="cursor-pointer px-3 py-3 text-[14px] font-semibold">Show the pass.json the Stage 2 signer will sign</summary>
          <pre className="readout max-h-80 overflow-auto border-t border-chalk px-3 py-2 text-[11px] leading-relaxed">{JSON.stringify(payload.apple, null, 2)}</pre>
        </details>
      </div>
      <div className="mt-8 lg:mt-0">
        <WalletStandalone
          pass={payload.sticker}
          version={pass.version}
          qr={await qrSvg(garageUrl(vid))}
          updatedAt={pass.updatedAt.toISOString()}
          vehicleId={vid}
          workshopName={ctx.workshop.name}
          defaultMessage={`Your ${card.vehicle.model} (${card.vehicle.rego}) is due for a service soon. Tap to book with ${ctx.workshop.name}.`}
        />
      </div>
    </div>
  );
}
