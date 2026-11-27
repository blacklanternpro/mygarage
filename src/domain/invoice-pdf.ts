/**
 * Itemised tax invoice PDF (WMS-export layout). Used to:
 *  - generate the bundled sample invoice for the PDF Bridge (scripts/make-sample-pdf.ts), and
 *  - let customers download any verified service record from their timeline.
 * Labels are stable because the Stage 1 ingestion mock parses them.
 */
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { LineItem } from "@/db/schema";
import { formatAudExact, formatAudRange, formatDate, formatKm } from "./format";

export interface InvoiceDoc {
  wms: string;
  sample: boolean;
  workshop: {
    name: string;
    addressLine: string;
    suburb: string;
    state: string;
    postcode: string;
    phone: string;
    email: string;
    abn: string;
    licence: string;
  };
  invoiceNumber: string;
  invoiceDate: string; // ISO
  customer: { name: string; mobile: string; address: string } | null;
  vehicle: { description: string; rego: string; regoState: string; vin: string; odometerKm: number };
  technician: string;
  summary: string;
  lineItems: LineItem[];
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  paymentNote: string | null;
  nextServiceDate: string | null;
  nextServiceKm: number | null;
  recommendations: { severity: "AMBER" | "RED"; title: string; detail: string; lowCents: number; highCents: number }[];
  checkedOk: string[];
}

const INK = rgb(0.12, 0.14, 0.16);
const MUTED = rgb(0.36, 0.4, 0.44);
const RULE = rgb(0.78, 0.76, 0.72);

function qtyText(li: LineItem): string {
  if (li.kind === "LABOUR" && li.hours != null && li.rateCents != null) return `${li.hours} h × ${formatAudExact(li.rateCents)}`;
  return String(li.qty);
}

