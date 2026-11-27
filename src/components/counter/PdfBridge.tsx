"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LineItem, Severity, Vehicle, Customer } from "@/db/schema";
import type { ExtractedInvoice, IngestionStep } from "@/adapters/contracts";
import { Icon } from "@/components/ui/Icon";
import { Rego } from "@/components/ui/Rego";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorBanner, SuccessBanner } from "@/components/ui/Notice";
import { useAction } from "@/components/ui/useAction";
import { ACL_ESTIMATE_LABEL } from "@/domain/compliance";
import { formatAudExact, formatAudRange, formatDate, formatDateTime, formatKm } from "@/domain/format";
import { LineItemsTable } from "@/components/garage/QuoteParts";

interface IngestResponse {
  job: { id: string; status: string };
  extracted: ExtractedInvoice;
  fieldConfidence: Record<string, number>;
  warnings: string[];
  steps: IngestionStep[];
  confidence: number;
  vehicle: Vehicle | null;
  driver: Customer | null;
  nevdis: { cached: boolean } | null;
  duplicate: boolean;
  pdfUrl: string;
}
interface PublishResponse {
  walletVersion: number;
  walletPushed: boolean;
  findingsPublished: number;
  vehicleId: string;
  sms: { messageId: string } | null;
}

const SAMPLE_URL = "/samples/sample-mechanicdesk-invoice.pdf";

