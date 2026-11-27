import Link from "next/link";
import { notFound } from "next/navigation";
import { appContext } from "@/lib/server";
import { getVehicleDetail } from "@/domain/garage";
import { REDACTED, licenceAct, licenceLabel, redactForSalePack } from "@/domain/compliance";
import { canonicalJson, sha256 } from "@/domain/ids";
import { formatAudExact, formatDate, formatDateTime, formatKm } from "@/domain/format";
import { now } from "@/domain/clock";
import { Rego } from "@/components/ui/Rego";
import { LicenceTag } from "@/components/ui/LicenceTag";
import { Icon } from "@/components/ui/Icon";
import { PrintButton } from "./PrintButton";

/** Printable, PII-redacted service history for selling the vehicle (research §3). */
export async function SalePack({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const ctx = await appContext();
  const detail = await getVehicleDetail(ctx.db, ctx.workshop.id, vehicleId);
  if (!detail) notFound();
  const v = detail.card.vehicle;
  const pack = redactForSalePack({
    vehicle: { year: v.year, make: v.make, model: v.model, variant: v.variant, rego: v.rego, regoState: v.regoState, vin: v.vin, colour: v.colour, odometerKm: v.odometerKm },
    owner: detail.driver,
    records: detail.serviceRecords.map((r) => ({
      invoiceNumber: r.invoiceNumber,
      serviceDate: r.serviceDate,
      odometerKm: r.odometerKm,
      summary: r.summary,
      lineItems: r.lineItems.map((l) => ({ description: l.description, kind: l.kind })),
      totalCents: r.totalCents,
      technicianName: r.technicianName,
      paymentNote: r.paymentNote,
      verified: r.verified,
    })),
    inspection: detail.latestInspection ? { date: detail.latestInspection.inspectedAt.toISOString(), healthy: detail.green.length, watch: detail.amber.length, urgent: detail.red.length } : null,
    workshop: { name: ctx.workshop.name, licence: licenceLabel(ctx.workshop), suburb: ctx.workshop.suburb, state: ctx.workshop.state },
  });
  const code = sha256(canonicalJson(pack)).slice(0, 16).toUpperCase();
  const generated = now();
  return (
    <div className="mx-auto max-w-[820px] bg-white px-6 py-8 text-sump print:px-0 print:py-0 md:my-6 md:rounded-md md:shadow-sheet">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/?v=${vehicleId}`} className="btn btn-quiet -ml-2">
          Back to the garage
        </Link>
        <PrintButton />
      </div>
      <header className="border-b-2 border-sump pb-4">
        <p className="text-[13px] font-semibold text-slate">Verified Sale Pack</p>
        <h1 className="font-tailgate mt-1 text-[40px]">
          {v.year} {v.make} {v.model}
        </h1>
        <p className="text-[15px]">{v.variant}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Rego rego={v.rego} state={v.regoState} size="lg" />
          <span className="readout text-[13px]">VIN {v.vin}</span>
          <span className="text-[13px]">{v.colour}</span>
          <span className="readout text-[13px]">{formatKm(v.odometerKm)}</span>
        </div>
      </header>

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="text-[13px] font-semibold text-slate">Serviced by</h2>
          <p className="text-[16px] font-bold">{pack.workshop.name}</p>
          <p className="text-[14px]">
            {pack.workshop.suburb} {pack.workshop.state}
          </p>
          <div className="mt-1">
            <LicenceTag label={pack.workshop.licence} tone="plain" />
          </div>
          <p className="mt-1 text-[12px] text-slate">Licensed under the {licenceAct(ctx.workshop)}</p>
        </div>
        <div>
          <h2 className="text-[13px] font-semibold text-slate">Owner details</h2>
          <p className="inline-flex items-center gap-1.5 text-[15px] font-semibold">
            <Icon name="lock" size={16} /> {REDACTED}
          </p>
          <p className="text-[12.5px] text-slate">Name, address, phone, email and payment details are removed automatically.</p>
        </div>
      </section>

      {pack.inspection ? (
        <section className="mt-5 rounded-md border border-chalk px-4 py-3">
          <h2 className="text-[15px] font-bold">Latest inspection, {formatDate(pack.inspection.date)}</h2>
          <p className="text-[14px]">
            {pack.inspection.healthy} items checked healthy · {pack.inspection.watch} to watch · {pack.inspection.urgent} urgent
          </p>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-[17px] font-bold">Service history ({pack.records.length} verified records)</h2>
        <table className="mt-2 w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b-2 border-sump text-left">
              <th className="py-1.5 pr-2 font-semibold">Date</th>
              <th className="py-1.5 pr-2 font-semibold">Odometer</th>
              <th className="py-1.5 pr-2 font-semibold">Work</th>
              <th className="py-1.5 text-right font-semibold">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {pack.records.map((r) => (
              <tr key={r.invoiceNumber} className="border-b border-chalk align-top">
                <td className="readout py-2 pr-2">{formatDate(r.serviceDate)}</td>
                <td className="readout py-2 pr-2">{formatKm(r.odometerKm)}</td>
                <td className="py-2 pr-2">
                  <span className="font-semibold">{r.summary}</span>
                  <span className="block text-[12px] text-slate">{r.lineItems.map((l) => l.description).join(", ")}</span>
                </td>
                <td className="py-2 text-right">
                  <span className="readout block">{r.invoiceNumber}</span>
                  <span className="readout block text-[12px] text-slate">{formatAudExact(r.totalCents)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t-2 border-sump pt-4">
        <div>
          <p className="text-[12px] font-semibold text-slate">Verification code</p>
          <p className="readout text-[20px] font-semibold tracking-wider">{code.match(/.{4}/g)?.join("-")}</p>
          <p className="text-[12px] text-slate">SHA-256 of this pack's contents. Any edit changes the code. Generated {formatDateTime(generated)}.</p>
        </div>
        <p className="max-w-[34ch] text-right text-[12px] text-slate">Records published by the workshop directly from its system. Not editable by the owner.</p>
      </footer>
    </div>
  );
}