/** Wrap text to a width (WinAnsi-safe standard font). */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderInvoicePdf(doc: InvoiceDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Tax invoice ${doc.invoiceNumber} — ${doc.workshop.name}`);
  pdf.setAuthor(doc.workshop.name);
  pdf.setProducer(`${doc.wms} export (MyGarage Stage 1 sample)`);
  pdf.setCreator("MyGarage");
  const page: PDFPage = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 42;
  const W = 595.28 - M * 2;
  let y = 800;

  const text = (s: string, x: number, yy: number, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb> } = {}) =>
    page.drawText(s, { x, y: yy, size: opts.size ?? 9.5, font: opts.f ?? font, color: opts.color ?? INK });
  const rightText = (s: string, xRight: number, yy: number, opts: { size?: number; f?: PDFFont } = {}) => {
    const f = opts.f ?? font;
    const size = opts.size ?? 9.5;
    text(s, xRight - f.widthOfTextAtSize(s, size), yy, { size, f });
  };
  const rule = (yy: number, thickness = 0.75) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: M + W, y: yy }, thickness, color: RULE });

  if (doc.sample) {
    page.drawText("SAMPLE - DEMO DATA", {
      x: 120,
      y: 330,
      size: 54,
      font: bold,
      color: rgb(0.9, 0.88, 0.84),
      rotate: degrees(32),
      opacity: 0.6,
    });
  }

  // Header
  text(doc.workshop.name, M, y, { size: 16, f: bold });
  rightText("TAX INVOICE", M + W, y, { size: 16, f: bold });
  y -= 16;
  text(`${doc.workshop.addressLine}, ${doc.workshop.suburb} ${doc.workshop.state} ${doc.workshop.postcode}`, M, y, { color: MUTED });
  rightText(`Invoice No: ${doc.invoiceNumber}`, M + W, y);
  y -= 12;
  text(`Phone: ${doc.workshop.phone}   Email: ${doc.workshop.email}`, M, y);
  rightText(`Invoice date: ${formatDate(doc.invoiceDate)}`, M + W, y);
  y -= 12;
  text(`ABN: ${doc.workshop.abn}`, M, y);
  rightText(`Licence: ${doc.workshop.licence}`, M + W, y);
  y -= 14;
  rule(y, 1.5);
  y -= 18;

  // Customer + vehicle
  const colB = M + W / 2 + 8;
  text("Customer", M, y, { f: bold });
  text("Vehicle", colB, y, { f: bold });
  y -= 13;
  if (doc.customer) {
    text(`Customer: ${doc.customer.name}`, M, y);
    text(`Vehicle: ${doc.vehicle.description}`, colB, y);
    y -= 12;
    text(`Mobile: ${doc.customer.mobile}`, M, y);
    text(`Rego: ${doc.vehicle.rego} (${doc.vehicle.regoState})`, colB, y);
    y -= 12;
    text(`Address: ${doc.customer.address}`, M, y);
  } else {
    text(`Vehicle: ${doc.vehicle.description}`, colB, y);
    y -= 12;
    text(`Rego: ${doc.vehicle.rego} (${doc.vehicle.regoState})`, colB, y);
    y -= 12;
  }
  text(`VIN: ${doc.vehicle.vin}`, colB, y);
  y -= 12;
  text(`Technician: ${doc.technician}`, M, y);
  text(`Odometer: ${formatKm(doc.vehicle.odometerKm)}`, colB, y);
  y -= 16;
  text(`Work performed: ${doc.summary}`, M, y);
  y -= 14;
  rule(y);
  y -= 14;

  // Line items
  const cQty = M + 300;
  const cUnit = M + 420;
  const cAmt = M + W;
  text("Description", M, y, { f: bold });
  text("Qty / Hours", cQty, y, { f: bold });
  rightText("Unit (inc GST)", cUnit + 40, y, { f: bold });
  rightText("Amount", cAmt, y, { f: bold });
  y -= 6;
  rule(y);
  y -= 13;
  for (const li of doc.lineItems) {
    text(li.description, M, y);
    text(qtyText(li), cQty, y);
    rightText(formatAudExact(li.kind === "LABOUR" ? li.rateCents ?? li.unitCents : li.unitCents), cUnit + 40, y);
    rightText(formatAudExact(li.totalCents), cAmt, y);
    y -= 14;
  }
  rule(y + 4);
  y -= 10;
  text("Subtotal (ex GST)", cUnit - 60, y);
  rightText(formatAudExact(doc.subtotalCents), cAmt, y);
  y -= 13;
  text("GST", cUnit - 60, y);
  rightText(formatAudExact(doc.gstCents), cAmt, y);
  y -= 13;
  text("Total (inc GST)", cUnit - 60, y, { f: bold });
  rightText(formatAudExact(doc.totalCents), cAmt, y, { f: bold });
  y -= 16;
  if (doc.paymentNote) {
    text(`Payment: ${doc.paymentNote}`, M, y);
    y -= 13;
  }
  if (doc.nextServiceDate && doc.nextServiceKm) {
    text(`Next service due: ${formatDate(doc.nextServiceDate)} or ${formatKm(doc.nextServiceKm)}`, M, y, { f: bold });
    y -= 18;
  }

  // Recommendations
  if (doc.recommendations.length) {
    rule(y + 6);
    y -= 8;
    text("Ones to watch (recommendations)", M, y, { f: bold });
    y -= 13;
    for (const r of doc.recommendations) {
      text(r.severity, M, y, { f: bold });
      text(r.title, M + 50, y);
      text(r.detail, M + 250, y);
      rightText(`Est. ${formatAudRange(r.lowCents, r.highCents)}`, cAmt, y);
      y -= 13;
    }
    text("Estimates are non-binding and subject to re-inspection and parts pricing.", M, y, { size: 8, color: MUTED });
    y -= 16;
  }
  if (doc.checkedOk.length) {
    const lines = wrap(`Checked & OK: ${doc.checkedOk.join("; ")}`, font, 9.5, W);
    for (const l of lines) {
      text(l, M, y);
      y -= 12;
    }
  }

  // Footer
  page.drawLine({ start: { x: M, y: 64 }, end: { x: M + W, y: 64 }, thickness: 0.75, color: RULE });
  text(`${doc.workshop.name} - ${doc.workshop.licence}. Receipts are kept for all transactions of A$75 or more.`, M, 50, { size: 8 });
  text(
    doc.sample
      ? `Exported from ${doc.wms} - sample fixture for the MyGarage PDF Bridge demo. Not a real tax invoice.`
      : `Verified copy from MyGarage. Original issued by ${doc.workshop.name} via ${doc.wms}.`,
    M,
    38,
    { size: 8 },
  );
  return pdf.save();
}
