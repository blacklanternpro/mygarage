import fs from "node:fs/promises";
import path from "node:path";
import { ingestPdf } from "@/domain/bridge";
import { appContext, run } from "@/lib/server";
import { unprocessable } from "@/domain/errors";
import { SAMPLE_INVOICE_FILENAME } from "@/adapters/mocks/fixtures/sample-invoice";

/** Accepts multipart (field "file") or JSON {"sample": true} for the bundled MechanicDesk invoice. */
export async function POST(req: Request) {
  return run(async () => {
    const ctx = await appContext();
    const type = req.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw unprocessable("NO_FILE", "Attach a PDF invoice.");
      if (file.type && file.type !== "application/pdf") throw unprocessable("NOT_PDF", "That file isn't a PDF.");
      return ingestPdf(ctx, { filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()), source: "UPLOAD" });
    }
    const bytes = await fs.readFile(path.join(process.cwd(), "public", "samples", SAMPLE_INVOICE_FILENAME));
    return ingestPdf(ctx, { filename: SAMPLE_INVOICE_FILENAME, bytes: new Uint8Array(bytes), source: "SAMPLE" });
  });
}
