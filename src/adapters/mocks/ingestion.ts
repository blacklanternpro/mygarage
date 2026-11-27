/**
 * Mock decoupled OCR + LLM ingestion. Step 1 really extracts text from the PDF's content streams
 * (src/lib/pdf-text.ts). Step 2 stands in for Gemini Flash-Lite structured extraction with a
 * deterministic field mapper tuned to WMS invoice exports. Stage 2 swaps both for live providers.
 */
import type { LineItem } from "@/db/schema";
import { extractPdfText } from "@/lib/pdf-text";
import { inferCategory } from "@/domain/categories";
import { shortHash } from "@/domain/ids";
import type { ExtractedInvoice, ExtractedRecommendation, IngestionAdapter, IngestionResult, IngestionStep } from "../contracts";
import { logEvent, nextSeq, type MockContext } from "./events";

const money = (s: string | undefined | null): number | null => {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
const isoFromAu = (s: string | undefined | null): string | null => {
  const m = s?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const km = (s: string | undefined | null): number | null => (s ? parseInt(s.replace(/[^0-9]/g, ""), 10) || null : null);

function field(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function parseLineItems(lines: string[]): LineItem[] {
  const start = lines.findIndex((l) => /^Description\t/i.test(l));
  const end = lines.findIndex((l, i) => i > start && /^Subtotal \(ex GST\)/i.test(l));
  if (start < 0) return [];
  const rows = lines.slice(start + 1, end > start ? end : undefined);
  const items: LineItem[] = [];
  rows.forEach((row, i) => {
    const cells = row.split("\t");
    if (cells.length < 4) return;
    const [description, qtyCell, , amountCell] = cells;
    const totalCents = money(amountCell);
    if (totalCents == null) return;
    const hours = qtyCell.match(/([\d.]+)\s*h\s*×\s*A\$([\d,.]+)/);
    if (hours) {
      const rateCents = money(hours[2]) ?? 0;
      items.push({ id: `x${i + 1}`, kind: "LABOUR", description, qty: 1, hours: parseFloat(hours[1]), rateCents, unitCents: totalCents, totalCents });
      return;
    }
    const qty = parseFloat(qtyCell) || 1;
    const kind = /levy|consumable|fee|disposal|alignment|road test/i.test(description) ? "FEE" : "PART";
    items.push({ id: `x${i + 1}`, kind, description, qty, unitCents: Math.round(totalCents / qty), totalCents });
  });
  return items;
}

function parseRecommendations(lines: string[]): ExtractedRecommendation[] {
  return lines
    .filter((l) => /^(AMBER|RED)\t/.test(l))
    .map((l) => {
      const [sev, title, detail, est] = l.split("\t");
      const range = est?.match(/A\$([\d,]+)\s*[–-]\s*A\$([\d,]+)/);
      return {
        severity: sev === "RED" ? "URGENT_RED" : "WATCH_AMBER",
        title: title ?? "Recommendation",
        detail: detail ?? "",
        estimateLowCents: range ? money(range[1]) : null,
        estimateHighCents: range ? money(range[2]) : null,
        horizonText: detail ?? null,
        category: inferCategory(`${title} ${detail}`),
      } satisfies ExtractedRecommendation;
    });
}

export function mapInvoiceText(text: string, lines: string[]): { extracted: ExtractedInvoice; fieldConfidence: Record<string, number> } {
  const rego = text.match(/Rego:\s*([A-Z0-9]{1,4}\s?[A-Z0-9]{2,4})\s*\((WA|NSW|VIC|QLD|SA|TAS|ACT|NT)\)/);
  const next = text.match(/Next service due:\s*(\d{2}\/\d{2}\/\d{4})\s*or\s*([\d,]+)\s*km/);
  const checkedStart = lines.findIndex((l) => /^Checked & OK:/.test(l));
  let checkedText = "";
  if (checkedStart >= 0) {
    const tail: string[] = [];
    for (let i = checkedStart; i < lines.length && !/Receipts are kept|^SAMPLE - DEMO DATA$|^Exported from|^Verified copy/.test(lines[i]); i++) tail.push(lines[i]);
    checkedText = tail.join(" ");
  }
  const checkedOk = checkedText
    .replace(/^.*?Checked & OK:\s*/, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const wms = field(text, /Exported from\s+([A-Za-z ]+?)\s*-/) ?? (/(MechanicDesk)/.exec(text)?.[1] ?? null);

  const extracted: ExtractedInvoice = {
    wms,
    invoiceNumber: field(text, /Invoice No:\s*([A-Z]{1,4}-?\d{3,})/),
    invoiceDate: isoFromAu(field(text, /Invoice date:\s*(\d{2}\/\d{2}\/\d{4})/)),
    rego: rego ? rego[1].replace(/\s+/, " ") : null,
    regoState: rego ? rego[2] : null,
    vin: field(text, /VIN:\s*([A-HJ-NPR-Z0-9]{17})/),
    vehicleDescription: field(text, /Vehicle:\s*([^\t\n]+)/),
    odometerKm: km(field(text, /Odometer:\s*([\d,]+)\s*km/)),
    customerName: field(text, /Customer:\s*([^\t\n]+)/),
    customerMobile: field(text, /Mobile:\s*(04\d{2}\s?\d{3}\s?\d{3})/),
    technicianName: field(text, /Technician:\s*([^\t\n]+)/),
    lineItems: parseLineItems(lines),
    subtotalCents: money(field(text, /Subtotal \(ex GST\)\t?\s*(A\$[\d,.]+)/)),
    gstCents: money(field(text, /^GST\t(A\$[\d,.]+)/m)),
    totalCents: money(field(text, /Total \(inc GST\)\t?\s*(A\$[\d,.]+)/)),
    paymentNote: field(text, /Payment:\s*([^\t\n]+)/),
    nextServiceDate: next ? isoFromAu(next[1]) : null,
    nextServiceKm: next ? km(next[2]) : null,
    recommendations: parseRecommendations(lines),
    checkedOk,
    summary: field(text, /Work performed:\s*([^\t\n]+)/),
  };

  const fc: Record<string, number> = {};
  const set = (k: keyof ExtractedInvoice, base: number) => (fc[k] = extracted[k] == null || (Array.isArray(extracted[k]) && !(extracted[k] as unknown[]).length) ? 0 : base);
  set("invoiceNumber", 0.99);
  set("invoiceDate", 0.98);
  set("rego", 0.97);
  set("vin", 0.99);
  set("odometerKm", 0.95);
  set("customerName", 0.96);
  set("lineItems", 0.93);
  set("totalCents", 0.99);
  set("nextServiceDate", 0.94);
  set("recommendations", 0.9);
  const sum = extracted.lineItems.reduce((s, i) => s + i.totalCents, 0);
  if (extracted.totalCents != null) fc.lineItems = sum === extracted.totalCents ? Math.max(fc.lineItems, 0.97) : 0.6;
  return { extracted, fieldConfidence: fc };
}

export class MockIngestionAdapter implements IngestionAdapter {
  readonly info = {
    port: "ingestion",
    contract: "IngestionAdapter",
    mode: "MOCK",
    provider: "Local PDF text + rules mapper",
    liveProvider: "AWS Textract / Azure Read → Gemini Flash-Lite",
    stage: "Stage 2",
    envVar: "ADAPTER_INGESTION",
  } as const;

  constructor(private ctx: MockContext) {}

  async extractInvoice(input: { filename: string; bytes: Uint8Array }): Promise<IngestionResult> {
    const seq = await nextSeq(this.ctx, "ingestion");
    const pdf = extractPdfText(input.bytes);
    const warnings: string[] = [];
    if (!pdf.pageCount) warnings.push("This file isn't a PDF.");
    else if (pdf.text.length < 40)
      warnings.push("No readable text found. It may be a scanned image — scanned invoices need the Stage 2 OCR provider. Try the sample invoice.");
    const { extracted, fieldConfidence } = mapInvoiceText(pdf.text, pdf.lines);
    const keys = Object.values(fieldConfidence);
    const confidence = keys.length ? Math.round((keys.reduce((a, b) => a + b, 0) / keys.length) * 100) / 100 : 0;
    if (extracted.totalCents != null && extracted.gstCents != null && Math.abs(Math.round(extracted.totalCents / 11) - extracted.gstCents) > 1)
      warnings.push("GST doesn't equal 1/11 of the total — check the invoice.");

    const steps: IngestionStep[] = [
      { key: "ocr", label: "Raw text OCR", ms: 380 + pdf.runCount * 4, detail: `${pdf.pageCount} page(s), ${pdf.lines.length} lines of text` },
      { key: "layout", label: "Layout & table detection", ms: 260 + extracted.lineItems.length * 40, detail: `${extracted.lineItems.length} line items, ${extracted.recommendations.length} recommendations` },
      { key: "llm", label: "Structured extraction (Gemini Flash-Lite schema)", ms: 720, detail: `${Object.values(fieldConfidence).filter((v) => v > 0).length} fields mapped` },
      { key: "validate", label: "Validation: GST, totals, rego & NEVDIS", ms: 310, detail: warnings.length ? `${warnings.length} warning(s)` : "All checks passed" },
    ];
    const result: IngestionResult = {
      text: pdf.text,
      pageCount: pdf.pageCount,
      extracted,
      confidence,
      fieldConfidence,
      warnings,
      steps,
      model: "mock:pdf-text+rules (stands in for gemini-flash-lite)",
    };
    await logEvent(this.ctx, {
      port: "ingestion",
      operation: "extractInvoice",
      seq,
      request: { filename: input.filename, bytes: input.bytes.byteLength, sha: shortHash(Buffer.from(input.bytes).toString("base64"), 12) },
      response: { confidence, invoiceNumber: extracted.invoiceNumber, rego: extracted.rego, warnings },
    });
    return result;
  }
}