export function PdfBridge({ recent, wms, threshold }: { recent: { id: string; filename: string; status: string; confidence: number; createdAt: string; reviewSeconds: number | null }[]; wms: string; threshold: number }) {
  const ingest = useAction<IngestResponse>();
  const publish = useAction<PublishResponse>();
  const [phase, setPhase] = useState<"idle" | "scanning" | "review" | "published">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [recs, setRecs] = useState<{ include: boolean; severity: "URGENT_RED" | "WATCH_AMBER" }[]>([]);
  const [reviewStart, setReviewStart] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [published, setPublished] = useState<PublishResponse | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Animate the decoupled OCR → LLM steps (timings come from the adapter).
  useEffect(() => {
    if (phase !== "scanning" || !result) return;
    let i = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      i += 1;
      setVisibleSteps(i);
      if (i < result.steps.length) setTimeout(tick, Math.min(900, result.steps[i - 1].ms));
      else
        setTimeout(() => {
          if (cancelled) return;
          setPhase("review");
          setReviewStart(Date.now());
        }, 450);
    };
    setTimeout(tick, 300);
    return () => {
      cancelled = true;
    };
  }, [phase, result]);

  useEffect(() => {
    if (phase !== "review") return;
    const t = setInterval(() => setElapsed((Date.now() - reviewStart) / 1000), 200);
    return () => clearInterval(t);
  }, [phase, reviewStart]);

  const start = async (body: { sample: true } | FormData, previewUrl: string) => {
    setPreview(previewUrl);
    setPublished(null);
    setVisibleSteps(0);
    setElapsed(0);
    const r = body instanceof FormData ? await ingest.call("/api/bridge/ingest", undefined, { form: body, refresh: false }) : await ingest.call("/api/bridge/ingest", body, { refresh: false });
    if (!r) return;
    setResult(r);
    setRecs(r.extracted.recommendations.map((x) => ({ include: true, severity: x.severity })));
    setPhase("scanning");
  };
  const onFile = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    start(fd, URL.createObjectURL(file));
  };
  const doPublish = async () => {
    if (!result) return;
    const r = await publish.call(`/api/bridge/jobs/${result.job.id}/publish`, {
      reviewSeconds: Math.round(elapsed * 10) / 10,
      publishedBy: "Kirsty Brennan",
      recommendations: recs.map((x, index) => ({ index, include: x.include, severity: x.severity })),
    });
    if (r) {
      setPublished(r);
      setPhase("published");
    }
  };

  const ex = result?.extracted;
  const gstOk = ex && ex.totalCents != null && ex.gstCents != null && Math.abs(Math.round(ex.totalCents / 11) - ex.gstCents) <= 1;
  const sumOk = ex && ex.totalCents != null && ex.lineItems.reduce((s: number, l: LineItem) => s + l.totalCents, 0) === ex.totalCents;
  const remaining = Math.max(0, 10 - elapsed);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section aria-labelledby="bridge-h">
        <h2 id="bridge-h" className="text-[22px] font-bold">
          Universal PDF bridge
        </h2>
        <p className="mt-1 max-w-[62ch] text-[15px] text-slate">
          Drop the invoice {wms} already produced, or BCC <span className="readout text-sump">publish@southwestmech.mygarage.example</span> when you email it. It’s read, structured and waiting for a 10-second check. Nobody re-types anything.
        </p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onFile(e.dataTransfer.files?.[0]);
          }}
          className={`relative mt-4 overflow-hidden rounded-md border-2 border-dashed ${drag ? "border-brand bg-brand/5" : "border-slate/50 bg-bench"} `}
        >
          {preview ? (
            <div className="relative h-[460px] bg-white">
              <iframe title="Invoice preview" src={`${preview}#toolbar=0&navpanes=0&view=FitH`} className="h-full w-full" />
              {phase === "scanning" ? (
                <div className="pointer-events-none absolute inset-0 bg-brand/5">
                  <div className="scan-line absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent via-brand/25 to-transparent" />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <Icon name="file" size={40} className="text-slate" />
              <p className="mt-3 text-[17px] font-semibold">Drag an invoice PDF here</p>
              <p className="text-[14px] text-slate">or choose a file. Digital PDFs from {wms}, Workshop Software or COSTAR.</p>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={ingest.pending || phase === "scanning"} onClick={() => start({ sample: true }, SAMPLE_URL)}>
            <Icon name="bolt" size={18} /> Load sample {wms} invoice PDF
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={ingest.pending || phase === "scanning"}>
            <Icon name="upload" size={18} /> Choose a PDF
          </button>
          <input ref={fileRef} type="file" accept="application/pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          <a href={SAMPLE_URL} download className="btn btn-quiet">
            <Icon name="download" size={16} /> Download the sample PDF
          </a>
        </div>
        <div className="mt-3">
          <ErrorBanner error={ingest.error} />
        </div>

        {result ? (
          <ol className="mt-5 space-y-2" aria-label="Extraction steps">
            {result.steps.map((s, i) => {
              const state = i < visibleSteps ? "done" : i === visibleSteps && phase === "scanning" ? "active" : phase === "scanning" ? "waiting" : "done";
              return (
                <li key={s.key} className={`flex items-start gap-3 rounded-md border px-3 py-2 ${state === "active" ? "border-brand bg-white" : "border-chalk bg-bench"} ${state === "waiting" ? "opacity-50" : ""}`}>
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${state === "done" ? "bg-rag-green text-white" : "border-2 border-slate"}`}>{state === "done" ? <Icon name="check" size={14} strokeWidth={3} /> : null}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{s.label}</span>
                    <span className="block text-[13px] text-slate">{state === "done" ? s.detail : "Working…"}</span>
                  </span>
                  <span className="readout text-[12px] text-slate">{s.ms} ms</span>
                </li>
              );
            })}
          </ol>
        ) : null}

        <section className="mt-6" aria-labelledby="recent-h">
          <h3 id="recent-h" className="text-[15px] font-bold">
            Recent documents
          </h3>
          {recent.length ? (
            <ul className="mt-2 divide-y divide-chalk rounded-md border border-chalk bg-bench">
              {recent.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[14px]">
                  <span className="min-w-0 truncate">{j.filename}</span>
                  <span className="readout text-[12px] text-slate">
                    {j.status} · {Math.round(j.confidence * 100)}%{j.reviewSeconds != null ? ` · reviewed in ${j.reviewSeconds}s` : ""} · {formatDateTime(j.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[14px] text-slate">Nothing yet today. Load the sample to see the flow.</p>
          )}
          <p className="mt-2 text-[13px] text-slate">Auto-publish unlocks per invoice template after {Math.round(threshold * 100)}% accuracy over 50 consecutive jobs. Until then every document gets this review.</p>
        </section>
      </section>

      <section aria-labelledby="review-h" className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="review-h" className="text-[22px] font-bold">
            10-second review
          </h2>
          {phase === "review" ? (
            <span className={`readout text-[15px] font-semibold ${remaining > 0 ? "text-sump" : "text-rag-amber-ink"}`} aria-live="polite">
              {remaining > 0 ? `${remaining.toFixed(0)} s target` : `${elapsed.toFixed(0)} s, take your time`}
            </span>
          ) : null}
        </div>
        {phase === "idle" || !result || !ex ? (
          <div className="mt-3 rounded-md border border-dashed border-chalk px-4 py-10 text-center text-[15px] text-slate">The parsed invoice appears here for a quick check before it reaches the customer.</div>
        ) : phase === "scanning" ? (
          <div className="mt-3 rounded-md border border-chalk bg-bench px-4 py-10 text-center text-[15px] text-slate" aria-busy="true">
            Reading the invoice…
          </div>
        ) : phase === "published" && published ? (
          <div className="mt-3 space-y-3">
            <SuccessBanner>
              Published to {result.driver ? `${result.driver.firstName}'s` : "the customer's"} garage. {published.findingsPublished} item(s) to watch added, Wallet pass updated to v{published.walletVersion}
              {published.walletPushed ? " with a lock-screen push" : ""}, and the report SMS sent.
            </SuccessBanner>
            <div className="flex flex-wrap gap-2">
              <Link href={`/?v=${published.vehicleId}`} className="btn btn-primary">
                <Icon name="car" size={18} /> Open the customer garage
              </Link>
              <Link href={`/wallet?v=${published.vehicleId}`} className="btn btn-secondary">
                <Icon name="wallet" size={18} /> See the updated Wallet pass
              </Link>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setPhase("idle");
                  setResult(null);
                  setPreview(null);
                }}
              >
                Publish another
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {result.warnings.length ? (
              <ul className="space-y-1 rounded-md border border-rag-amber bg-rag-amber-wash px-3 py-2 text-[14px]">
                {result.warnings.map((w) => (
                  <li key={w} className="flex gap-2">
                    <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="rounded-md border border-chalk bg-bench px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-slate">Matched vehicle {result.nevdis ? (result.nevdis.cached ? "(NEVDIS cache hit)" : "(NEVDIS lookup)") : ""}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {ex.rego ? <Rego rego={ex.rego} state={ex.regoState ?? "WA"} /> : null}
                    <span className="font-semibold">{ex.vehicleDescription}</span>
                  </div>
                  <p className="text-[13px] text-slate">
                    {result.driver ? `${result.driver.firstName} ${result.driver.lastName} · ` : ""}
                    <span className="readout">VIN {ex.vin}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-semibold text-slate">Confidence</p>
                  <p className="readout text-[22px] font-semibold">{Math.round(result.confidence * 100)}%</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px] sm:grid-cols-4">
                <div>
                  <dt className="text-[12px] font-semibold text-slate">Invoice</dt>
                  <dd className="readout">{ex.invoiceNumber}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-semibold text-slate">Date</dt>
                  <dd className="readout">{formatDate(ex.invoiceDate)}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-semibold text-slate">Odometer</dt>
                  <dd className="readout">
                    {result.vehicle ? `${formatKm(result.vehicle.odometerKm)} → ` : ""}
                    {ex.odometerKm ? formatKm(ex.odometerKm) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] font-semibold text-slate">Next service</dt>
                  <dd className="readout">
                    {formatDate(ex.nextServiceDate)}
                    {ex.nextServiceKm ? ` / ${formatKm(ex.nextServiceKm)}` : ""}
                  </dd>
                </div>
              </dl>
            </div>

            <details className="rounded-md border border-chalk bg-bench px-4 py-2">
              <summary className="cursor-pointer py-1 text-[15px] font-bold">
                Work done <span className="readout font-semibold">{ex.totalCents != null ? formatAudExact(ex.totalCents) : ""}</span>
                <span className={`ml-2 text-[12px] font-semibold ${gstOk && sumOk ? "text-rag-green" : "text-rag-red"}`}>{gstOk && sumOk ? "Totals and GST check out" : "Check totals"}</span>
              </summary>
              <LineItemsTable items={ex.lineItems} dense />
            </details>

            <div>
              <h3 className="text-[15px] font-bold">Ones to watch found on the invoice</h3>
              <p className="text-[13px] text-slate">They’ll show in the customer’s garage with the badge: {ACL_ESTIMATE_LABEL}.</p>
              <ul className="mt-2 space-y-2">
                {ex.recommendations.map((r, i) => (
                  <li key={i} className={`rounded-md border-[1.5px] px-3 py-2 ${recs[i]?.include ? "border-sump bg-white" : "border-chalk bg-bench opacity-70"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex min-h-11 items-center gap-2 font-semibold">
                        <input type="checkbox" className="h-5 w-5 accent-sump" checked={recs[i]?.include ?? true} onChange={(e) => setRecs((rs) => rs.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
                        {r.title}
                      </label>
                      <span className="text-[13px] text-slate">{r.detail}</span>
                      {r.estimateLowCents != null && r.estimateHighCents != null ? <span className="readout ml-auto text-[13px]">{formatAudRange(r.estimateLowCents, r.estimateHighCents)}</span> : null}
                    </div>
                    <div className="mt-1 flex gap-2" role="group" aria-label={`Severity for ${r.title}`}>
                      {(["WATCH_AMBER", "URGENT_RED"] as Severity[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={recs[i]?.severity === s}
                          onClick={() => setRecs((rs) => rs.map((x, j) => (j === i ? { ...x, severity: s as "URGENT_RED" | "WATCH_AMBER" } : x)))}
                          className={`rounded-[3px] border-[1.5px] p-0.5 ${recs[i]?.severity === s ? "border-sump" : "border-transparent opacity-50"}`}
                        >
                          <StatusBadge severity={s} />
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              {ex.checkedOk.length ? (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {ex.checkedOk.map((c) => (
                    <span key={c} className="rounded-[3px] bg-rag-green-wash px-1.5 py-0.5 text-[12px] font-semibold text-rag-green">
                      {c}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
            <ErrorBanner error={publish.error} />
            <button type="button" className="btn btn-primary h-14 w-full text-[16px]" disabled={publish.pending || !result.vehicle || result.duplicate || result.job.status !== "IN_REVIEW"} onClick={doPublish}>
              <Icon name="check" /> {publish.pending ? "Publishing…" : "Approve & publish"}
            </button>
            <p className="text-center text-[13px] text-slate">Publishes the verified record, adds the watch items, updates the Wallet pass and texts the customer their link.</p>
          </div>
        )}
      </section>
    </div>
  );
}
