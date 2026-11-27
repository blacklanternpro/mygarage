import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractPdfText } from "@/lib/pdf-text";
import { mapInvoiceText } from "@/adapters/mocks/ingestion";
import { renderInvoicePdf } from "@/domain/invoice-pdf";
import { buildSampleInvoice } from "@/adapters/mocks/fixtures/sample-invoice";

describe("PDF bridge text extraction", () => {
  it("reads a generated WMS invoice end to end", async () => {
    const bytes = await renderInvoicePdf(buildSampleInvoice("2026-11-27"));
    const pdf = extractPdfText(bytes);
    expect(pdf.pageCount).toBe(1);
    const { extracted, fieldConfidence } = mapInvoiceText(pdf.text, pdf.lines);
    expect(extracted.invoiceNumber).toBe("MD-30458");
    expect(extracted.rego).toBe("1GYT 812");
    expect(extracted.vin).toBe("JM0KF4W7A00123456");
    expect(extracted.odometerKm).toBe(67540);
    expect(extracted.totalCents).toBe(50440);
    expect(extracted.gstCents).toBe(4585);
    expect(extracted.lineItems.reduce((s, l) => s + l.totalCents, 0)).toBe(50440);
    expect(extracted.lineItems[0]).toMatchObject({ kind: "LABOUR", hours: 1.8, rateCents: 16500 });
    expect(extracted.nextServiceKm).toBe(77540);
    expect(extracted.recommendations.map((r) => r.category)).toEqual(["TYRES", "VISIBILITY"]);
    expect(extracted.checkedOk).toHaveLength(8);
    expect(fieldConfidence.lineItems).toBeGreaterThan(0.95);
  });
  it("ships the bundled sample PDF", () => {
    const file = path.join(process.cwd(), "public/samples/sample-mechanicdesk-invoice.pdf");
    expect(fs.existsSync(file)).toBe(true);
    const pdf = extractPdfText(new Uint8Array(fs.readFileSync(file)));
    expect(pdf.text).toContain("MD-30458");
  });
  it("returns nothing for non-PDF input", () => {
    expect(extractPdfText(new TextEncoder().encode("hello")).pageCount).toBe(0);
  });
});
