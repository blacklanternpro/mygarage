/**
 * Zero-Double-Entry Bridge (research §4, tier 2): a WMS PDF goes in, is parsed by the
 * IngestionAdapter, waits at the 10-second advisor review gate, and on "Approve & publish"
 * becomes a verified service record + Ones to Watch in the customer's garage and Wallet pass.
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { customers, findings, ingestionJobs, inspectionReports, nevdisLookups, serviceRecords, vehicles, type IngestionJob, type Vehicle } from "@/db/schema";
import { scoped } from "@/db/tenant";
import type { ExtractedInvoice } from "@/adapters/contracts";
import type { Svc } from "./context";
import { conflict, notFound, unprocessable } from "./errors";
import { appendAuditEvent } from "./audit";
import { isoDate, now } from "./clock";
import { formatDate, formatKm, regoKey } from "./format";
import { DIAGRAM_FOR_CATEGORY, inferCategory } from "./categories";
import { refreshVehicleReminders } from "./reminders";
import { garageUrl, syncWalletPass } from "./wallet";

/** NEVDIS lookup with a per-workshop cache — each plate is queried once (research §7). */
export async function lookupVehicleCached(svc: Svc, state: string, rego: string) {
  const [cached] = await svc.db
    .select()
    .from(nevdisLookups)
    .where(scoped(nevdisLookups, svc.workshop.id, eq(nevdisLookups.regoState, state), eq(nevdisLookups.rego, rego)));
  if (cached) return { vehicle: cached.payload, cached: true };
  const hit = await svc.adapters.nevdis.lookupByRego({ state, rego });
  if (hit)
    await svc.db
      .insert(nevdisLookups)
      .values({ workshopId: svc.workshop.id, regoState: state, rego, payload: { ...hit }, fetchedAt: now() })
      .onConflictDoNothing();
  return { vehicle: hit, cached: false };
}

async function matchVehicle(svc: Svc, ex: ExtractedInvoice): Promise<Vehicle | null> {
  const all = await svc.db.select().from(vehicles).where(scoped(vehicles, svc.workshop.id));
  return (
    all.find((v) => ex.vin && v.vin === ex.vin) ??
    all.find((v) => ex.rego && regoKey(v.rego) === regoKey(ex.rego) && (!ex.regoState || v.regoState === ex.regoState)) ??
    null
  );
}

export async function ingestPdf(svc: Svc, input: { filename: string; bytes: Uint8Array; source: "UPLOAD" | "SAMPLE" | "EMAIL_BCC" }) {
  if (input.bytes.byteLength > 8 * 1024 * 1024) throw unprocessable("FILE_TOO_LARGE", "PDFs up to 8 MB, please.");
  const result = await svc.adapters.ingestion.extractInvoice({ filename: input.filename, bytes: input.bytes });
  const vehicle = await matchVehicle(svc, result.extracted);
  const nevdis = result.extracted.rego && result.extracted.regoState ? await lookupVehicleCached(svc, result.extracted.regoState, result.extracted.rego) : null;
  const stored = await svc.adapters.media.put({ workshopId: svc.workshop.id, kind: "PDF", contentType: "application/pdf", bytes: input.bytes, vehicleId: vehicle?.id });
  const [dup] = result.extracted.invoiceNumber
    ? await svc.db.select({ id: serviceRecords.id }).from(serviceRecords).where(scoped(serviceRecords, svc.workshop.id, eq(serviceRecords.invoiceNumber, result.extracted.invoiceNumber)))
    : [];
  const warnings = [...result.warnings];
  if (!vehicle) warnings.push("No matching vehicle in this workshop — check the rego.");
  if (dup) warnings.push(`Invoice ${result.extracted.invoiceNumber} is already published.`);
  const [job] = await svc.db
    .insert(ingestionJobs)
    .values({
      workshopId: svc.workshop.id,
      filename: input.filename,
      source: input.source,
      status: result.text.length < 40 ? "FAILED" : "IN_REVIEW",
      steps: result.steps,
      extracted: { ...result.extracted, fieldConfidence: result.fieldConfidence, warnings, model: result.model, nevdisCached: nevdis?.cached ?? null },
      confidence: result.confidence,
      vehicleId: vehicle?.id ?? null,
      mediaKey: stored.key,
    })
    .returning();
  const driver = vehicle?.primaryDriverId
    ? ((await svc.db.select().from(customers).where(scoped(customers, svc.workshop.id, eq(customers.id, vehicle.primaryDriverId))))[0] ?? null)
    : null;
  return { job, extracted: result.extracted, fieldConfidence: result.fieldConfidence, warnings, steps: result.steps, confidence: result.confidence, vehicle, driver, nevdis, duplicate: !!dup, pdfUrl: stored.url };
}

