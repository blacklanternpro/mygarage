/** Generates public/samples/sample-mechanicdesk-invoice.pdf (the PDF Bridge demo fixture). */
import fs from "node:fs";
import path from "node:path";
import { renderInvoicePdf } from "@/domain/invoice-pdf";
import { buildSampleInvoice } from "@/adapters/mocks/fixtures/sample-invoice";
import { isoDate, now } from "@/domain/clock";

async function main() {
  const date = process.argv[2] ?? isoDate(now());
  const bytes = await renderInvoicePdf(buildSampleInvoice(date));
  const out = path.join(process.cwd(), "public", "samples", "sample-mechanicdesk-invoice.pdf");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bytes);
  console.log(`Wrote ${out} (${bytes.byteLength} bytes, invoice date ${date})`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
