import { eq } from "drizzle-orm";
import { customers, serviceRecords, vehicles } from "@/db/schema";
import { scoped } from "@/db/tenant";
import { appContext, errorResponse } from "@/lib/server";
import { notFound } from "@/domain/errors";
import { renderInvoicePdf } from "@/domain/invoice-pdf";
import { licenceLabel } from "@/domain/compliance";

/** Downloadable itemised tax invoice for any verified service record. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { db, workshop, adapters } = await appContext();
    const id = (await ctx.params).id;
    const [r] = await db.select().from(serviceRecords).where(scoped(serviceRecords, workshop.id, eq(serviceRecords.id, id)));
    if (!r) throw notFound("Service record");
    if (r.pdfPath?.startsWith("r2://")) {
      const original = await adapters.media.get(r.pdfPath);
      if (original) return new Response(Buffer.from(original.bytes), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${r.invoiceNumber}.pdf"` } });
    }
    const [v] = await db.select().from(vehicles).where(scoped(vehicles, workshop.id, eq(vehicles.id, r.vehicleId)));
    const [c] = v.primaryDriverId ? await db.select().from(customers).where(scoped(customers, workshop.id, eq(customers.id, v.primaryDriverId))) : [];
    const bytes = await renderInvoicePdf({
      wms: workshop.wms,
      sample: false,
      workshop: { name: workshop.name, addressLine: workshop.addressLine, suburb: workshop.suburb, state: workshop.state, postcode: workshop.postcode, phone: workshop.phone, email: workshop.email, abn: workshop.abn, licence: licenceLabel(workshop) },
      invoiceNumber: r.invoiceNumber,
      invoiceDate: r.serviceDate,
      customer: c ? { name: `${c.firstName} ${c.lastName}`, mobile: c.mobile, address: [c.addressLine, c.suburb, c.postcode].filter(Boolean).join(", ") } : null,
      vehicle: { description: `${v.year} ${v.make} ${v.model} ${v.variant}`, rego: v.rego, regoState: v.regoState, vin: v.vin, odometerKm: r.odometerKm },
      technician: r.technicianName,
      summary: r.summary,
      lineItems: r.lineItems,
      subtotalCents: r.subtotalCents,
      gstCents: r.gstCents,
      totalCents: r.totalCents,
      paymentNote: r.paymentNote,
      nextServiceDate: null,
      nextServiceKm: null,
      recommendations: [],
      checkedOk: [],
    });
    return new Response(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${r.invoiceNumber}.pdf"` } });
  } catch (e) {
    return errorResponse(e);
  }
}