export const publishSchema = z.object({
  reviewSeconds: z.number().min(0).max(3600).optional(),
  publishedBy: z.string().trim().max(80).default("Kirsty Brennan"),
  recommendations: z
    .array(
      z.object({
        index: z.number().int().min(0),
        include: z.boolean().default(true),
        severity: z.enum(["URGENT_RED", "WATCH_AMBER"]),
      }),
    )
    .default([]),
});

export async function publishJob(svc: Svc, jobId: string, input: z.infer<typeof publishSchema>) {
  const [job] = await svc.db.select().from(ingestionJobs).where(scoped(ingestionJobs, svc.workshop.id, eq(ingestionJobs.id, jobId)));
  if (!job) throw notFound("Ingestion job");
  if (job.status === "PUBLISHED") throw conflict("Already published.");
  if (job.status !== "IN_REVIEW") throw unprocessable("NOT_REVIEWABLE", "This document couldn't be read, so it can't be published.");
  if (!job.vehicleId) throw unprocessable("NO_VEHICLE", "Match the invoice to a vehicle before publishing.");
  const ex = job.extracted as unknown as ExtractedInvoice;
  if (!ex.invoiceNumber || !ex.invoiceDate || ex.totalCents == null) throw unprocessable("MISSING_FIELDS", "Invoice number, date and total are required.");
  const [dup] = await svc.db.select({ id: serviceRecords.id }).from(serviceRecords).where(scoped(serviceRecords, svc.workshop.id, eq(serviceRecords.invoiceNumber, ex.invoiceNumber)));
  if (dup) throw conflict(`Invoice ${ex.invoiceNumber} is already in this customer's history. Reset the demo to publish the sample again.`);
  const [vehicle] = await svc.db.select().from(vehicles).where(scoped(vehicles, svc.workshop.id, eq(vehicles.id, job.vehicleId)));
  const publishedAt = now();

  const [record] = await svc.db
    .insert(serviceRecords)
    .values({
      workshopId: svc.workshop.id,
      vehicleId: vehicle.id,
      invoiceNumber: ex.invoiceNumber,
      source: "MECHANICDESK_PDF",
      serviceDate: ex.invoiceDate,
      odometerKm: ex.odometerKm ?? vehicle.odometerKm,
      summary: ex.summary ?? "Service",
      lineItems: ex.lineItems,
      subtotalCents: ex.subtotalCents ?? ex.totalCents - (ex.gstCents ?? Math.round(ex.totalCents / 11)),
      gstCents: ex.gstCents ?? Math.round(ex.totalCents / 11),
      totalCents: ex.totalCents,
      technicianName: ex.technicianName ?? "Technician",
      advisorName: input.publishedBy,
      verified: true,
      publishedAt,
      publishedBy: input.publishedBy,
      pdfPath: job.mediaKey,
      paymentNote: ex.paymentNote,
      ingestionJobId: job.id,
    })
    .returning();

  const [report] = await svc.db
    .insert(inspectionReports)
    .values({
      workshopId: svc.workshop.id,
      vehicleId: vehicle.id,
      serviceRecordId: record.id,
      inspectedAt: publishedAt,
      odometerKm: record.odometerKm,
      technicianName: record.technicianName,
      summary: ex.summary,
    })
    .returning();

  // The new inspection supersedes the previous "checked & healthy" list.
  await svc.db
    .update(findings)
    .set({ status: "COMPLETED", updatedAt: publishedAt })
    .where(scoped(findings, svc.workshop.id, eq(findings.vehicleId, vehicle.id), eq(findings.severity, "HEALTHY_GREEN"), eq(findings.status, "OPEN")));

  const recs = ex.recommendations.map((r, index) => {
    const edit = input.recommendations.find((e) => e.index === index);
    return { ...r, include: edit?.include ?? true, severity: edit?.severity ?? r.severity };
  });
  const newFindings = [
    ...recs
      .filter((r) => r.include)
      .map((r, i) => ({
        workshopId: svc.workshop.id,
        vehicleId: vehicle.id,
        inspectionReportId: report.id,
        severity: r.severity,
        category: r.category,
        title: r.title,
        customerExplanation: plainEnglishFromInvoice(r.title, r.detail, r.severity),
        technicianNote: `${r.title} — ${r.detail} (from ${ex.invoiceNumber})`,
        measurement: r.title.match(/\d+(\.\d+)?\s?(mm|%|V)/)?.[0] ?? null,
        diagram: DIAGRAM_FOR_CATEGORY[r.category] ?? null,
        horizonText: r.horizonText,
        estimateLowCents: r.estimateLowCents,
        estimateHighCents: r.estimateHighCents,
        safetyCritical: r.severity === "URGENT_RED",
        source: "PDF_BRIDGE",
        sortOrder: i,
      })),
    ...ex.checkedOk.map((c, i) => ({
      workshopId: svc.workshop.id,
      vehicleId: vehicle.id,
      inspectionReportId: report.id,
      severity: "HEALTHY_GREEN" as const,
      category: inferCategory(c),
      title: c.replace(/\s+\d.*$/, "") || c,
      customerExplanation: "Checked and healthy.",
      measurement: c.match(/\d.*$/)?.[0] ?? null,
      source: "PDF_BRIDGE",
      sortOrder: 100 + i,
    })),
  ];
  if (newFindings.length) await svc.db.insert(findings).values(newFindings);

  await svc.db
    .update(vehicles)
    .set({
      odometerKm: Math.max(vehicle.odometerKm, record.odometerKm),
      odometerAt: publishedAt,
      nextServiceDueDate: ex.nextServiceDate ?? vehicle.nextServiceDueDate,
      nextServiceDueKm: ex.nextServiceKm ?? vehicle.nextServiceDueKm,
    })
    .where(scoped(vehicles, svc.workshop.id, eq(vehicles.id, vehicle.id)));

  await svc.db
    .update(ingestionJobs)
    .set({ status: "PUBLISHED", publishedAt, serviceRecordId: record.id, reviewSeconds: input.reviewSeconds ?? null })
    .where(eq(ingestionJobs.id, job.id));

  await appendAuditEvent(svc.db, {
    workshopId: svc.workshop.id,
    eventType: "INVOICE_PUBLISHED",
    actorRole: "ADVISOR",
    vehicleId: vehicle.id,
    signerName: input.publishedBy,
    payload: {
      invoiceNumber: ex.invoiceNumber,
      totalCents: ex.totalCents,
      source: job.source,
      filename: job.filename,
      confidence: job.confidence,
      reviewSeconds: input.reviewSeconds ?? null,
      findingsPublished: recs.filter((r) => r.include).length,
    },
    occurredAt: publishedAt,
  });

  await refreshVehicleReminders(svc.db, svc.workshop.id, vehicle.id);
  const pushMessage = `${vehicle.make} ${vehicle.model} service report ready. Next service ${ex.nextServiceDate ? formatDate(ex.nextServiceDate) : "—"}${ex.nextServiceKm ? ` or ${formatKm(ex.nextServiceKm)}` : ""}.`;
  const wallet = await syncWalletPass(svc.db, svc.adapters, svc.workshop, vehicle.id, { pushMessage });

  const driver = vehicle.primaryDriverId
    ? ((await svc.db.select().from(customers).where(scoped(customers, svc.workshop.id, eq(customers.id, vehicle.primaryDriverId))))[0] ?? null)
    : null;
  let sms = null;
  if (driver)
    sms = await svc.adapters.sms.send({
      to: driver.mobile,
      senderId: svc.workshop.smsSenderId,
      body: `${svc.workshop.name}: hi ${driver.firstName}, your ${vehicle.make} ${vehicle.model} service report and ${recs.filter((r) => r.include).length} item(s) to watch are in your garage: ${garageUrl(vehicle.id)}`,
      tag: "report-ready",
    });

  return { record, walletVersion: wallet.pass.version, walletPushed: wallet.pushed, sms, vehicleId: vehicle.id, findingsPublished: recs.filter((r) => r.include).length };
}

/** Turn terse invoice recommendations into a sentence a driver understands. */
export function plainEnglishFromInvoice(title: string, detail: string, severity: "URGENT_RED" | "WATCH_AMBER"): string {
  const t = title.replace(/\s+/g, " ").trim();
  const d = detail.replace(/^replace\s+/i, "").trim();
  if (severity === "URGENT_RED") return `${t}. This affects safety — please book it in before regular driving.`;
  return `${t}. Nothing urgent yet — plan to replace ${d ? d.charAt(0).toLowerCase() + d.slice(1) : "soon"}.`;
}

export async function recentJobs(svc: Svc, limit = 6): Promise<IngestionJob[]> {
  return svc.db.select().from(ingestionJobs).where(and(eq(ingestionJobs.workshopId, svc.workshop.id))).orderBy(desc(ingestionJobs.createdAt)).limit(limit);
}

export function todayIso() {
  return isoDate(now());
}
