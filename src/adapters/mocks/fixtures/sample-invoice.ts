/**
 * The bundled sample invoice for the PDF Bridge demo (public/samples/sample-mechanicdesk-invoice.pdf):
 * Bec Hartley's Mazda CX-5 70,000 km logbook service, exported from the shop's WMS.
 * Regenerate with `npm run samples:pdf`.
 */
import type { InvoiceDoc } from "@/domain/invoice-pdf";
import { CX5, HARTLEY, WORKSHOP, fee, labour, part } from "@/db/seed-data";
import { totalsFromLineItems } from "@/domain/format";
import { addDaysIso } from "@/domain/clock";

export const SAMPLE_INVOICE_PATH = "/samples/sample-mechanicdesk-invoice.pdf";
export const SAMPLE_INVOICE_FILENAME = "sample-mechanicdesk-invoice.pdf";

export function buildSampleInvoice(invoiceDate: string): InvoiceDoc {
  const bec = HARTLEY.customers[0];
  const lineItems = [
    labour("s1", "Logbook service labour (70,000 km)", 1.8),
    part("s2", "Engine oil 0W-20 full synthetic (4.8 L)", 1, 8450),
    part("s3", "Oil filter", 1, 2290),
    part("s4", "Cabin air filter", 1, 3900),
    part("s5", "Engine air filter", 1, 4600),
    part("s6", "Sump plug washer", 1, 250),
    fee("s7", "Environmental levy & consumables", 1250),
  ];
  const totals = totalsFromLineItems(lineItems);
  return {
    wms: WORKSHOP.wms,
    sample: true,
    workshop: {
      name: WORKSHOP.name,
      addressLine: WORKSHOP.addressLine,
      suburb: WORKSHOP.suburb,
      state: WORKSHOP.state,
      postcode: WORKSHOP.postcode,
      phone: WORKSHOP.phone,
      email: WORKSHOP.email,
      abn: WORKSHOP.abn,
      licence: `WA Repairer Licence ${WORKSHOP.licenceNumber}`,
    },
    invoiceNumber: "MD-30458",
    invoiceDate,
    customer: { name: `${bec.firstName} ${bec.lastName}`, mobile: bec.mobile, address: `${bec.addressLine}, ${bec.suburb} WA ${bec.postcode}` },
    vehicle: {
      description: `${CX5.year} ${CX5.make} ${CX5.model} ${CX5.variant}`,
      rego: CX5.rego,
      regoState: CX5.regoState,
      vin: CX5.vin,
      odometerKm: 67_540,
    },
    technician: "Mia Castellano",
    summary: "70,000 km logbook service and multi-point inspection",
    lineItems,
    ...totals,
    paymentNote: "Paid - EFTPOS Visa ending 4417",
    nextServiceDate: addDaysIso(invoiceDate, 182),
    nextServiceKm: 77_540,
    recommendations: [
      { severity: "AMBER", title: "Rear tyres at 3.5 mm", detail: "Replace within ~5,000 km", lowCents: 38000, highCents: 46000 },
      { severity: "AMBER", title: "Wiper blades smearing", detail: "Replace when convenient", lowCents: 4500, highCents: 6500 },
    ],
    checkedOk: [
      "Front brakes 8 mm",
      "Rear brakes 7 mm",
      "Battery 88% health",
      "Front tyres 5.8 mm",
      "Suspension & steering",
      "Lights & indicators",
      "Coolant & hoses",
      "CV boots & driveline",
    ],
  };
}
