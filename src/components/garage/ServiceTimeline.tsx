"use client";
import Link from "next/link";
import { useState } from "react";
import type { ServiceRecord } from "@/db/schema";
import { formatAudExact, formatDate, formatKm } from "@/domain/format";
import { Icon } from "@/components/ui/Icon";
import { LineItemsTable, TotalsBlock } from "./QuoteParts";

export function ServiceTimeline({ records, vehicleId, licence }: { records: ServiceRecord[]; vehicleId: string; licence: string }) {
  const [openId, setOpenId] = useState<string | null>(records[0]?.id ?? null);
  return (
    <section aria-labelledby="history-h" className="mt-8 lg:mt-0">
      <div className="rule-heavy flex flex-wrap items-baseline justify-between gap-2 pt-2">
        <h2 id="history-h" className="text-[19px] font-bold">
          Verified service history
        </h2>
        <Link href={`/sale-pack/${vehicleId}`} className="btn btn-secondary min-h-10 px-3 text-[14px]">
          <Icon name="shield" size={17} /> Verified Sale Pack
        </Link>
      </div>
      <p className="mt-1 text-[13px] text-slate">Every invoice your workshop publishes, itemised. Selling? The Sale Pack hides your address and payment details.</p>
      <ol className="mt-3 border-l-2 border-sump/80">
        {records.map((r) => {
          const open = openId === r.id;
          return (
            <li key={r.id} className="relative pb-4 pl-4">
              <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-sump bg-bench" aria-hidden="true" />
              <button type="button" className="w-full text-left" aria-expanded={open} onClick={() => setOpenId(open ? null : r.id)}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="readout text-[13px] font-semibold">{formatDate(r.serviceDate)}</span>
                  <span className="readout text-[13px]">{formatAudExact(r.totalCents)}</span>
                </div>
                <p className="mt-0.5 text-[15px] font-semibold leading-snug">{r.summary}</p>
                <p className="text-[12.5px] text-slate">
                  <span className="readout">{formatKm(r.odometerKm)}</span> · {r.invoiceNumber} · {r.technicianName}
                </p>
              </button>
              {r.verified ? (
                <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-rag-green">
                  <Icon name="shield" size={13} /> Verified by workshop {r.publishedAt ? formatDate(r.publishedAt) : ""}
                </p>
              ) : null}
              {open ? (
                <div className="mt-2 rounded-md border border-chalk bg-bench px-3 py-2">
                  <LineItemsTable items={r.lineItems} dense />
                  <TotalsBlock items={r.lineItems} />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <a href={`/api/service-records/${r.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-quiet -ml-2 min-h-10 text-[14px]">
                      <Icon name="download" size={16} /> Download invoice (PDF)
                    </a>
                    <span className="readout text-[11px] text-slate">{licence}</span>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
