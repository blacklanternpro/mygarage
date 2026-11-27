"use client";
import { useState } from "react";
import type { RefusalAcknowledgements } from "@/db/schema";
import { Rego } from "@/components/ui/Rego";
import { Icon } from "@/components/ui/Icon";
import { formatAudExact, formatDateTime } from "@/domain/format";

interface Row {
  id: string;
  seq: number;
  eventType: string;
  actorRole: string;
  signerName: string | null;
  signatureSvg: string | null;
  acknowledgements: RefusalAcknowledgements | null;
  payload: Record<string, unknown>;
  prevHash: string;
  contentHash: string;
  occurredAt: string;
  vehicle: { rego: string; regoState: string; label: string } | null;
}

const LABEL: Record<string, { text: string; cls: string }> = {
  QUOTE_ISSUED: { text: "Fixed quote issued", cls: "bg-stone text-sump" },
  QUOTE_APPROVED: { text: "Quote approved", cls: "bg-rag-green text-white" },
  QUOTE_DECLINED: { text: "Quote declined", cls: "bg-stone text-sump" },
  UNSAFE_VEHICLE_REFUSAL: { text: "AAAA unsafe vehicle refusal", cls: "bg-rag-red text-white" },
  ESTIMATE_PLANNED: { text: "Estimate planned", cls: "bg-rag-amber text-sump" },
  RESOLVED_ELSEWHERE: { text: "Resolved elsewhere", cls: "bg-stone text-sump" },
  INVOICE_PUBLISHED: { text: "Invoice published", cls: "bg-brand text-white" },
  FINDING_PUBLISHED: { text: "Bay finding published", cls: "bg-brand text-white" },
};

const ACK: [keyof RefusalAcknowledgements, string][] = [
  ["unsafeToDrive", "Vehicle unsafe to drive"],
  ["mechanicalReason", "Mechanical reason explained"],
  ["mechanicalDangers", "Mechanical dangers explained"],
  ["safetyDangers", "Safety dangers to driver and others"],
  ["repairOrTowRecommended", "Repair or tow recommended"],
];

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function ComplianceVault({ rows, chain }: { rows: Row[]; chain: { ok: boolean; count: number; headHash: string; brokenAtSeq: number | null } }) {
  const [filter, setFilter] = useState<"ALL" | "APPROVALS" | "REFUSALS">("ALL");
  const [open, setOpen] = useState<string | null>(null);
  const shown = rows.filter((r) => (filter === "ALL" ? true : filter === "REFUSALS" ? r.eventType === "UNSAFE_VEHICLE_REFUSAL" : r.eventType.startsWith("QUOTE_")));
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold">Compliance vault</h2>
          <p className="mt-1 max-w-[66ch] text-[15px] text-slate">Every Fixed Quote, signed approval and AAAA unsafe-vehicle refusal, timestamped and append-only. The database rejects edits and deletes, and each entry is sealed with the hash of the one before it.</p>
        </div>
        <div className={`flex items-center gap-2 rounded-md border-[1.5px] px-3 py-2 ${chain.ok ? "border-rag-green bg-rag-green-wash" : "border-rag-red bg-rag-red-wash"}`}>
          <Icon name="shield" size={22} className={chain.ok ? "text-rag-green" : "text-rag-red"} />
          <div>
            <p className="text-[14px] font-bold">{chain.ok ? `Chain verified: ${chain.count} entries` : `Chain broken at entry #${chain.brokenAtSeq}`}</p>
            <p className="readout text-[11px] text-slate">head {chain.headHash.slice(0, 20)}…</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-1" role="group" aria-label="Filter entries">
        {(["ALL", "APPROVALS", "REFUSALS"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`h-10 rounded-md px-3 text-[14px] font-semibold ${filter === f ? "bg-sump text-white" : "bg-bench text-sump"}`}>
            {f === "ALL" ? "Everything" : f === "APPROVALS" ? "Quotes & approvals" : "Unsafe vehicle refusals"}
          </button>
        ))}
      </div>
      <ol className="mt-4 space-y-2">
        {shown.map((r) => {
          const l = LABEL[r.eventType] ?? { text: r.eventType, cls: "bg-stone" };
          const isOpen = open === r.id;
          const total = (r.payload.approvedTotalCents ?? r.payload.totalCents) as number | undefined;
          return (
            <li key={r.id} className="rounded-md border border-chalk bg-bench">
              <button type="button" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>
                <span className="readout w-10 text-[13px] text-slate">#{r.seq}</span>
                <span className={`rounded-[3px] px-1.5 py-1 text-[12px] font-semibold leading-none ${l.cls}`}>{l.text}</span>
                {r.vehicle ? <Rego rego={r.vehicle.rego} state={r.vehicle.regoState} size="sm" /> : null}
                <span className="text-[14px] font-semibold">{String(r.payload.quoteNumber ?? r.payload.findingTitle ?? r.payload.title ?? r.payload.invoiceNumber ?? "")}</span>
                {total != null ? <span className="readout text-[13px]">{formatAudExact(total)}</span> : null}
                <span className="text-[13px] text-slate">{r.signerName ? `by ${r.signerName}` : ""}</span>
                <span className="readout ml-auto text-[12px] text-slate">{formatDateTime(r.occurredAt)}</span>
              </button>
              {isOpen ? (
                <div className="grid gap-4 border-t border-chalk px-4 py-3 lg:grid-cols-[1fr_280px]">
                  <div className="space-y-2 text-[14px]">
                    {r.acknowledgements ? (
                      <ul className="space-y-1">
                        {ACK.map(([k, label]) => (
                          <li key={k} className="flex items-center gap-2">
                            <Icon name={r.acknowledgements![k] ? "check" : "close"} size={16} className={r.acknowledgements![k] ? "text-rag-green" : "text-rag-red"} /> {label}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {r.payload.reason ? <p>Reason given: “{String(r.payload.reason)}”</p> : null}
                    <dl className="readout grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[11.5px]">
                      <dt className="font-sans text-slate">Actor</dt>
                      <dd>{r.actorRole}</dd>
                      <dt className="font-sans text-slate">Previous hash</dt>
                      <dd className="break-all">{r.prevHash}</dd>
                      <dt className="font-sans text-slate">Entry hash</dt>
                      <dd className="break-all">{r.contentHash}</dd>
                    </dl>
                    <details>
                      <summary className="cursor-pointer text-[13px] font-semibold">Full record</summary>
                      <pre className="readout mt-1 max-h-64 overflow-auto rounded bg-white p-2 text-[11px]">{JSON.stringify(r.payload, null, 2)}</pre>
                    </details>
                  </div>
                  {r.signatureSvg ? (
                    <figure className="rounded border border-chalk bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={svgDataUrl(r.signatureSvg)} alt={`Signature of ${r.signerName ?? "signer"}`} className="h-24 w-full object-contain" />
                      <figcaption className="text-center text-[12px] text-slate">{r.signerName}</figcaption>
                    </figure>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
